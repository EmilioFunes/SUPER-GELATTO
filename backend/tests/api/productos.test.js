// Rutas de administrador de productos. Contrato deseado:
//  - Solo se usan columnas que existen en la base (producto.stock, producto.destacado, producto.model_3d_url;
//    NUNCA stock_disponible ni un id_producto calculado a mano).
//  - Si la base devuelve error (supabase-js no lanza, devuelve { data, error }) la ruta responde 500;
//    nunca "éxito" silencioso.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, authAdmin } from '../helpers/cargarServidor.js';

const fake = crearFakeSupabase();
let app;
const ERROR_BASE = { data: null, error: { code: '42501', message: 'permission denied for table producto' } };
const primera = (llamada) => [].concat(llamada.payload)[0];

beforeAll(() => {
  ({ app } = cargarServidor(fake));
});
beforeEach(() => fake.reiniciar());

const put = (url, body) => request(app).put(url).set(authAdmin()).send(body);
const post = (url, body) => request(app).post(url).set(authAdmin()).send(body);

describe('arnés: rutas de administrador', () => {
  it('sin token -> 401 (no se usa la puerta trasera x-user-role)', async () => {
    const res = await request(app).put('/api/admin/products/5/stock').set('x-user-role', 'admin').send({ stock: 1 });
    expect(res.status).toBe(401);
  });
});

describe('g. POST /api/admin/products (crear producto)', () => {
  const nuevo = { name: 'Helado de prueba', price: 5000, category: 'Clásico', stock: 20, featured: true };

  it('inserta sin id_producto ni stock_disponible, con destacado y stock', async () => {
    const res = await post('/api/admin/products', nuevo);

    const inserts = fake.consultas('producto', 'insert');
    expect(inserts).toHaveLength(1);
    const fila = primera(inserts[0]);
    expect(fila).not.toHaveProperty('id_producto');
    expect(fila).not.toHaveProperty('stock_disponible');
    expect(fila).toMatchObject({ nombre: 'Helado de prueba', precio: 5000, destacado: true, stock: 20 });
    expect(fake.errores).toEqual([]); // la base real no rechazó ninguna columna
    expect(res.status).toBe(201);
  });

  it('si la base devuelve error -> 500 (no éxito)', async () => {
    fake.responder('producto', 'insert', ERROR_BASE);

    const res = await post('/api/admin/products', nuevo);

    expect(res.status).toBe(500);
    expect(res.body.ok).not.toBe(true);
  });
});

describe('h. PUT /api/admin/products/:id/featured', () => {
  it('actualiza solo { destacado } del producto', async () => {
    const res = await put('/api/admin/products/5/featured', { destacado: true });

    const ups = fake.consultas('producto', 'update');
    expect(ups).toHaveLength(1);
    expect(ups[0].payload).toEqual({ destacado: true });
    expect(ups[0].filtros).toContainEqual(['eq', 'id_producto', 5]);
    expect(res.status).toBe(200);
  });

  it('si la base devuelve error -> 500', async () => {
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/5/featured', { destacado: true });

    expect(res.status).toBe(500);
    expect(res.body.ok).not.toBe(true);
  });
});

describe('i. PUT /api/admin/products/:id/stock', () => {
  it('actualiza solo { stock } (sin stock_disponible)', async () => {
    const res = await put('/api/admin/products/5/stock', { stock: 7 });

    const ups = fake.consultas('producto', 'update');
    expect(ups).toHaveLength(1);
    expect(ups[0].payload).toEqual({ stock: 7 });
    expect(fake.errores).toEqual([]);
    expect(res.status).toBe(200);
    expect(res.body.stock).toBe(7);
  });

  it('si la base devuelve error -> 500', async () => {
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/5/stock', { stock: 7 });

    expect(res.status).toBe(500);
    expect(res.body.ok).not.toBe(true);
  });
});

describe('j. precio y categoría', () => {
  it('precio: actualiza { precio }', async () => {
    const res = await put('/api/admin/products/5/price', { precio: 3000 });

    expect(fake.consultas('producto', 'update')[0].payload).toEqual({ precio: 3000 });
    expect(res.status).toBe(200);
  });

  it('precio: error de base -> 500', async () => {
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/5/price', { precio: 3000 });

    expect(res.status).toBe(500);
    expect(res.body.ok).not.toBe(true);
  });

  it('categoría: actualiza { categoria }', async () => {
    const res = await put('/api/admin/products/5/category', { categoria: 'Vegano' });

    expect(fake.consultas('producto', 'update')[0].payload).toEqual({ categoria: 'Vegano' });
    expect(res.status).toBe(200);
  });

  it('categoría: error de base -> 500', async () => {
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await put('/api/admin/products/5/category', { categoria: 'Vegano' });

    expect(res.status).toBe(500);
    expect(res.body.ok).not.toBe(true);
  });
});

// k. model_3d_url se guarda al consultar GET /api/admin/products/:id/model-3d cuando Tripo3D
// ya terminó. Se simula Tripo3D con un fetch falso (global) y se crea antes un producto con
// prompt para que exista la tarea en el estado en memoria del servidor.
describe('k. guardar model_3d_url (GET /api/admin/products/:id/model-3d)', () => {
  const MODELO = 'https://tripo.test/modelo.glb';

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => ({
        ok: true,
        json: async () =>
          String(url).endsWith('/task')
            ? { code: 0, data: { task_id: 'T-1' } }
            : { code: 0, data: { status: 'success', progress: 100, output: { model: MODELO } } },
      })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  async function productoConTarea3D() {
    const res = await post('/api/admin/products', { name: 'Con 3D', price: 4000, prompt3d: 'cono de helado' });
    expect(res.status).toBe(201);
    fake.llamadas.length = 0;
    fake.errores.length = 0; // los errores de la creación no cuentan para esta prueba
    return res.body.product.id;
  }

  it('guarda { model_3d_url } en producto', async () => {
    const id = await productoConTarea3D();

    const res = await request(app).get(`/api/admin/products/${id}/model-3d`).set(authAdmin());

    const ups = fake.consultas('producto', 'update');
    expect(ups).toHaveLength(1);
    expect(ups[0].payload).toEqual({ model_3d_url: MODELO });
    expect(fake.errores).toEqual([]);
    expect(res.body.estado).toBe('listo');
  });

  it('si la base devuelve error -> error (no "listo" silencioso)', async () => {
    const id = await productoConTarea3D();
    fake.responder('producto', 'update', ERROR_BASE);

    const res = await request(app).get(`/api/admin/products/${id}/model-3d`).set(authAdmin());

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.estado).not.toBe('listo');
  });
});
