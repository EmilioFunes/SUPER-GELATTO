// Pruebas de la migración 20261025120000_ventas_pagos_y_productos y de public.registrar_venta.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  crearBase, registrarVenta, valor, contar, leer, RUTA_MIGRACION, RUTA_ROLLBACK,
} from './helpers.js';

const stockDe = async (db, id) =>
  Number(await valor(db, 'select stock from public.producto where id_producto = $1', [id]));

// Ejecuta fn y devuelve el error de Postgres que lanza (o falla si no lanza nada).
async function errorDe(fn) {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error('Se esperaba un error y no hubo ninguno');
}

describe('estado de partida (reproduce el problema real)', () => {
  it('sin migración, insertar un producto sin ID choca con la secuencia desfasada', async () => {
    const db = await crearBase({ migrar: false });
    const e = await errorDe(() =>
      db.query("insert into public.producto (nombre, precio) values ('Nuevo', 100)"));
    expect(e.code).toBe('23505'); // llave duplicada
  });
});

describe('migración: columnas, restricciones y secuencias', () => {
  let db;
  beforeEach(async () => { db = await crearBase(); });

  it('venta.estado acepta Pagado y rechaza valores inventados', async () => {
    await db.query("insert into public.venta (total, tipo_venta, estado) values (10, 'Online', 'Pagado')");
    const e = await errorDe(() =>
      db.query("insert into public.venta (total, tipo_venta, estado) values (10, 'Online', 'Inventado')"));
    expect(e.code).toBe('23514'); // violación de CHECK
  });

  it('venta.estado: las ventas existentes quedan en Pagado y las nuevas por defecto en Pendiente', async () => {
    const viejas = await db.query('select distinct estado from public.venta');
    expect(viejas.rows).toEqual([{ estado: 'Pagado' }]);
    const r = await db.query("insert into public.venta (total, tipo_venta) values (1, 'Online') returning estado");
    expect(r.rows[0].estado).toBe('Pendiente');
  });

  it('venta.estado acepta todos los estados que usa la app', async () => {
    for (const est of ['Pendiente', 'Pagado', 'Fallido', 'En proceso', 'En entrega',
      'Enviado', 'Entregado', 'Completado', 'Cancelado']) {
      await db.query("insert into public.venta (total, tipo_venta, estado) values (1, 'Online', $1)", [est]);
    }
    expect(await contar(db, 'venta')).toBe(2 + 9);
  });

  it('producto tiene destacado (false por defecto) y model_3d_url; no se crea stock_disponible', async () => {
    const r = await db.query("insert into public.producto (nombre, precio) values ('X', 1) returning destacado, model_3d_url");
    expect(r.rows[0]).toEqual({ destacado: false, model_3d_url: null });
    const cols = await db.query(
      "select column_name from information_schema.columns where table_schema='public' and table_name='producto'");
    expect(cols.rows.map((c) => c.column_name)).not.toContain('stock_disponible');
  });

  it('producto.stock no puede ser negativo', async () => {
    const e = await errorDe(() => db.query('update public.producto set stock = -1 where id_producto = 5'));
    expect(e.code).toBe('23514');
  });

  it('tras la migración se insertan producto y venta sin dar ID (secuencias corregidas)', async () => {
    const p = await db.query("insert into public.producto (nombre, precio) values ('Nuevo', 100) returning id_producto");
    expect(Number(p.rows[0].id_producto)).toBeGreaterThan(13);
    const v = await db.query("insert into public.venta (total, tipo_venta) values (1, 'Online') returning id_venta");
    expect(BigInt(v.rows[0].id_venta)).toBeGreaterThan(1786407836737n);
    const d = await db.query(
      'insert into public.detalle_venta (cantidad, precio_unitario, id_venta, id_producto) values (1, 1, $1, 5) returning id_detalle_venta',
      [v.rows[0].id_venta]);
    expect(Number(d.rows[0].id_detalle_venta)).toBeGreaterThanOrEqual(1);
  });

  it('crea los índices de claves foráneas y filtros', async () => {
    const r = await db.query(
      "select indexname from pg_indexes where schemaname='public' and tablename in ('venta','detalle_venta','inventario')");
    const nombres = r.rows.map((x) => x.indexname);
    for (const idx of ['venta_id_usuario_fecha_idx', 'venta_fecha_idx', 'venta_id_empleado_idx',
      'venta_id_sucursal_idx', 'detalle_venta_id_venta_idx', 'detalle_venta_id_producto_idx',
      'inventario_id_producto_idx', 'inventario_id_sucursal_idx']) {
      expect(nombres).toContain(idx);
    }
  });
});

describe('registrar_venta', () => {
  let db;
  beforeEach(async () => { db = await crearBase(); });

  it("'Pagado' crea venta + detalle con precios reales de la base y descuenta stock", async () => {
    const r = await registrarVenta(db, 1, [
      { id_producto: 13, cantidad: 2 },
      { id_producto: 5, cantidad: 1 },
    ], 'Pagado');

    // 2 x 1200.50 + 1 x 2500.00
    expect(Number(r.total)).toBeCloseTo(4901.0, 2);
    expect(r.estado).toBe('Pagado');
    expect(r.items).toEqual([
      { id_producto: 5, nombre: 'Helado de fresa', cantidad: 1, precio_unitario: 2500.0, subtotal: 2500.0 },
      { id_producto: 13, nombre: 'Paleta de mango', cantidad: 2, precio_unitario: 1200.5, subtotal: 2401.0 },
    ]);

    const v = await db.query('select * from public.venta where id_venta = $1', [r.id_venta]);
    expect(v.rows[0]).toMatchObject({ tipo_venta: 'Online', estado: 'Pagado' });
    expect(Number(v.rows[0].id_usuario)).toBe(1);
    expect(Number(v.rows[0].total)).toBeCloseTo(4901.0, 2);

    const d = await db.query(
      'select id_producto, cantidad, precio_unitario from public.detalle_venta where id_venta = $1 order by id_producto',
      [r.id_venta]);
    expect(d.rows.map((x) => [Number(x.id_producto), x.cantidad, Number(x.precio_unitario)]))
      .toEqual([[5, 1, 2500], [13, 2, 1200.5]]);

    expect(await stockDe(db, 5)).toBe(9);
    expect(await stockDe(db, 13)).toBe(1);
  });

  it('ignora cualquier precio enviado por el cliente', async () => {
    const r = await registrarVenta(db, 1, [{ id_producto: 5, cantidad: 1, precio: 1, precio_unitario: 1 }], 'Pagado');
    expect(Number(r.total)).toBeCloseTo(2500, 2);
  });

  it('productos repetidos en el carrito se suman en una sola línea', async () => {
    const r = await registrarVenta(db, null, [
      { id_producto: 5, cantidad: 1 },
      { id_producto: 5, cantidad: 2 },
    ], 'Pagado');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].cantidad).toBe(3);
    expect(await stockDe(db, 5)).toBe(7);
    expect(await contar(db, 'detalle_venta')).toBe(1);
  });

  it('stock insuficiente: error STOCK_INSUFICIENTE y no queda nada guardado', async () => {
    const ventasAntes = await contar(db, 'venta');
    const e = await errorDe(() => registrarVenta(db, 1, [
      { id_producto: 5, cantidad: 1 },  // este sí alcanza
      { id_producto: 13, cantidad: 4 }, // solo hay 3
    ], 'Pagado'));
    expect(e.code).toBe('P0001');
    expect(e.message).toBe('STOCK_INSUFICIENTE');
    expect(await contar(db, 'venta')).toBe(ventasAntes);
    expect(await contar(db, 'detalle_venta')).toBe(0);
    expect(await stockDe(db, 5)).toBe(10);
    expect(await stockDe(db, 13)).toBe(3);
  });

  it.each([
    ['producto inexistente', [{ id_producto: 999, cantidad: 1 }], 'Pagado', 'PRODUCTO_NO_EXISTE'],
    ['producto inactivo', [{ id_producto: 6, cantidad: 1 }], 'Pagado', 'PRODUCTO_INACTIVO'],
    ['cantidad 0', [{ id_producto: 5, cantidad: 0 }], 'Pagado', 'CANTIDAD_INVALIDA'],
    ['cantidad -1', [{ id_producto: 5, cantidad: -1 }], 'Pagado', 'CANTIDAD_INVALIDA'],
    ['cantidad 100', [{ id_producto: 5, cantidad: 100 }], 'Pagado', 'CANTIDAD_INVALIDA'],
    ['cantidad 1.5', [{ id_producto: 5, cantidad: 1.5 }], 'Pagado', 'CANTIDAD_INVALIDA'],
    ['cantidad como texto', [{ id_producto: 5, cantidad: '2' }], 'Pagado', 'CANTIDAD_INVALIDA'],
    ['repetidos que suman más de 99', [{ id_producto: 5, cantidad: 60 }, { id_producto: 5, cantidad: 40 }], 'Pagado', 'CANTIDAD_INVALIDA'],
    ['id_producto no numérico', [{ id_producto: 'abc', cantidad: 1 }], 'Pagado', 'ITEM_INVALIDO'],
    ['línea que no es objeto', [5], 'Pagado', 'ITEM_INVALIDO'],
    ['carrito vacío', [], 'Pagado', 'CARRITO_VACIO'],
    ['carrito nulo', undefined, 'Pagado', 'CARRITO_VACIO'],
    ['carrito que no es lista', { id_producto: 5, cantidad: 1 }, 'Pagado', 'CARRITO_VACIO'],
    ['más de 50 líneas', Array.from({ length: 51 }, () => ({ id_producto: 5, cantidad: 1 })), 'Pagado', 'CARRITO_DEMASIADO_GRANDE'],
    ['estado inválido', [{ id_producto: 5, cantidad: 1 }], 'Entregado', 'ESTADO_INVALIDO'],
    ['estado nulo', [{ id_producto: 5, cantidad: 1 }], null, 'ESTADO_INVALIDO'],
  ])('%s → %s y no guarda nada', async (_n, items, estado, codigo) => {
    const ventasAntes = await contar(db, 'venta');
    const e = await errorDe(() => registrarVenta(db, 1, items, estado));
    expect(e.code).toBe('P0001');
    expect(e.message).toBe(codigo);
    expect(await contar(db, 'venta')).toBe(ventasAntes);
    expect(await stockDe(db, 5)).toBe(10);
  });

  it('usuario inexistente → USUARIO_NO_EXISTE', async () => {
    const e = await errorDe(() => registrarVenta(db, 424242, [{ id_producto: 5, cantidad: 1 }], 'Pagado'));
    expect(e.message).toBe('USUARIO_NO_EXISTE');
  });

  it("'Fallido' guarda venta y detalle pero no toca el stock (aunque no alcance)", async () => {
    const r = await registrarVenta(db, 1, [{ id_producto: 13, cantidad: 50 }], 'Fallido');
    expect(r.estado).toBe('Fallido');
    const v = await db.query('select estado from public.venta where id_venta = $1', [r.id_venta]);
    expect(v.rows[0].estado).toBe('Fallido');
    expect(Number(await valor(db, 'select count(*) from public.detalle_venta where id_venta = $1', [r.id_venta]))).toBe(1);
    expect(await stockDe(db, 13)).toBe(3);
  });

  it('p_id_usuario NULL → venta anónima con id_usuario NULL', async () => {
    const r = await registrarVenta(db, null, [{ id_producto: 5, cantidad: 1 }], 'Pagado');
    const idUsuario = await valor(db, 'select id_usuario from public.venta where id_venta = $1', [r.id_venta]);
    expect(idUsuario).toBeNull();
  });
});

describe('privilegios de registrar_venta', () => {
  let db;
  beforeEach(async () => { db = await crearBase(); });

  for (const rol of ['anon', 'authenticated']) {
    it(`${rol} NO puede ejecutarla`, async () => {
      await db.exec(`set role ${rol}`);
      const e = await errorDe(() => registrarVenta(db, null, [{ id_producto: 5, cantidad: 1 }], 'Pagado'));
      expect(e.code).toBe('42501'); // permiso denegado
      await db.exec('reset role');
    });
  }

  it('service_role SÍ puede ejecutarla', async () => {
    await db.exec('set role service_role');
    const r = await registrarVenta(db, null, [{ id_producto: 5, cantidad: 1 }], 'Pagado');
    await db.exec('reset role');
    expect(r.estado).toBe('Pagado');
  });

  it('es SECURITY INVOKER y fija search_path', async () => {
    const r = await db.query(
      "select prosecdef, proconfig from pg_proc where oid = 'public.registrar_venta(bigint, jsonb, text)'::regprocedure");
    expect(r.rows[0].prosecdef).toBe(false);
    expect(r.rows[0].proconfig.join(',')).toMatch(/search_path=/);
  });
});

describe('idempotencia y rollback', () => {
  it('aplicar la migración dos veces no falla ni pisa los estados', async () => {
    const db = await crearBase();
    await registrarVenta(db, 1, [{ id_producto: 5, cantidad: 1 }], 'Fallido');
    await db.exec(leer(RUTA_MIGRACION));
    const estados = await db.query("select estado, count(*)::int n from public.venta group by estado order by estado");
    expect(estados.rows).toEqual([{ estado: 'Fallido', n: 1 }, { estado: 'Pagado', n: 2 }]);
    await registrarVenta(db, 1, [{ id_producto: 5, cantidad: 1 }], 'Pagado');
  });

  it('el rollback deshace la migración (y se puede volver a aplicar)', async () => {
    const db = await crearBase();
    await db.exec(leer(RUTA_ROLLBACK));
    const cols = await db.query(
      `select table_name || '.' || column_name c from information_schema.columns
       where table_schema='public' and column_name in ('estado','destacado','model_3d_url')
         and table_name in ('venta','producto')`);
    expect(cols.rows.map((x) => x.c)).toEqual(['producto.estado']); // la columna original sigue
    expect(await valor(db, "select to_regprocedure('public.registrar_venta(bigint, jsonb, text)')")).toBeNull();
    expect(await valor(db, "select to_regclass('public.venta_fecha_idx')")).toBeNull();
    expect(await valor(db, "select count(*)::int from pg_constraint where conname in ('venta_estado_check','producto_stock_no_negativo')")).toBe(0);
    await db.exec(leer(RUTA_ROLLBACK)); // también idempotente
    await db.exec(leer(RUTA_MIGRACION));
    expect(await valor(db, "select to_regprocedure('public.registrar_venta(bigint, jsonb, text)')")).not.toBeNull();
  });
});
