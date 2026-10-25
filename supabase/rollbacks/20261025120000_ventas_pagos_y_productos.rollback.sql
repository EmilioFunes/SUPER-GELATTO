-- =====================================================================================
-- ROLLBACK de 20261025120000_ventas_pagos_y_productos  (SOLO PARA EMERGENCIAS)
-- ATENCIÓN:
--   * Borra la columna venta.estado: se PIERDE el estado de cada venta (Pagado/Fallido/...).
--     Si luego se vuelve a aplicar la migración, TODAS las ventas quedarán como 'Pagado'.
--   * Borra producto.destacado y producto.model_3d_url (se pierden esos valores).
--   * NO revierte las secuencias: devolverlas a su valor viejo volvería a provocar choques
--     de ID. Dejarlas alineadas con max(id) es inofensivo.
--   * No borra ventas ni detalle_venta ya registrados por registrar_venta.
-- Es idempotente (usa IF EXISTS).
-- =====================================================================================

begin;

set local lock_timeout = '5s';

drop function if exists public.registrar_venta(bigint, jsonb, text);

drop index if exists public.venta_id_usuario_fecha_idx;
drop index if exists public.venta_fecha_idx;
drop index if exists public.venta_id_empleado_idx;
drop index if exists public.venta_id_sucursal_idx;
drop index if exists public.detalle_venta_id_venta_idx;
drop index if exists public.detalle_venta_id_producto_idx;
drop index if exists public.inventario_id_producto_idx;
drop index if exists public.inventario_id_sucursal_idx;

alter table public.producto drop constraint if exists producto_stock_no_negativo;
alter table public.venta drop constraint if exists venta_estado_check;

alter table public.venta drop column if exists estado;
alter table public.producto drop column if exists destacado;
alter table public.producto drop column if exists model_3d_url;

commit;

notify pgrst, 'reload schema';
