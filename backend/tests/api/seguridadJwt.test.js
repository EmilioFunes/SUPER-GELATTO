// Seguridad de las sesiones (JWT) y de las rutas de administrador. Contrato:
//  - Un único secreto: process.env.JWT_SECRET. Nada de secretos de respaldo escritos en el código.
//  - Solo HS256: un token con otro algoritmo (HS512, none) se rechaza aunque use el mismo secreto.
//  - En producción (NODE_ENV=production o RENDER) el servidor no arranca sin JWT_SECRET o con uno corto.
//  - requireAdmin exige rol admin en un token válido; el correo del token no da permisos por sí solo.
//  - La cabecera x-user-role nunca da acceso.
//  - Los correos de administradores salen de variables de entorno y no aparecen en los mensajes.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, JWT_SECRET_PRUEBA } from '../helpers/cargarServidor.js';

const RUTA_ADMIN = '/api/admin/products/5/stock';
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const firmar = (payload, secreto = JWT_SECRET_PRUEBA, opciones = {}) =>
  jwt.sign(payload, secreto, { algorithm: 'HS256', expiresIn: '1h', ...opciones });

afterEach(() => {
  delete process.env.RENDER;
});

describe('verificación del token', () => {
  const fake = crearFakeSupabase();
  let app;
  beforeAll(() => {
    ({ app } = cargarServidor(fake, { adminEmails: 'jefe@example.com' }));
  });
  beforeEach(() => fake.reiniciar());

  it('token admin firmado con JWT_SECRET (HS256) -> pasa el control de admin', async () => {
    const res = await request(app).put(RUTA_ADMIN).set(bearer(firmar({ id_usuario: 1, rol: 'admin' }))).send({ stock: 3 });
    expect([401, 403]).not.toContain(res.status);
  });

  it('token admin firmado con OTRO secreto -> 401', async () => {
    const otro = crypto.randomBytes(48).toString('hex');
    const res = await request(app).put(RUTA_ADMIN).set(bearer(firmar({ id_usuario: 1, rol: 'admin' }, otro))).send({ stock: 3 });
    expect(res.status).toBe(401);
  });

  it('token con algoritmo HS512 (mismo secreto) -> 401', async () => {
    const token = firmar({ id_usuario: 1, rol: 'admin' }, JWT_SECRET_PRUEBA, { algorithm: 'HS512' });
    const res = await request(app).put(RUTA_ADMIN).set(bearer(token)).send({ stock: 3 });
    expect(res.status).toBe(401);
  });

  it('token sin firma (alg none) -> 401', async () => {
    const token = jwt.sign({ id_usuario: 1, rol: 'admin' }, null, { algorithm: 'none' });
    const res = await request(app).put(RUTA_ADMIN).set(bearer(token)).send({ stock: 3 });
    expect(res.status).toBe(401);
  });

  it('token vencido -> 401', async () => {
    const token = jwt.sign({ id_usuario: 1, rol: 'admin', exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET_PRUEBA, { algorithm: 'HS256' });
    const res = await request(app).put(RUTA_ADMIN).set(bearer(token)).send({ stock: 3 });
    expect(res.status).toBe(401);
  });

  it('token válido de cliente cuyo correo está en ADMIN_EMAILS -> 403 (el correo no da permisos)', async () => {
    const token = firmar({ id_usuario: 9, email: 'jefe@example.com', rol: 'cliente' });
    const res = await request(app).put(RUTA_ADMIN).set(bearer(token)).send({ stock: 3 });
    expect(res.status).toBe(403);
    expect(fake.consultas('producto', 'update')).toHaveLength(0);
  });

  it('token de cliente + cabecera x-user-role: admin -> 403', async () => {
    const token = firmar({ id_usuario: 9, email: 'cliente@example.com', rol: 'cliente' });
    const res = await request(app).put(RUTA_ADMIN).set(bearer(token)).set('x-user-role', 'admin').send({ stock: 3 });
    expect(res.status).toBe(403);
  });
});

describe('cabecera x-user-role', () => {
  it('ni con SIMULATION_MODE=true da acceso sin token -> 401', async () => {
    const fake = crearFakeSupabase();
    const { app } = cargarServidor(fake, { simulacion: true });
    const res = await request(app).put(RUTA_ADMIN).set('x-user-role', 'admin').set('x-user-id', '1').send({ stock: 3 });
    expect(res.status).toBe(401);
    expect(fake.consultas('producto', 'update')).toHaveLength(0);
  });
});

describe('arranque según JWT_SECRET', () => {
  const fake = { client: {} };

  it('producción sin JWT_SECRET -> no arranca, mensaje claro', () => {
    expect(() => cargarServidor(fake, { produccion: true, jwtSecret: '' })).toThrow(/JWT_SECRET/);
  });

  it('producción con JWT_SECRET de menos de 32 caracteres -> no arranca', () => {
    expect(() => cargarServidor(fake, { produccion: true, jwtSecret: 'x'.repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it('en Render sin JWT_SECRET -> no arranca', () => {
    expect(() => cargarServidor(fake, { render: true, jwtSecret: '' })).toThrow(/JWT_SECRET/);
  });

  it('producción con JWT_SECRET de 32+ caracteres -> arranca', () => {
    expect(() => cargarServidor(fake, { produccion: true, jwtSecret: 'y'.repeat(32) })).not.toThrow();
  });

  it('producción sin GOOGLE_CLIENT_ID -> arranca, pero lo advierte en el log', () => {
    expect(() => cargarServidor(fake, { produccion: true, googleClientId: '' })).not.toThrow();
    const avisos = console.warn.mock.calls.map((a) => a.join(' ')).join('\n');
    expect(avisos).toMatch(/GOOGLE_CLIENT_ID/);
  });

  it('desarrollo sin JWT_SECRET -> arranca con un secreto aleatorio (no uno fijo)', async () => {
    const fakeDb = crearFakeSupabase();
    const { app } = cargarServidor(fakeDb, { jwtSecret: '' });
    // Un token firmado con cualquier secreto conocido (aquí, el de pruebas) no sirve.
    const res = await request(app).put(RUTA_ADMIN).set(bearer(firmar({ id_usuario: 1, rol: 'admin' }))).send({ stock: 3 });
    expect(res.status).toBe(401);
  });
});

describe('super administrador desde SUPER_ADMIN_EMAIL', () => {
  const objetivoAdmin = { id_usuario: 50, nombre: 'Otro', email: 'otro.admin@example.com', rol: 'admin' };
  const responderUsuarios = (fake) =>
    fake.responder('usuario', 'select', (llamada) => {
      const id = llamada.filtros.find((f) => f[0] === 'eq' && f[1] === 'id_usuario')?.[2];
      return { data: String(id) === '50' ? objetivoAdmin : null, error: null };
    });

  it('SUPER_ADMIN_EMAIL configurado: ese correo (rol admin) puede eliminar a otro admin', async () => {
    const fake = crearFakeSupabase();
    const { app } = cargarServidor(fake, { superAdmin: 'Jefe@Example.com' });
    responderUsuarios(fake);
    const token = firmar({ id_usuario: 1, email: 'jefe@example.com', rol: 'admin' });
    const res = await request(app).delete('/api/admin/users/50').set(bearer(token));
    expect(res.status).toBe(200);
    expect(fake.consultas('usuario', 'delete')).toHaveLength(1);
  });

  it('SUPER_ADMIN_EMAIL vacío: un token admin SIN correo no cuenta como super admin', async () => {
    const fake = crearFakeSupabase();
    const { app } = cargarServidor(fake, { superAdmin: '' });
    responderUsuarios(fake);
    const token = firmar({ id_usuario: 1, rol: 'admin' });
    const res = await request(app).delete('/api/admin/users/50').set(bearer(token));
    expect(res.status).toBe(403);
    expect(fake.consultas('usuario', 'delete')).toHaveLength(0);
  });

  it('el mensaje al bajar de rol a un admin no revela ningún correo', async () => {
    const fake = crearFakeSupabase();
    const { app } = cargarServidor(fake, { superAdmin: 'jefe@example.com' });
    responderUsuarios(fake);
    const token = firmar({ id_usuario: 2, email: 'admin.normal@example.com', rol: 'admin' });
    const res = await request(app).put('/api/admin/users/50/role').set(bearer(token)).send({ rol: 'cliente' });
    expect(res.status).toBe(403);
    expect(res.body.message).not.toMatch(/@/);
    expect(fake.consultas('usuario', 'update')).toHaveLength(0);
  });
});

describe('GET /api/admin/dashboard: el panel sabe quién es super admin sin correos en el frontend', () => {
  it('marca es_super_admin en la lista de usuarios y soySuperAdmin para quien consulta', async () => {
    const fake = crearFakeSupabase();
    const { app } = cargarServidor(fake, { superAdmin: 'jefe@example.com' });
    const usuarios = [
      { id_usuario: 1, nombre: 'Jefe', apellido: '', email: 'Jefe@Example.com', rol: 'admin' },
      { id_usuario: 2, nombre: 'Ana', apellido: '', email: 'ana@example.com', rol: 'cliente' },
    ];
    fake.responder('usuario', 'select', { data: usuarios, error: null });
    fake.responder('venta', 'select', { data: [], error: null });

    const comoJefe = await request(app).get('/api/admin/dashboard').set(bearer(firmar({ id_usuario: 1, email: 'jefe@example.com', rol: 'admin' })));
    expect(comoJefe.status).toBe(200);
    expect(comoJefe.body.soySuperAdmin).toBe(true);
    expect(comoJefe.body.users.map((u) => u.es_super_admin)).toEqual([true, false]);

    const comoOtro = await request(app).get('/api/admin/dashboard').set(bearer(firmar({ id_usuario: 3, email: 'otro@example.com', rol: 'admin' })));
    expect(comoOtro.body.soySuperAdmin).toBe(false);
  });
});
