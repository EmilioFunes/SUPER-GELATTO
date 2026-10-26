// POST /api/google-login. Contrato:
//  - El navegador manda el `credential` (ID token de Google); el servidor lo verifica con
//    google-auth-library (verifyIdToken, audience = GOOGLE_CLIENT_ID). Aquí el verificador es falso.
//  - Correo y nombre salen SOLO del token verificado; se ignoran email/name/rol del cuerpo.
//  - Se exige email_verified === true.
//  - Sin GOOGLE_CLIENT_ID -> 503. Token ausente o inválido -> 401.
//  - El token de sesión lleva el rol de la base; un correo de ADMIN_EMAILS verificado sale como admin.
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, JWT_SECRET_PRUEBA, GOOGLE_CLIENT_ID_PRUEBA } from '../helpers/cargarServidor.js';

const CREDENCIAL = 'credencial-google-de-prueba';
const decodificar = (token) => jwt.verify(token, JWT_SECRET_PRUEBA, { algorithms: ['HS256'] });

// Verificador falso: acepta solo CREDENCIAL con la audiencia correcta y devuelve `payload`.
function verificadorQueDevuelve(payload, registro = []) {
  return async ({ idToken, audience }) => {
    registro.push({ idToken, audience });
    if (idToken !== CREDENCIAL || audience !== GOOGLE_CLIENT_ID_PRUEBA) throw new Error('Invalid token signature');
    return payload;
  };
}

// Respuestas de la tabla usuario: busca por el correo que pida la consulta en `filas`.
function responderUsuarios(fake, filas) {
  fake.responder('usuario', 'select', (llamada) => {
    const filtro = llamada.filtros.find((f) => (f[0] === 'eq' || f[0] === 'ilike') && f[1] === 'email');
    const buscado = String(filtro?.[2] || '').toLowerCase();
    const fila = filas.find((u) => u.email.toLowerCase() === buscado) || null;
    return { data: fila, error: null };
  });
}

let fake;
beforeEach(() => {
  fake = crearFakeSupabase();
});

const login = (app, body) => request(app).post('/api/google-login').send(body);

describe('POST /api/google-login: verificación del token de Google', () => {
  it('sin GOOGLE_CLIENT_ID configurado -> 503 con mensaje en español', async () => {
    const { app } = cargarServidor(fake, { googleClientId: '', verificadorGoogle: verificadorQueDevuelve({ email: 'a@example.com', email_verified: true }) });
    const res = await login(app, { credential: CREDENCIAL });
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/Google/);
    expect(res.body.token).toBeUndefined();
  });

  it('sin credential (solo email/name, como el frontend viejo) -> 401 y no emite token', async () => {
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'a@example.com', email_verified: true }) });
    const res = await login(app, { email: 'a@example.com', name: 'A' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect(fake.consultas('usuario')).toHaveLength(0);
  });

  it('credential que no es texto o es enorme -> 401', async () => {
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'a@example.com', email_verified: true }) });
    expect((await login(app, { credential: { a: 1 } })).status).toBe(401);
    expect((await login(app, { credential: 'x'.repeat(20000) })).status).toBe(401);
  });

  it('credential inválido (Google lo rechaza) -> 401', async () => {
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'a@example.com', email_verified: true }) });
    const res = await login(app, { credential: 'token-falsificado' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect(fake.consultas('usuario')).toHaveLength(0);
  });

  it('verifica con audience = GOOGLE_CLIENT_ID e idToken = credential', async () => {
    const registro = [];
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'a@example.com', email_verified: true, name: 'A' }, registro) });
    const res = await login(app, { credential: CREDENCIAL });
    expect(res.status).toBe(200);
    expect(registro).toEqual([{ idToken: CREDENCIAL, audience: GOOGLE_CLIENT_ID_PRUEBA }]);
  });

  it('email_verified false -> 401', async () => {
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'a@example.com', email_verified: false }) });
    const res = await login(app, { credential: CREDENCIAL });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });
});

describe('POST /api/google-login: identidad y rol', () => {
  it('cuerpo con email/rol de admin pero token verificado de otro correo -> entra como ese otro, cliente', async () => {
    const { app } = cargarServidor(fake, {
      adminEmails: 'jefe@example.com',
      verificadorGoogle: verificadorQueDevuelve({ email: 'otro@example.com', email_verified: true, name: 'Otro Real' }),
    });
    responderUsuarios(fake, []);
    const res = await login(app, { credential: CREDENCIAL, email: 'jefe@example.com', name: 'Impostor', rol: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.user.rol).toBe('cliente');
    expect(res.body.user.email).toBe('otro@example.com');
    const sesion = decodificar(res.body.token);
    expect(sesion).toMatchObject({ email: 'otro@example.com', rol: 'cliente' });
    const insertado = [].concat(fake.consultas('usuario', 'insert')[0].payload)[0];
    expect(insertado).toMatchObject({ email: 'otro@example.com', nombre: 'Otro Real', rol: 'cliente' });
  });

  it('usuario existente con rol cliente y correo de ADMIN_EMAILS verificado -> admin', async () => {
    const { app } = cargarServidor(fake, {
      adminEmails: 'otra@example.com, Jefe@Example.com',
      verificadorGoogle: verificadorQueDevuelve({ email: 'jefe@example.com', email_verified: true }),
    });
    responderUsuarios(fake, [{ id_usuario: 7, nombre: 'Jefe', email: 'jefe@example.com', rol: 'cliente' }]);
    const res = await login(app, { credential: CREDENCIAL });

    expect(res.status).toBe(200);
    expect(res.body.user.rol).toBe('admin');
    expect(decodificar(res.body.token)).toMatchObject({ id_usuario: 7, rol: 'admin' });
  });

  it('usuario existente normal -> sesión con el rol que dice la base', async () => {
    const { app } = cargarServidor(fake, {
      adminEmails: 'jefe@example.com',
      verificadorGoogle: verificadorQueDevuelve({ email: 'ana@example.com', email_verified: true }),
    });
    responderUsuarios(fake, [{ id_usuario: 8, nombre: 'Ana', email: 'Ana@Example.com', rol: 'cliente' }]);
    const res = await login(app, { credential: CREDENCIAL });

    expect(res.status).toBe(200);
    expect(decodificar(res.body.token)).toMatchObject({ id_usuario: 8, rol: 'cliente' });
    expect(fake.consultas('usuario', 'insert')).toHaveLength(0);
  });

  it('el token de sesión es HS256 y vence', async () => {
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'ana@example.com', email_verified: true }) });
    responderUsuarios(fake, [{ id_usuario: 8, nombre: 'Ana', email: 'ana@example.com', rol: 'cliente' }]);
    const res = await login(app, { credential: CREDENCIAL });
    const cabecera = jwt.decode(res.body.token, { complete: true });
    expect(cabecera.header.alg).toBe('HS256');
    expect(cabecera.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('correo duplicado al registrar -> entra con el usuario existente y la regla de admins', async () => {
    const { app } = cargarServidor(fake, {
      adminEmails: 'jefe@example.com',
      verificadorGoogle: verificadorQueDevuelve({ email: 'jefe@example.com', email_verified: true }),
    });
    let busquedas = 0;
    fake.responder('usuario', 'select', () => {
      busquedas += 1;
      // Las primeras búsquedas no lo encuentran (carrera); tras el insert duplicado, sí.
      return { data: fake.consultas('usuario', 'insert').length ? { id_usuario: 7, nombre: 'Jefe', email: 'jefe@example.com', rol: 'cliente' } : null, error: null };
    });
    fake.responder('usuario', 'insert', { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    const res = await login(app, { credential: CREDENCIAL });

    expect(busquedas).toBeGreaterThan(0);
    expect(res.status).toBe(200);
    expect(decodificar(res.body.token)).toMatchObject({ id_usuario: 7, rol: 'admin' });
  });

  it('comodines de ilike (_) no permiten entrar a la cuenta de otro correo', async () => {
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'a_b@example.com', email_verified: true }) });
    // La base "encuentra" una fila con un correo distinto (lo que haría ilike con '_').
    fake.responder('usuario', 'select', { data: { id_usuario: 99, nombre: 'Victima', email: 'axb@example.com', rol: 'admin' }, error: null });
    const res = await login(app, { credential: CREDENCIAL });

    if (res.status === 200) {
      const sesion = decodificar(res.body.token);
      expect(sesion.id_usuario).not.toBe(99);
      expect(sesion.rol).not.toBe('admin');
    } else {
      expect(res.body.token).toBeUndefined();
    }
  });

  it('error de la base al buscar el usuario -> 500 sin éxito falso ni detalles internos', async () => {
    const { app } = cargarServidor(fake, { verificadorGoogle: verificadorQueDevuelve({ email: 'ana@example.com', email_verified: true }) });
    fake.responder('usuario', 'select', { data: null, error: { code: '42501', message: 'permission denied for table usuario' } });
    const res = await login(app, { credential: CREDENCIAL });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.token).toBeUndefined();
    expect(res.body.message).not.toMatch(/permission|usuario/i);
    expect(fake.consultas('usuario', 'insert')).toHaveLength(0);
  });
});

describe('POST /api/login (contraseña): sin elevación por correo', () => {
  it('correo de ADMIN_EMAILS con rol cliente en la base -> sigue siendo cliente', async () => {
    // El registro con contraseña no verifica que el correo sea de quien se registra, así que el correo
    // por sí solo NO puede convertir a nadie en admin por este camino.
    const { app } = cargarServidor(fake, { adminEmails: 'jefe@example.com' });
    const hash = bcrypt.hashSync('Clave-de-prueba1!', 4);
    fake.responder('usuario', 'select', { data: { id_usuario: 7, nombre: 'Jefe', email: 'jefe@example.com', password_hash: hash, rol: 'cliente' }, error: null });
    const res = await request(app).post('/api/login').send({ email: 'jefe@example.com', password: 'Clave-de-prueba1!' });

    expect(res.status).toBe(200);
    expect(decodificar(res.body.token)).toMatchObject({ id_usuario: 7, rol: 'cliente' });
  });
});
