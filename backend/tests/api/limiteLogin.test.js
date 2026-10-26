// Límite de intentos en las rutas de cuenta y tamaño máximo del cuerpo. Contrato:
//  - login, google-login, register, forgot-password y rekognition-login tienen límite por IP
//    (LOGIN_RATE_LIMIT_MAX intentos por ventana): al pasarlo -> 429 en español. Cada ruta lleva su cuenta.
//  - El cuerpo de cualquier petición tiene un tope de 1 MB -> 413 en JSON y en español.
//  - Solo las rutas que reciben imágenes (Face ID y crear producto) aceptan más (hasta 8 MB), y las de
//    administrador comprueban la sesión ANTES de leer el cuerpo grande.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, authAdmin } from '../helpers/cargarServidor.js';
import http from 'node:http';

// POST con http de Node: devuelve { status, body } aunque el servidor responda sin leer todo el cuerpo.
function postCrudo(app, ruta, cuerpo) {
  return new Promise((resolve, reject) => {
    const servidor = app.listen(0, () => {
      const pedido = http.request(
        { port: servidor.address().port, path: ruta, method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(cuerpo) } },
        (res) => {
          let datos = '';
          res.on('data', (c) => (datos += c));
          res.on('end', () => { servidor.close(); resolve({ status: res.statusCode, body: datos }); });
        },
      );
      pedido.on('error', (e) => { servidor.close(); reject(e); });
      pedido.end(cuerpo);
    });
  });
}

const LIMITE = 2;
const RUTAS = ['/api/login', '/api/google-login', '/api/register', '/api/forgot-password', '/api/admin/faceid/rekognition-login'];

describe('límite de intentos en rutas de cuenta', () => {
  const fake = crearFakeSupabase();
  let app;
  beforeAll(() => {
    ({ app } = cargarServidor(fake, { limiteLogin: LIMITE }));
  });

  it.each(RUTAS.map((r) => [r]))(`%s: tras ${LIMITE} intentos responde 429 en español`, async (ruta) => {
    // Cuerpo vacío: la ruta lo rechaza (400/401) sin llegar a servicios externos, pero cuenta como intento.
    for (let i = 0; i < LIMITE; i++) {
      const res = await request(app).post(ruta).send({});
      expect(res.status).not.toBe(429);
    }
    const res = await request(app).post(ruta).send({});
    expect(res.status).toBe(429);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/demasiados intentos/i);
  });

  it('el límite no afecta a otras rutas: /api/products sigue respondiendo', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).not.toBe(429);
  });
});

describe('cada ruta de cuenta lleva su propia cuenta de intentos', () => {
  const fake = crearFakeSupabase();
  let app;
  beforeAll(() => {
    ({ app } = cargarServidor(fake, { limiteLogin: LIMITE }));
  });

  it('agotar /api/login no bloquea /api/register', async () => {
    for (let i = 0; i <= LIMITE; i++) await request(app).post('/api/login').send({});
    expect((await request(app).post('/api/login').send({})).status).toBe(429);
    expect((await request(app).post('/api/register').send({})).status).not.toBe(429);
  });
});

describe('tamaño máximo del cuerpo', () => {
  const fake = crearFakeSupabase();
  let app;
  beforeAll(() => {
    ({ app } = cargarServidor(fake));
  });

  const MB = 1024 * 1024;
  const texto = (bytes) => 'a'.repeat(bytes);

  it('JSON de más de 1 MB en /api/login -> 413 en JSON y en español', async () => {
    const res = await request(app).post('/api/login').send({ email: 'a@example.com', password: texto(1.5 * MB) });
    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/demasiado grande/i);
  });

  it('formulario (urlencoded) de más de 1 MB -> 413', async () => {
    const res = await request(app)
      .post('/api/forgot-password')
      .type('form')
      .send(`email=${texto(1.5 * MB)}`);
    expect(res.status).toBe(413);
  });

  it('JSON de más de 1 MB en PUT /api/users/:id -> 413', async () => {
    const res = await request(app).put('/api/users/10').send({ name: 'Ana', email: 'ana@example.com', picture: texto(1.5 * MB) });
    expect(res.status).toBe(413);
  });

  it('una foto de 3 MB en rekognition-login sí se acepta (no 413)', async () => {
    const res = await request(app).post('/api/admin/faceid/rekognition-login').send({ image: texto(3 * MB) });
    expect(res.status).not.toBe(413);
  });

  it('más de 8 MB en rekognition-login -> 413', async () => {
    const res = await request(app).post('/api/admin/faceid/rekognition-login').send({ image: texto(9 * MB) });
    expect(res.status).toBe(413);
  });

  // Con supertest, una respuesta que llega antes de terminar de subir el cuerpo corta la conexión
  // (ECONNRESET), así que esta prueba usa http de Node directamente. Se mandan 9 MB: si el cuerpo se
  // leyera antes de mirar la sesión, la respuesta sería 413; debe ser 401.
  it('crear producto con 9 MB sin sesión -> 401, no 413 (la sesión se mira antes de leer el cuerpo)', async () => {
    const res = await postCrudo(app, '/api/admin/products', JSON.stringify({ name: 'X', price: 1000, image: texto(9 * MB) }));
    expect(res.status).toBe(401);
  });

  it('crear producto con imagen de 3 MB: admin -> se acepta (no 413)', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set(authAdmin())
      .send({ name: 'Con foto', price: 1000, image: `data:image/png;base64,${texto(3 * MB)}` });
    expect(res.status).not.toBe(413);
  });
});
