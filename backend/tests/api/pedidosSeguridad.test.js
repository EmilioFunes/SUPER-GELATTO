// Seguridad de pedidos y rutas relacionadas. Contrato:
//  - GET /api/orders/:userId: sesión obligatoria (401); solo el dueño o un admin (403). Lee de la base
//    con columnas concretas y paginado (limit/offset, máximo 50). Si la base falla -> 500 { ok:false }.
//  - POST /api/orders y POST /api/sales ya no existen (ninguna pantalla las usaba): las ventas se
//    registran solo con registrar_venta desde /api/payments/process.
//  - GET /api/admin/products/:id/model-3d es de administrador (escribe en la base y usa la llave de Tripo).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, tokenPrueba, authAdmin } from '../helpers/cargarServidor.js';

const fake = crearFakeSupabase();
let app;

const sesion = (id, rol = 'cliente') => ({ Authorization: `Bearer ${tokenPrueba({ id_usuario: id, email: `u${id}@example.com`, rol })}` });
const VENTAS = [
  { id_venta: 2, fecha: '2026-10-02T10:00:00Z', total: 9000, estado: 'Pagado' },
  { id_venta: 1, fecha: '2026-10-01T10:00:00Z', total: 5000, estado: 'Entregado' },
];

beforeAll(() => {
  ({ app } = cargarServidor(fake));
});
beforeEach(() => {
  fake.reiniciar();
  fake.responder('venta', 'select', { data: VENTAS, error: null });
});

const consultaVentas = () => fake.consultas('venta', 'select');
const filtro = (llamada, nombre) => llamada.filtros.find((f) => f[0] === nombre);

describe('GET /api/orders/:userId', () => {
  it('sin token -> 401 y no consulta la base', async () => {
    const res = await request(app).get('/api/orders/10');
    expect(res.status).toBe(401);
    expect(consultaVentas()).toHaveLength(0);
  });

  it('pedidos de OTRO usuario -> 403', async () => {
    const res = await request(app).get('/api/orders/10').set(sesion(40));
    expect(res.status).toBe(403);
    expect(consultaVentas()).toHaveLength(0);
  });

  it('sus propios pedidos -> 200 con la lista, filtrada por su id', async () => {
    const res = await request(app).get('/api/orders/10').set(sesion(10));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(VENTAS);
    const [consulta] = consultaVentas();
    expect(consulta.filtros).toContainEqual(['eq', 'id_usuario', 10]);
  });

  it('pide columnas concretas (no select *)', async () => {
    const selects = [];
    fake.reiniciar();
    fake.responder('venta', 'select', (llamada) => (selects.push(llamada), { data: [], error: null }));
    await request(app).get('/api/orders/10').set(sesion(10));
    expect(selects).toHaveLength(1);
    expect(selects[0].columnas).toBe('id_venta, fecha, total, estado');
  });

  it('paginado por defecto: primeros 50 (range 0-49)', async () => {
    await request(app).get('/api/orders/10').set(sesion(10));
    expect(filtro(consultaVentas()[0], 'range')).toEqual(['range', 0, 49]);
  });

  it('limit y offset de la URL, con tope de 50', async () => {
    await request(app).get('/api/orders/10?limit=10&offset=20').set(sesion(10));
    expect(filtro(consultaVentas()[0], 'range')).toEqual(['range', 20, 29]);

    fake.reiniciar();
    fake.responder('venta', 'select', { data: [], error: null });
    await request(app).get('/api/orders/10?limit=5000').set(sesion(10));
    expect(filtro(consultaVentas()[0], 'range')).toEqual(['range', 0, 49]);
  });

  it.each([['limit=abc'], ['limit=-1'], ['offset=-5'], ['offset=1.5']])('paginación inválida (%s) -> 400', async (q) => {
    const res = await request(app).get(`/api/orders/10?${q}`).set(sesion(10));
    expect(res.status).toBe(400);
  });

  it('id que no es número -> 400', async () => {
    const res = await request(app).get('/api/orders/abc').set(authAdmin());
    expect(res.status).toBe(400);
  });

  it('un admin puede ver los pedidos de un cliente -> 200', async () => {
    const res = await request(app).get('/api/orders/10').set(authAdmin());
    expect(res.status).toBe(200);
  });

  it('si la base falla -> 500 ok:false (no una lista vacía)', async () => {
    fake.reiniciar();
    fake.responder('venta', 'select', { data: null, error: { message: 'caída' } });
    const res = await request(app).get('/api/orders/10').set(sesion(10));
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});

describe('rutas de ventas paralelas eliminadas', () => {
  it.each([['/api/orders'], ['/api/sales']])('POST %s -> 404 y no guarda nada', async (ruta) => {
    const res = await request(app)
      .post(ruta)
      .set(sesion(10))
      .send({ userId: 10, total: 1, items: [{ name: 'Gelato', quantity: 99 }] });
    expect(res.status).toBe(404);
    expect(fake.consultas('venta', 'insert')).toHaveLength(0);
  });
});

describe('GET /api/admin/products/:id/model-3d', () => {
  it('sin token -> 401', async () => {
    const res = await request(app).get('/api/admin/products/5/model-3d');
    expect(res.status).toBe(401);
  });

  it('token de cliente -> 403', async () => {
    const res = await request(app).get('/api/admin/products/5/model-3d').set(sesion(10));
    expect(res.status).toBe(403);
  });

  it('admin -> 200', async () => {
    const res = await request(app).get('/api/admin/products/5/model-3d').set(authAdmin());
    expect(res.status).toBe(200);
  });
});
