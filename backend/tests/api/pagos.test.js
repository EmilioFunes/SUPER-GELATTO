// Contrato deseado de POST /api/payments/process (ver PaymentGateway.jsx para el formato real).
//
// Contrato de respuesta que estas pruebas fijan:
//  - Aprobado:  200 { ok:true,  id_venta, total, transaction:{ status:'APPROVED', amount:total, ... }, message }
//  - Rechazado: 200 { ok:false, transaction:{ status:'DECLINED', ... }, message }  (rpc con p_estado 'Fallido')
//  - Error de la base: ok:false, nunca 'APPROVED'. STOCK_INSUFICIENTE -> 409; PRODUCTO_NO_EXISTE,
//    PRODUCTO_INACTIVO, CANTIDAD_INVALIDA, CARRITO_VACIO, CARRITO_DEMASIADO_GRANDE, ITEM_INVALIDO -> 400;
//    cualquier otro -> 500. El mensaje es una frase en español (no el código crudo).
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor } from '../helpers/cargarServidor.js';

const fake = crearFakeSupabase();
let app;
let esperas; // espía de setTimeout para saber si se llegó a la "pasarela" (espera de 1-2 s)

const VENTA_OK = {
  id_venta: 77,
  total: 27500,
  estado: 'Pagado',
  items: [{ id_producto: 5, nombre: 'Helado de fresa', cantidad: 2, precio_unitario: 12500, subtotal: 25000 }],
};

const cuerpo = (extra = {}) => ({
  method: 'NEQUI',
  bank: 'Nequi',
  // Igual que PaymentGateway.jsx: manda id, id_producto, name, quantity y price.
  items: [{ id: 5, id_producto: 5, name: 'Helado de fresa', quantity: 2, price: 12500 }],
  amount: 25000,
  reference: 'ORD-SG-TEST',
  userId: 3,
  deliveryDetails: {},
  forceDecline: false,
  ...extra,
});

const pagar = (extra) => request(app).post('/api/payments/process').send(cuerpo(extra));
const rpcVenta = () => fake.rpcs('registrar_venta');

beforeAll(() => {
  ({ app } = cargarServidor(fake));
});

beforeEach(() => {
  fake.reiniciar();
  fake.responderRpc('registrar_venta', { data: VENTA_OK, error: null });
  // 10% de rechazo aleatorio: se fija para que siempre sea APROBADO (salvo forceDecline).
  vi.spyOn(Math, 'random').mockReturnValue(0.1);
  // Espera simulada de 1-2 s: se acorta a 0 ms solo para esperas >= 1000 ms, y se cuentan.
  const original = globalThis.setTimeout;
  esperas = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...args) =>
    original(fn, ms >= 1000 ? 0 : ms, ...args),
  );
});

afterEach(() => {
  vi.mocked(Math.random).mockRestore();
  esperas.mockRestore();
});

const pasarelaLlamada = () => esperas.mock.calls.some(([, ms]) => ms >= 1000);

describe('POST /api/payments/process - pago aprobado', () => {
  it('a. registra la venta con rpc registrar_venta (Pagado) y sin insert directo en venta', async () => {
    const res = await pagar();

    expect(rpcVenta()).toHaveLength(1);
    expect(rpcVenta()[0].args).toEqual({
      p_id_usuario: 3,
      p_items: [{ id_producto: 5, cantidad: 2 }],
      p_estado: 'Pagado',
    });
    expect(fake.consultas('venta', 'insert')).toHaveLength(0);
    expect(fake.consultas('detalle_venta')).toHaveLength(0);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id_venta).toBe(77);
    expect(res.body.total).toBe(27500);
    expect(res.body.transaction.status).toBe('APPROVED');
    expect(res.body.transaction.amount).toBe(27500);
  });

  it('b. sin userId manda p_id_usuario null (nunca 1)', async () => {
    const res = await pagar({ userId: undefined });

    expect(rpcVenta()).toHaveLength(1);
    expect(rpcVenta()[0].args.p_id_usuario).toBeNull();
    expect(res.body.ok).toBe(true);
  });

  it('e. ignora el precio y el amount del cliente: el total viene de la base', async () => {
    const res = await pagar({
      amount: 1,
      items: [{ id: 5, id_producto: 5, name: 'Helado de fresa', quantity: 2, price: 1 }],
    });

    expect(rpcVenta()[0].args.p_items).toEqual([{ id_producto: 5, cantidad: 2 }]);
    expect(Object.keys(rpcVenta()[0].args).sort()).toEqual(['p_estado', 'p_id_usuario', 'p_items']);
    expect(res.body.total).toBe(27500);
    expect(res.body.transaction.amount).toBe(27500);
  });

  it('e. acepta el producto solo con "id" (sin id_producto) y cantidad como texto numérico entero', async () => {
    await pagar({ items: [{ id: 5, quantity: '3' }] });

    expect(rpcVenta()[0].args.p_items).toEqual([{ id_producto: 5, cantidad: 3 }]);
  });
});

describe('POST /api/payments/process - pago rechazado', () => {
  it('c. rechazado por la pasarela: rpc con Fallido y la respuesta indica rechazo', async () => {
    fake.responderRpc('registrar_venta', { data: { ...VENTA_OK, estado: 'Fallido' }, error: null });

    const res = await pagar({ forceDecline: true });

    expect(rpcVenta()).toHaveLength(1);
    expect(rpcVenta()[0].args.p_estado).toBe('Fallido');
    expect(fake.consultas('venta', 'insert')).toHaveLength(0);
    expect(res.body.ok).toBe(false);
    expect(res.body.transaction.status).toBe('DECLINED');
  });

  it('c. rechazo aleatorio (Math.random >= 0.9) también registra Fallido', async () => {
    Math.random.mockReturnValue(0.95);

    const res = await pagar();

    expect(rpcVenta()[0].args.p_estado).toBe('Fallido');
    expect(res.body.ok).toBe(false);
  });
});

describe('POST /api/payments/process - errores de la base', () => {
  const casos = [
    ['STOCK_INSUFICIENTE', 409],
    ['PRODUCTO_NO_EXISTE', 400],
    ['PRODUCTO_INACTIVO', 400],
    ['CANTIDAD_INVALIDA', 400],
    ['CARRITO_VACIO', 400],
    ['CARRITO_DEMASIADO_GRANDE', 400],
    ['ITEM_INVALIDO', 400],
    ['USUARIO_NO_EXISTE', 400],
    ['ESTADO_INVALIDO', 500],
    ['ALGO_RARO_DE_POSTGRES', 500],
  ];

  it.each(casos)('d. rpc con error %s -> HTTP %i, sin aprobar, con mensaje en español', async (codigo, http) => {
    fake.responderRpc('registrar_venta', { data: null, error: { code: 'P0001', message: codigo } });

    const res = await pagar();

    expect(res.status).toBe(http);
    expect(res.body.ok).toBe(false);
    expect(res.body.transaction?.status).not.toBe('APPROVED');
    expect(res.body.message).toEqual(expect.any(String));
    expect(res.body.message.length).toBeGreaterThan(10);
    expect(res.body.message).not.toContain(codigo); // frase entendible, no el código crudo
  });

  it('d. error de red/conexión del rpc (sin código) -> 500 y no aprobado', async () => {
    fake.responderRpc('registrar_venta', { data: null, error: { message: 'fetch failed' } });

    const res = await pagar();

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });

  it('d. si el rpc falla en un pago que la pasarela rechazó, tampoco es éxito', async () => {
    fake.responderRpc('registrar_venta', { data: null, error: { message: 'fetch failed' } });

    const res = await pagar({ forceDecline: true });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});

describe('POST /api/payments/process - validación del carrito', () => {
  it.each([
    ['cantidad 0', 0],
    ['cantidad negativa', -3],
    ['cantidad decimal', 1.5],
    ['cantidad mayor a 99', 100],
    ['cantidad no numérica', 'abc'],
  ])('e. %s -> 400, sin rpc y sin pasarela', async (_n, quantity) => {
    const res = await pagar({ items: [{ id: 5, id_producto: 5, quantity, price: 12500 }] });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(rpcVenta()).toHaveLength(0);
    expect(pasarelaLlamada()).toBe(false);
  });

  it('e. producto sin id -> 400', async () => {
    const res = await pagar({ items: [{ quantity: 1, price: 100 }] });

    expect(res.status).toBe(400);
    expect(rpcVenta()).toHaveLength(0);
  });

  it.each([
    ['items vacío', { items: [] }],
    ['sin items', { items: undefined }],
    ['items no es lista', { items: 'pizza' }],
  ])('f. %s (aunque venga amount) -> 400, sin rpc y sin pasarela', async (_n, extra) => {
    const res = await pagar({ ...extra, amount: 25000 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(rpcVenta()).toHaveLength(0);
    expect(pasarelaLlamada()).toBe(false);
  });
});

describe('POST /api/payments/process - respuesta inválida de la base', () => {
  it.each([
    ['lista vacía (como el modo simulado antiguo)', { data: [], error: null }],
    ['objeto sin id_venta', { data: { total: 100, items: [] }, error: null }],
  ])('rpc devuelve %s -> 500 y no aprobado', async (_n, respuesta) => {
    fake.responderRpc('registrar_venta', respuesta);

    const res = await pagar();

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.transaction?.status).not.toBe('APPROVED');
  });
});

describe('POST /api/payments/process - validación de tipos y tamaños', () => {
  it.each([
    ['method es lista', { method: ['pse'] }],
    ['method es objeto', { method: { a: 1 } }],
    ['method es número', { method: 123 }],
    ['bank es objeto', { bank: {} }],
    ['bank es lista', { bank: ['x'] }],
    ['bank es número', { bank: 5 }],
    ['bank de 81 caracteres', { bank: 'b'.repeat(81) }],
    ['reference de 65 caracteres', { reference: 'r'.repeat(65) }],
    ['reference es objeto', { reference: { a: 1 } }],
  ])('%s -> 400, sin rpc y sin pasarela', async (_n, extra) => {
    const res = await pagar(extra);

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(rpcVenta()).toHaveLength(0);
    expect(pasarelaLlamada()).toBe(false);
  });

  it('bank de 80 y reference de 64 caracteres siguen siendo válidos', async () => {
    const res = await pagar({ bank: 'b'.repeat(80), reference: 'r'.repeat(64) });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('POST /api/payments/process - tamaño del carrito', () => {
  const lista = (n) => Array.from({ length: n }, () => ({ id: 5, quantity: 1 }));

  it('más de 50 productos -> 400 antes del rpc', async () => {
    const res = await pagar({ items: lista(51) });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(rpcVenta()).toHaveLength(0);
    expect(pasarelaLlamada()).toBe(false);
  });

  it('exactamente 50 productos es válido', async () => {
    const res = await pagar({ items: lista(50) });

    expect(res.status).toBe(200);
    expect(rpcVenta()).toHaveLength(1);
  });
});

describe('POST /api/payments/process - usuario inexistente', () => {
  it('USUARIO_NO_EXISTE -> mensaje claro para volver a iniciar sesión', async () => {
    fake.responderRpc('registrar_venta', { data: null, error: { code: 'P0001', message: 'USUARIO_NO_EXISTE' } });

    const res = await pagar();

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sesión/i);
  });
});

describe('POST /api/payments/process - orderReference ya no se acepta', () => {
  const guardadas = () => app.locals.getPaymentTransactions();

  it('orderReference gigante u objeto se ignora: la referencia es la generada por el servidor', async () => {
    const res = await pagar({ reference: undefined, orderReference: 'x'.repeat(100000) });
    expect(res.status).toBe(200);
    expect(res.body.transaction.reference).toMatch(/^ORD-SG-/);
    expect(res.body.transaction.reference.length).toBeLessThanOrEqual(64);

    const res2 = await pagar({ reference: undefined, orderReference: { a: 1 } });
    expect(res2.body.transaction.reference).toMatch(/^ORD-SG-/);
  });

  it('el historial de transacciones en memoria conserva solo las últimas 100', async () => {
    for (let i = 0; i < 105; i++) await pagar({ reference: `REF-${i}` });
    expect(guardadas()).toHaveLength(100);
    expect(guardadas().at(-1).reference).toBe('REF-104');
  });
});
