// Correos reservados de administradores (ADMIN_EMAILS y SUPER_ADMIN_EMAIL, de entorno). Contrato:
//  - POST /api/register con uno de esos correos (sin distinguir mayúsculas) -> 403 con un mensaje
//    genérico que NO revela que es un correo de admin, y no se inserta nada.
//  - POST /api/google-login: si una cuenta existente con correo de ADMIN_EMAILS tiene rol 'cliente' en
//    la base (se creó con contraseña o con Google, no por los scripts de admin) y se eleva a admin con
//    Google verificado, su contraseña se invalida (hash aleatorio): solo podrá entrar con Google.
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, GOOGLE_CLIENT_ID_PRUEBA } from '../helpers/cargarServidor.js';

const CLAVE = 'Clave123!';
const CREDENCIAL = 'credencial-google-de-prueba';
const ENTORNO = { adminEmails: ' otra@example.com , Jefe@Example.com ', superAdmin: ' Principal@Example.com ' };

const registro = (app, email) =>
  request(app).post('/api/register').send({ name: 'Ana', lastName: 'Perez', email, password: CLAVE, confirmPassword: CLAVE });

function verificadorDe(email) {
  return async ({ idToken, audience }) => {
    if (idToken !== CREDENCIAL || audience !== GOOGLE_CLIENT_ID_PRUEBA) throw new Error('Invalid token signature');
    return { email, email_verified: true, name: 'Jefe' };
  };
}

let fake;
beforeEach(() => {
  fake = crearFakeSupabase();
});

describe('POST /api/register: correos reservados de administradores', () => {
  it.each([
    ['de ADMIN_EMAILS', 'jefe@example.com'],
    ['de ADMIN_EMAILS con otras mayúsculas', 'JEFE@example.COM'],
    ['del super admin', 'principal@example.com'],
    ['del super admin con mayúsculas', 'PRINCIPAL@Example.com'],
  ])('correo %s -> 403 genérico y no se crea la cuenta', async (_caso, email) => {
    const { app } = cargarServidor(fake, ENTORNO);
    const res = await registro(app, email);

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe('No se puede registrar con ese correo.');
    expect(res.body.message).not.toMatch(/admin/i);
    expect(fake.consultas('usuario', 'insert')).toHaveLength(0);
  });

  it('correo reservado con espacios alrededor -> no se crea la cuenta', async () => {
    const { app } = cargarServidor(fake, ENTORNO);
    const res = await registro(app, '  jefe@example.com ');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fake.consultas('usuario', 'insert')).toHaveLength(0);
  });

  it('correo normal -> se registra como siempre (201)', async () => {
    const { app } = cargarServidor(fake, ENTORNO);
    const res = await registro(app, 'ana@example.com');
    expect(res.status).toBe(201);
    expect(fake.consultas('usuario', 'insert')).toHaveLength(1);
  });

  it('sin ADMIN_EMAILS ni SUPER_ADMIN_EMAIL configurados -> ningún correo queda reservado', async () => {
    const { app } = cargarServidor(fake);
    const res = await registro(app, 'jefe@example.com');
    expect(res.status).toBe(201);
  });
});

describe('POST /api/google-login: la cuenta de admin elevada pierde la contraseña', () => {
  const HASH_VIEJO = bcrypt.hashSync(CLAVE, 4);

  function responderUsuario(fila) {
    fake.responder('usuario', 'select', { data: fila, error: null });
  }

  it('cuenta existente con rol cliente y correo de ADMIN_EMAILS -> se reemplaza su contraseña y entra como admin', async () => {
    const { app } = cargarServidor(fake, { ...ENTORNO, verificadorGoogle: verificadorDe('jefe@example.com') });
    responderUsuario({ id_usuario: 7, nombre: 'Jefe', email: 'jefe@example.com', rol: 'cliente' });
    const res = await request(app).post('/api/google-login').send({ credential: CREDENCIAL });

    expect(res.status).toBe(200);
    expect(res.body.user.rol).toBe('admin');
    const updates = fake.consultas('usuario', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].filtros).toContainEqual(['eq', 'id_usuario', 7]);
    expect(Object.keys(updates[0].payload)).toEqual(['password_hash']);
    const nuevo = updates[0].payload.password_hash;
    expect(nuevo).toMatch(/^\$2[aby]\$/);
    expect(nuevo).not.toBe(HASH_VIEJO);
    expect(await bcrypt.compare(CLAVE, nuevo)).toBe(false);
  });

  it('si falla guardar la nueva contraseña -> 500 y sin sesión', async () => {
    const { app } = cargarServidor(fake, { ...ENTORNO, verificadorGoogle: verificadorDe('jefe@example.com') });
    responderUsuario({ id_usuario: 7, nombre: 'Jefe', email: 'jefe@example.com', rol: 'cliente' });
    fake.responder('usuario', 'update', { data: null, error: { message: 'fallo de red' } });
    const res = await request(app).post('/api/google-login').send({ credential: CREDENCIAL });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.token).toBeUndefined();
  });

  it('cuenta que ya es admin en la base -> conserva su contraseña', async () => {
    const { app } = cargarServidor(fake, { ...ENTORNO, verificadorGoogle: verificadorDe('jefe@example.com') });
    responderUsuario({ id_usuario: 7, nombre: 'Jefe', email: 'jefe@example.com', rol: 'admin' });
    const res = await request(app).post('/api/google-login').send({ credential: CREDENCIAL });

    expect(res.status).toBe(200);
    expect(fake.consultas('usuario', 'update')).toHaveLength(0);
  });

  it('cliente normal (correo no reservado) -> no se toca su contraseña', async () => {
    const { app } = cargarServidor(fake, { ...ENTORNO, verificadorGoogle: verificadorDe('ana@example.com') });
    responderUsuario({ id_usuario: 8, nombre: 'Ana', email: 'ana@example.com', rol: 'cliente' });
    const res = await request(app).post('/api/google-login').send({ credential: CREDENCIAL });

    expect(res.status).toBe(200);
    expect(res.body.user.rol).toBe('cliente');
    expect(fake.consultas('usuario', 'update')).toHaveLength(0);
  });
});
