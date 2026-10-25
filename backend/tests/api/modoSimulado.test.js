// 2. Sin SUPABASE_URL el servidor usa su base simulada (mockDb). El pago debe seguir funcionando
// con la misma forma de respuesta que la función real registrar_venta, y total calculado en el servidor.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { cargarServidor } from '../helpers/cargarServidor.js';

let app;
beforeAll(() => {
  ({ app } = cargarServidor(null, { sinSupabase: true }));
});
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.1); // siempre aprobado
  const original = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...a) => original(fn, ms >= 1000 ? 0 : ms, ...a));
});
afterEach(() => {
  vi.mocked(Math.random).mockRestore();
  vi.mocked(globalThis.setTimeout).mockRestore();
});

const pagar = (items, extra = {}) =>
  request(app).post('/api/payments/process').send({ method: 'NEQUI', bank: 'Nequi', items, amount: 1, ...extra });

describe('modo simulado (sin Supabase): registrar_venta', () => {
  it('calcula el total con el catálogo local e ignora el precio del cliente', async () => {
    const res = await pagar([
      { id: 1, quantity: 2, price: 1 }, // Fresa Salvaje 12500 x 2
      { id: 2, quantity: 1, price: 1 }, // Cioccolato Nero 13000
    ]);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.total).toBe(38000);
    expect(res.body.id_venta).toBeTruthy();
    expect(res.body.transaction.amount).toBe(38000);
    expect(res.body.transaction.items).toHaveLength(2);
    expect(res.body.transaction.items[0]).toMatchObject({ name: 'Fresa Salvaje', quantity: 2, price: 12500, subtotal: 25000 });
  });

  it('producto que no existe -> 400, no aprobado', async () => {
    const res = await pagar([{ id: 987654, quantity: 1 }]);

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('pago rechazado por la pasarela -> ok:false', async () => {
    const res = await pagar([{ id: 1, quantity: 1 }], { forceDecline: true });

    expect(res.body.ok).toBe(false);
    expect(res.body.transaction.status).toBe('DECLINED');
  });
});
