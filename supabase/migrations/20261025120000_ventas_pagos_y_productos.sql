-- =====================================================================================
-- Migración 20261025120000_ventas_pagos_y_productos
-- Objetivo: que los pagos, productos y pedidos se puedan guardar de nuevo.
--   * venta.estado (con CHECK), producto.destacado, producto.model_3d_url
--   * CHECK producto.stock >= 0 (producto.stock es la ÚNICA fuente de verdad del stock)
--   * Secuencias identity alineadas con los IDs reales
--   * Índices de claves foráneas y filtros de venta / detalle_venta / inventario
--   * public.registrar_venta(...): checkout transaccional "todo o nada"
-- Es ADITIVA (no borra, no renombra, no cambia tipos) e IDEMPOTENTE (se puede ejecutar 2 veces).
-- No activa RLS ni crea políticas (fase aparte).
-- Deshacer en emergencia: 20261025120000_ventas_pagos_y_productos.rollback.sql
-- =====================================================================================

begin;

-- Si la app tiene bloqueada alguna tabla, fallar rápido en vez de dejar la web colgada esperando.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- -------------------------------------------------------------------------------------
-- 1. venta.estado
-- Las ventas existentes reciben 'Pagado' mediante el DEFAULT constante al crear la columna
-- (camino rápido de Postgres: sin UPDATE ni reescritura). Después el default pasa a
-- 'Pendiente' para las ventas nuevas. En una segunda ejecución "if not exists" no hace nada,
-- así que no pisa estados ya guardados.
-- -------------------------------------------------------------------------------------
alter table public.venta add column if not exists estado text not null default 'Pagado';
alter table public.venta alter column estado set default 'Pendiente';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'venta_estado_check' and conrelid = 'public.venta'::regclass
  ) then
    alter table public.venta
      add constraint venta_estado_check check (estado = any (array[
        'Pendiente', 'Pagado', 'Fallido', 'En proceso', 'En entrega',
        'Enviado', 'Entregado', 'Completado', 'Cancelado'
      ]::text[]));
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- 2. producto.destacado y producto.model_3d_url
-- -------------------------------------------------------------------------------------
alter table public.producto add column if not exists destacado boolean not null default false;
alter table public.producto add column if not exists model_3d_url text;

-- -------------------------------------------------------------------------------------
-- 3. CHECK producto.stock >= 0
-- No sabemos si hoy hay algún stock negativo, así que se crea NOT VALID (aplica a filas
-- nuevas/actualizadas) y solo se VALIDA si los datos actuales lo cumplen.
-- -------------------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'producto_stock_no_negativo' and conrelid = 'public.producto'::regclass
  ) then
    alter table public.producto
      add constraint producto_stock_no_negativo check (stock >= 0) not valid;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'producto_stock_no_negativo'
      and conrelid = 'public.producto'::regclass and not convalidated
  ) then
    if exists (select 1 from public.producto where stock < 0) then
      raise notice 'producto_stock_no_negativo queda NOT VALID: hay productos con stock negativo. Corrígelos y ejecuta: alter table public.producto validate constraint producto_stock_no_negativo;';
    else
      alter table public.producto validate constraint producto_stock_no_negativo;
    end if;
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- 4. Secuencias identity: el próximo ID será max(id) + 1 (o 1 si la tabla está vacía).
-- -------------------------------------------------------------------------------------
select setval(pg_get_serial_sequence('public.producto', 'id_producto'),
              coalesce((select max(id_producto) from public.producto), 0) + 1, false);
select setval(pg_get_serial_sequence('public.venta', 'id_venta'),
              coalesce((select max(id_venta) from public.venta), 0) + 1, false);
select setval(pg_get_serial_sequence('public.detalle_venta', 'id_detalle_venta'),
              coalesce((select max(id_detalle_venta) from public.detalle_venta), 0) + 1, false);

-- -------------------------------------------------------------------------------------
-- 5. Índices (tablas pequeñas hoy: se crean dentro de la transacción, sin CONCURRENTLY).
-- -------------------------------------------------------------------------------------
-- Historial de pedidos de un cliente (FK id_usuario + orden por fecha)
create index if not exists venta_id_usuario_fecha_idx on public.venta (id_usuario, fecha desc);
-- Listados/reportes de ventas por fecha
create index if not exists venta_fecha_idx on public.venta (fecha desc);
-- Resto de FKs de venta (joins y ON DELETE SET NULL / CASCADE)
create index if not exists venta_id_empleado_idx on public.venta (id_empleado);
create index if not exists venta_id_sucursal_idx on public.venta (id_sucursal);
-- FKs de detalle_venta
create index if not exists detalle_venta_id_venta_idx on public.detalle_venta (id_venta);
create index if not exists detalle_venta_id_producto_idx on public.detalle_venta (id_producto);
-- FKs de inventario
create index if not exists inventario_id_producto_idx on public.inventario (id_producto);
create index if not exists inventario_id_sucursal_idx on public.inventario (id_sucursal);

-- -------------------------------------------------------------------------------------
-- 6. public.registrar_venta: checkout transaccional
--   p_id_usuario : usuario comprador o NULL (compra anónima). Se usa tal cual; nunca otro.
--   p_items      : [{"id_producto": <int>, "cantidad": <int>}, ...] (1..50 líneas)
--   p_estado     : 'Pagado' (descuenta stock) o 'Fallido' (solo registra)
-- Reglas:
--   * El precio SIEMPRE sale de producto.precio; cualquier precio enviado se ignora.
--   * Productos repetidos se SUMAN en una línea; la suma también debe estar entre 1 y 99.
--   * Todo o nada: ante cualquier error no queda venta, ni detalle, ni cambio de stock.
--   * Bloquea los productos en orden de id_producto (evita deadlocks).
-- Errores (SQLSTATE P0001; message = código estable; detalles en DETAIL):
--   ESTADO_INVALIDO, CARRITO_VACIO, CARRITO_DEMASIADO_GRANDE, ITEM_INVALIDO,
--   CANTIDAD_INVALIDA, USUARIO_NO_EXISTE, PRODUCTO_NO_EXISTE, PRODUCTO_INACTIVO,
--   STOCK_INSUFICIENTE
-- Devuelve: {"id_venta","total","estado","items":[{id_producto,nombre,cantidad,precio_unitario,subtotal}]}
-- -------------------------------------------------------------------------------------
create or replace function public.registrar_venta(p_id_usuario bigint, p_items jsonb, p_estado text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item        jsonb;
  v_pos         integer := 0;
  v_ok          boolean;
  v_ids         bigint[];
  v_cantidades  integer[];
  v_fila        record;
  v_total       numeric(10,2);
  v_id_venta    bigint;
  v_items_out   jsonb;
begin
  -- Estado
  if p_estado is null or p_estado not in ('Pagado', 'Fallido') then
    raise exception using errcode = 'P0001', message = 'ESTADO_INVALIDO',
      detail = format('estado=%s (permitidos: Pagado, Fallido)', coalesce(p_estado, 'NULL'));
  end if;

  -- Carrito
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'CARRITO_VACIO';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception using errcode = 'P0001', message = 'CARRITO_DEMASIADO_GRANDE',
      detail = format('lineas=%s (maximo 50)', jsonb_array_length(p_items));
  end if;

  -- Validar cada línea ANTES de convertir tipos (evita errores 22P02 genéricos)
  -- (CASE garantiza el orden: solo se convierte a numeric cuando ya se sabe que es número)
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    v_ok := case
         when jsonb_typeof(v_item) <> 'object' then false
         when coalesce(jsonb_typeof(v_item -> 'id_producto'), '') <> 'number' then false
         else (v_item ->> 'id_producto')::numeric = trunc((v_item ->> 'id_producto')::numeric)
              and (v_item ->> 'id_producto')::numeric between 1 and 9223372036854775807
       end;
    if not v_ok then
      raise exception using errcode = 'P0001', message = 'ITEM_INVALIDO',
        detail = format('linea=%s', v_pos);
    end if;
    v_ok := case
         when coalesce(jsonb_typeof(v_item -> 'cantidad'), '') <> 'number' then false
         else (v_item ->> 'cantidad')::numeric = trunc((v_item ->> 'cantidad')::numeric)
              and (v_item ->> 'cantidad')::numeric between 1 and 99
       end;
    if not v_ok then
      raise exception using errcode = 'P0001', message = 'CANTIDAD_INVALIDA',
        detail = format('linea=%s (entero entre 1 y 99)', v_pos);
    end if;
  end loop;

  -- Sumar productos repetidos (ordenados por id para bloquear siempre en el mismo orden)
  select array_agg(l.id_producto order by l.id_producto),
         array_agg(l.cantidad order by l.id_producto)
    into v_ids, v_cantidades
  from (
    select (e ->> 'id_producto')::numeric::bigint as id_producto,
           sum((e ->> 'cantidad')::numeric::integer)::integer as cantidad
    from jsonb_array_elements(p_items) as e
    group by 1
  ) as l;

  select l.id_producto, l.cantidad into v_fila
  from unnest(v_ids, v_cantidades) as l(id_producto, cantidad)
  where l.cantidad > 99
  limit 1;
  if found then
    raise exception using errcode = 'P0001', message = 'CANTIDAD_INVALIDA',
      detail = format('id_producto=%s cantidad_total=%s (maximo 99)', v_fila.id_producto, v_fila.cantidad);
  end if;

  -- Usuario (NULL = compra anónima)
  if p_id_usuario is not null
     and not exists (select 1 from public.usuario u where u.id_usuario = p_id_usuario) then
    raise exception using errcode = 'P0001', message = 'USUARIO_NO_EXISTE',
      detail = format('id_usuario=%s', p_id_usuario);
  end if;

  -- Si se pagó, bloquear los productos en orden de id (evita deadlocks). NO KEY UPDATE basta
  -- para cambiar stock y no choca con los FOR KEY SHARE de las FKs de otras compras.
  -- Un pago 'Fallido' no toca stock, así que no bloquea nada.
  if p_estado = 'Pagado' then
    perform 1 from public.producto p
    where p.id_producto = any (v_ids)
    order by p.id_producto
    for no key update;
  end if;

  -- Existencia, estado y stock (ya bajo bloqueo, así los datos no cambian hasta el COMMIT)
  for v_fila in
    select l.id_producto, l.cantidad, p.id_producto as encontrado, p.estado, p.stock
    from unnest(v_ids, v_cantidades) as l(id_producto, cantidad)
    left join public.producto p on p.id_producto = l.id_producto
    order by l.id_producto
  loop
    if v_fila.encontrado is null then
      raise exception using errcode = 'P0001', message = 'PRODUCTO_NO_EXISTE',
        detail = format('id_producto=%s', v_fila.id_producto);
    elsif v_fila.estado is distinct from true then
      raise exception using errcode = 'P0001', message = 'PRODUCTO_INACTIVO',
        detail = format('id_producto=%s', v_fila.id_producto);
    elsif p_estado = 'Pagado' and v_fila.stock < v_fila.cantidad then
      raise exception using errcode = 'P0001', message = 'STOCK_INSUFICIENTE',
        detail = format('id_producto=%s solicitado=%s disponible=%s',
                        v_fila.id_producto, v_fila.cantidad, v_fila.stock);
    end if;
  end loop;

  -- Total calculado en la base con los precios reales
  select sum(p.precio * l.cantidad)
    into v_total
  from unnest(v_ids, v_cantidades) as l(id_producto, cantidad)
  join public.producto p on p.id_producto = l.id_producto;

  insert into public.venta (total, tipo_venta, id_usuario, estado)
  values (v_total, 'Online', p_id_usuario, p_estado)
  returning id_venta into v_id_venta;

  insert into public.detalle_venta (id_venta, id_producto, cantidad, precio_unitario)
  select v_id_venta, l.id_producto, l.cantidad, p.precio
  from unnest(v_ids, v_cantidades) as l(id_producto, cantidad)
  join public.producto p on p.id_producto = l.id_producto
  order by l.id_producto;

  -- Descontar stock solo si se pagó (con guarda "stock >= cantidad" por seguridad)
  if p_estado = 'Pagado' then
    for v_fila in
      select l.id_producto, l.cantidad
      from unnest(v_ids, v_cantidades) as l(id_producto, cantidad)
      order by l.id_producto
    loop
      update public.producto
         set stock = stock - v_fila.cantidad
       where id_producto = v_fila.id_producto
         and stock >= v_fila.cantidad;
      if not found then
        raise exception using errcode = 'P0001', message = 'STOCK_INSUFICIENTE',
          detail = format('id_producto=%s', v_fila.id_producto);
      end if;
    end loop;
  end if;

  select jsonb_agg(jsonb_build_object(
           'id_producto', l.id_producto,
           'nombre', p.nombre,
           'cantidad', l.cantidad,
           'precio_unitario', p.precio,
           'subtotal', p.precio * l.cantidad
         ) order by l.id_producto)
    into v_items_out
  from unnest(v_ids, v_cantidades) as l(id_producto, cantidad)
  join public.producto p on p.id_producto = l.id_producto;

  return jsonb_build_object(
    'id_venta', v_id_venta,
    'total', v_total,
    'estado', p_estado,
    'items', v_items_out
  );
end;
$$;

comment on function public.registrar_venta(bigint, jsonb, text) is
  'Checkout transaccional (todo o nada). Precios desde producto.precio. Solo service_role. Errores P0001 con message = código estable.';

-- Privilegios mínimos: solo el backend (service_role). Postgres/Supabase dan EXECUTE por
-- defecto a PUBLIC/anon/authenticated, por eso se revoca explícitamente en cada ejecución.
revoke execute on function public.registrar_venta(bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_venta(bigint, jsonb, text) to service_role;

commit;

-- Avisar a la API REST de Supabase (PostgREST) que recargue el esquema.
notify pgrst, 'reload schema';
