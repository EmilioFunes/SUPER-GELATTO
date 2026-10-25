// l. PUT /api/admin/sales/:id/status debe aceptar exactamente los estados del CHECK de la base
// (migración 20261025120000: venta_estado_check) y devolver 500 si la base falla.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, authAdmin } from '../helpers/cargarServidor.js';

const ESTADOS_BASE = [
  'Pendiente', 'Pagado', 'Fallido', 'En proceso', 'En entrega',
  'Enviado', 'Entregado', 'Completado', 'Cancelado',
];

const fake = crearFakeSupabase();
let app;
const cambiar = (id, estado) => request(app).put(`/api/admin/sales/${id}/status`).set(authAdmin()).send({ estado });

beforeAll(() => {
  ({ app } = cargarServidor(fake));
});
beforeEach(() => fake.reiniciar());

describe('PUT /api/admin/sales/:id/status', () => {
  it.each(ESTADOS_BASE)('acepta el estado "%s" y actualiza venta.estado', async (estado) => {
    const res = await cambiar(15, estado);

    expect(res.status).toBe(200);
    const ups = fake.consultas('venta', 'update');
    expect(ups).toHaveLength(1);
    expect(ups[0].payload).toEqual({ estado });
    expect(ups[0].filtros).toContainEqual(['eq', 'id_venta', '15']);
  });

  it.each(['Reembolsado', 'pagado', 'ENTREGADO', '', 'Entregado; drop table venta'])(
    'rechaza el estado %j con 400 y sin tocar la base',
    async (estado) => {
      const res = await cambiar(15, estado);

      expect(res.status).toBe(400);
      expect(fake.consultas('venta', 'update')).toHaveLength(0);
    },
  );

  it('si la base devuelve error -> 500 (no éxito)', async () => {
    fake.responder('venta', 'update', {
      data: null,
      error: { code: '23514', message: 'new row violates check constraint "venta_estado_check"' },
    });

    const res = await cambiar(15, 'Enviado');

    expect(res.status).toBe(500);
    expect(res.body.estado).not.toBe('Enviado');
  });
});
