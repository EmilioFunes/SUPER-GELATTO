// Endurecimiento tras las auditorías: ingresos del dashboard, orden "base primero" en rutas de
// producto, e id de producto que SIEMPRE viene de la base.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, authAdmin } from '../helpers/cargarServidor.js';

const fake = crearFakeSupabase();
let app;
let escrituras;
const ERROR_BASE = { data: null, error: { code: '42501', message: 'permission denied for table producto' } };

beforeAll(() => {
  ({ app, escrituras } = cargarServidor(fake));
});
beforeEach(() => {
  fake.reiniciar();
  escrituras.mockClear();
});

const put = (url, body) => request(app).put(url).set(authAdmin()).send(body);
const post = (url, body) => request(app).post(url).set(authAdmin()).send(body);

describe('1. GET /api/admin/dashboard - ingresos solo de ventas cobradas', () => {
  const venta = (id, estado, total) => ({ id_venta: id, id_usuario: 3, total, fecha: '2026-10-01T10:00:00Z', estado });
  const ingresos = async (filas) => {
    fake.reiniciar();
    fake.responder('venta', 'select', { data: filas, error: null });
    const res = await request(app).get('/api/admin/dashboard').set(authAdmin());
    expect(res.status).toBe(200);
    return res.body.stats.totalRevenue;
  };

  it('suma Pagado, En proceso, En entrega, Enviado, Entregado y Completado; excluye Pendiente, Fallido y Cancelado', async () => {
    const base = await ingresos([]); // incluye ventas del archivo de respaldo, si las hay
    const cobradas = [
      venta(9001, 'Pagado', 1000),
      venta(9002, 'En proceso', 2000),
      venta(9003, 'En entrega', 3000),
      venta(9004, 'Enviado', 4000),
      venta(9005, 'Entregado', 5000),
      venta(9006, 'Completado', 6000),
    ];
    const noCobradas = [venta(9007, 'Pendiente', 100000), venta(9008, 'Fallido', 200000), venta(9009, 'Cancelado', 400000)];

    expect(await ingresos([...cobradas, ...noCobradas])).toBe(base + 21000);
  });
});

describe('7. rutas de producto: la base se actualiza primero; si falla, nada cambia (memoria ni disco)', () => {
  const catalogo = async () => {
    // Con la base fallando en select, GET /api/products responde con el catálogo local (memoria).
    fake.responder('producto', 'select', ERROR_BASE);
    const res = await request(app).get('/api/products');
    return res.body.find((p) => p.id === 1);
  };
  const escribioDestacados = () => escrituras.mock.calls.some(([ruta]) => String(ruta).includes('featured_state'));

  it('featured: error de la base -> 500, no escribe featured_state.json y el catálogo no cambia', async () => {
    const antes = await catalogo();
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/1/featured', { destacado: !antes.destacado });

    expect(res.status).toBe(500);
    expect(escribioDestacados()).toBe(false);
    expect((await catalogo()).destacado).toBe(antes.destacado);
  });

  it('featured: base OK -> guarda en disco y el catálogo cambia', async () => {
    const antes = await catalogo();
    fake.responder('producto', 'update', { data: null, error: null });

    const res = await put('/api/admin/products/1/featured', { destacado: !antes.destacado });

    expect(res.status).toBe(200);
    expect(escribioDestacados()).toBe(true);
    expect((await catalogo()).destacado).toBe(!antes.destacado);
  });

  it('precio: error de la base -> el catálogo local conserva el precio', async () => {
    const antes = await catalogo();
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/1/price', { precio: 99999 });

    expect(res.status).toBe(500);
    expect((await catalogo()).precio).toBe(antes.precio);
  });

  it('precio: base OK -> el catálogo local cambia', async () => {
    fake.responder('producto', 'update', { data: null, error: null });
    await put('/api/admin/products/1/price', { precio: 99999 });
    expect((await catalogo()).precio).toBe(99999);
  });

  it('categoría: error de la base -> el catálogo local conserva la categoría', async () => {
    const antes = await catalogo();
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/1/category', { categoria: 'Gourmet' });

    expect(res.status).toBe(500);
    expect((await catalogo()).categoria).toBe(antes.categoria);
  });

  it('categoría: base OK -> el catálogo local cambia', async () => {
    fake.responder('producto', 'update', { data: null, error: null });
    await put('/api/admin/products/1/category', { categoria: 'Gourmet' });
    expect((await catalogo()).categoria).toBe('Gourmet');
  });

  it('stock: error de la base -> el catálogo local conserva el stock', async () => {
    const antes = await catalogo();
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/1/stock', { stock: 3 });

    expect(res.status).toBe(500);
    expect((await catalogo()).stock).toBe(antes.stock);
  });

  it('stock: base OK -> el catálogo local cambia', async () => {
    fake.responder('producto', 'update', { data: null, error: null });
    await put('/api/admin/products/1/stock', { stock: 3 });
    expect((await catalogo()).stock).toBe(3);
  });
});

describe('9. POST /api/admin/products - el id viene siempre de la base', () => {
  const nuevo = { name: 'Helado con id', price: 5000, category: 'Clásico', stock: 20 };

  it('usa el id_producto que devuelve la base (insert ... select().single())', async () => {
    fake.responder('producto', 'insert', (l) => ({ data: { ...[].concat(l.payload)[0], id_producto: 4242 }, error: null }));

    const res = await post('/api/admin/products', nuevo);

    expect(res.status).toBe(201);
    expect(res.body.product.id).toBe(4242);
  });

  it('el fake genera un id_producto como la base real cuando el insert no lo manda', async () => {
    const res = await post('/api/admin/products', nuevo);

    expect(res.status).toBe(201);
    expect(Number.isInteger(res.body.product.id)).toBe(true);
    expect(res.body.product.id).toBeLessThan(1e9); // no es un Date.now()
  });

  it('si la base no devuelve id_producto -> 500 (no se inventa uno)', async () => {
    fake.responder('producto', 'insert', (l) => ({ data: { ...[].concat(l.payload)[0] }, error: null }));

    const res = await post('/api/admin/products', nuevo);

    expect(res.status).toBe(500);
    expect(res.body.ok).not.toBe(true);
  });
});
