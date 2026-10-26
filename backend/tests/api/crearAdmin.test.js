// Seguridad de POST /api/admin/create-admin. Contrato:
//  - Sin sesión -> 401. Admin normal -> 403 (solo el super admin crea administradores).
//  - El correo del super admin nunca se puede crear por aquí (nadie, ni él). Los de ADMIN_EMAILS sí, si crea el super admin.
//  - Valida tipos y largos: nombre 1-100, correo con el validador de /api/register, contraseña 8-128 -> 400.
//  - Correo repetido (sin importar mayúsculas) -> 409. Error de la base -> 500 sin detalles internos.
//  - La respuesta solo trae columnas seguras, nunca password_hash; el id lo asigna la base.
//  - Lleva el límite de intentos de las rutas de cuenta (429).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, tokenPrueba } from '../helpers/cargarServidor.js';

const SUPER = 'jefe@example.com';
const sesion = (u) => ({ Authorization: `Bearer ${tokenPrueba(u)}` });
const SUPER_SESION = sesion({ id_usuario: 1, email: SUPER, rol: 'admin' });
const ADMIN_SESION = sesion({ id_usuario: 2, email: 'admin2@example.com', rol: 'admin' });
const NUEVO = { name: 'Nuevo', lastName: 'Admin', email: 'nuevo@example.com', password: 'Clave123!' };

const fake = crearFakeSupabase();
let app;
beforeAll(() => {
  ({ app } = cargarServidor(fake, { superAdmin: SUPER, adminEmails: 'otro@example.com' }));
});
beforeEach(() => {
  fake.reiniciar();
});
const crear = (cuerpo, cab = SUPER_SESION) => request(app).post('/api/admin/create-admin').set(cab).send(cuerpo);
const inserts = () => fake.consultas('usuario', 'insert');

describe('POST /api/admin/create-admin', () => {
  it('sin sesión -> 401', async () => {
    const res = await request(app).post('/api/admin/create-admin').send(NUEVO);
    expect(res.status).toBe(401);
    expect(inserts()).toHaveLength(0);
  });

  it('admin normal -> 403 en español y no inserta', async () => {
    const res = await crear(NUEVO, ADMIN_SESION);
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/super administrador/i);
    expect(inserts()).toHaveLength(0);
  });

  it('super admin crea admin -> 201, rol admin, sin password_hash ni hash en la respuesta', async () => {
    const res = await crear(NUEVO);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.user).toMatchObject({ nombre: 'Nuevo', email: 'nuevo@example.com', rol: 'admin' });
    expect(res.body.user.id_usuario).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|\$2[aby]\$/i);
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].payload[0].id_usuario).toBeUndefined();
    expect(inserts()[0].payload[0].password_hash).not.toBe('Clave123!');
  });

  it('el correo de ADMIN_EMAILS sí se puede crear si lo hace el super admin', async () => {
    const res = await crear({ ...NUEVO, email: 'otro@example.com' });
    expect(res.status).toBe(201);
  });

  it.each([SUPER, 'JEFE@Example.com', ' jefe@example.com '])('correo del super admin (%s) -> rechazado, no inserta', async (email) => {
    const res = await crear({ ...NUEVO, email });
    expect(res.status).toBe(403);
    expect(res.body.message).not.toMatch(/super/i);
    expect(inserts()).toHaveLength(0);
  });

  it.each([
    ['correo inválido', { email: 'no-es-correo' }],
    ['contraseña corta', { password: '1234567' }],
    ['contraseña larguísima', { password: 'a'.repeat(129) }],
    ['contraseña no es texto', { password: 12345678 }],
    ['nombre vacío', { name: '' }],
    ['nombre largo', { name: 'a'.repeat(101) }],
    ['nombre no es texto', { name: { x: 1 } }],
    ['correo no es texto', { email: ['a@b.com'] }],
    ['apellido no es texto', { lastName: 42 }],
  ])('%s -> 400 y no inserta', async (_c, cambio) => {
    const res = await crear({ ...NUEVO, ...cambio });
    expect(res.status).toBe(400);
    expect(inserts()).toHaveLength(0);
  });

  it('correo ya existente -> 409', async () => {
    fake.responder('usuario', 'select', { data: { id_usuario: 9, email: 'nuevo@example.com' }, error: null });
    const res = await crear(NUEVO);
    expect(res.status).toBe(409);
    expect(inserts()).toHaveLength(0);
  });

  it('la base rechaza por duplicado (23505) -> 409', async () => {
    fake.responder('usuario', 'insert', { data: null, error: { code: '23505', message: 'duplicate key secreto-interno' } });
    const res = await crear(NUEVO);
    expect(res.status).toBe(409);
  });

  it('error de la base -> 500 sin detalles internos', async () => {
    fake.responder('usuario', 'insert', { data: null, error: { code: 'XX000', message: 'detalle-interno-secreto' } });
    const res = await crear(NUEVO);
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/detalle-interno-secreto/);
  });

  it('error al buscar duplicado -> 500, no inserta', async () => {
    fake.responder('usuario', 'select', { data: null, error: { code: 'XX000', message: 'caida' } });
    const res = await crear(NUEVO);
    expect(res.status).toBe(500);
    expect(inserts()).toHaveLength(0);
  });
});

describe('POST /api/admin/create-admin: límite de intentos', () => {
  it('pasado el tope -> 429 en español', async () => {
    const f = crearFakeSupabase();
    const { app: a } = cargarServidor(f, { superAdmin: SUPER, limiteLogin: 2 });
    const r = () => request(a).post('/api/admin/create-admin').set(SUPER_SESION).send({ ...NUEVO, password: 'corta' });
    await r(); await r();
    const res = await r();
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/intentos/i);
  });
});
