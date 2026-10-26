// Seguridad de PUT /api/users/:id (editar perfil). Contrato:
//  - Sin sesión válida (Bearer) -> 401. Solo el propio usuario o un administrador -> si no, 403.
//  - Solo se pueden cambiar el nombre y el correo (lista blanca): rol, contraseña o id se ignoran.
//  - Se validan tipos, largos y formato del correo -> 400.
//  - Correo ya usado por otra cuenta (sin importar mayúsculas) -> 409.
//  - Nadie que no sea el super admin (SUPER_ADMIN_EMAIL) puede modificar al super admin ni quedarse con
//    su correo; un admin normal solo edita clientes (y a sí mismo).
//  - Si la base falla -> 500 { ok:false }, nunca un éxito falso.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, tokenPrueba } from '../helpers/cargarServidor.js';

const SUPER = 'jefe@example.com';
const USUARIOS = [
  { id_usuario: 10, nombre: 'Ana', email: 'ana@example.com', rol: 'cliente', password_hash: 'hash-ana' },
  { id_usuario: 20, nombre: 'Admin Dos', email: 'admin2@example.com', rol: 'admin', password_hash: 'hash-admin2' },
  { id_usuario: 21, nombre: 'Admin Tres', email: 'admin3@example.com', rol: 'admin', password_hash: 'hash-admin3' },
  { id_usuario: 30, nombre: 'Jefe', email: SUPER, rol: 'admin', password_hash: 'hash-jefe' },
  { id_usuario: 40, nombre: 'Luis', email: 'luis@example.com', rol: 'cliente', password_hash: 'hash-luis' },
];

const sesion = (u) => ({ Authorization: `Bearer ${tokenPrueba({ id_usuario: u.id_usuario, email: u.email, rol: u.rol })}` });
const [ANA, ADMIN2, ADMIN3, JEFE, LUIS] = USUARIOS;

const fake = crearFakeSupabase();
let app;

// Las búsquedas en usuario responden según el filtro: por id (eq) o por correo (ilike, sin mayúsculas).
function buscarUsuario(llamada) {
  let filas = USUARIOS;
  for (const [op, col, valor] of llamada.filtros) {
    if (op === 'eq' && col === 'id_usuario') filas = filas.filter((u) => String(u.id_usuario) === String(valor));
    if (op === 'eq' && col === 'email') filas = filas.filter((u) => u.email === valor);
    if (op === 'ilike' && col === 'email') {
      const buscado = String(valor).replace(/\\(.)/g, '$1').toLowerCase();
      filas = filas.filter((u) => u.email.toLowerCase() === buscado);
    }
    if (op === 'neq' && col === 'id_usuario') filas = filas.filter((u) => String(u.id_usuario) !== String(valor));
  }
  const data = llamada.modo === 'varias' ? filas : filas[0] ?? null;
  return { data, error: null };
}

function actualizarUsuario(llamada) {
  const filtroId = llamada.filtros.find(([op, col]) => op === 'eq' && col === 'id_usuario');
  const actual = USUARIOS.find((u) => String(u.id_usuario) === String(filtroId?.[2]));
  if (!actual) return { data: null, error: null };
  return { data: { ...actual, ...llamada.payload }, error: null };
}

beforeAll(() => {
  ({ app } = cargarServidor(fake, { superAdmin: SUPER }));
});

beforeEach(() => {
  fake.reiniciar();
  fake.responder('usuario', 'select', buscarUsuario);
  fake.responder('usuario', 'update', actualizarUsuario);
});

const editar = (id, cuerpo, cabeceras = {}) => request(app).put(`/api/users/${id}`).set(cabeceras).send(cuerpo);
const actualizaciones = () => fake.consultas('usuario', 'update');

describe('PUT /api/users/:id - sesión y dueño', () => {
  it('sin token -> 401 y no toca la base', async () => {
    const res = await editar(10, { name: 'Ana', email: 'hacker@example.com' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/sesi[oó]n|token/i);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('token inválido -> 401', async () => {
    const res = await editar(10, { name: 'Ana', email: 'ana@example.com' }, { Authorization: 'Bearer basura' });
    expect(res.status).toBe(401);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('cliente editando la cuenta de OTRO cliente -> 403', async () => {
    const res = await editar(10, { name: 'Ana', email: 'robada@example.com' }, sesion(LUIS));
    expect(res.status).toBe(403);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('cliente editando su propia cuenta -> 200 y solo cambia nombre y correo', async () => {
    const res = await editar(10, { name: 'Ana Maria', email: 'ana.nueva@example.com' }, sesion(ANA));
    expect(res.status).toBe(200);
    expect(actualizaciones()).toHaveLength(1);
    expect(actualizaciones()[0].payload).toEqual({ nombre: 'Ana Maria', email: 'ana.nueva@example.com' });
    expect(actualizaciones()[0].filtros).toContainEqual(['eq', 'id_usuario', 10]);
    expect(res.body.user).toMatchObject({ id: 10, name: 'Ana Maria', email: 'ana.nueva@example.com' });
    expect(JSON.stringify(res.body)).not.toMatch(/hash-/);
  });

  it('cliente intentando cambiar su rol, contraseña o id -> esos campos se ignoran', async () => {
    const res = await editar(
      10,
      { name: 'Ana', email: 'ana@example.com', rol: 'admin', password_hash: 'x', id_usuario: 1, estado: false },
      sesion(ANA),
    );
    expect(res.status).toBe(200);
    expect(Object.keys(actualizaciones()[0].payload).sort()).toEqual(['email', 'nombre']);
  });

  it('administrador editando a un cliente -> 200', async () => {
    const res = await editar(10, { name: 'Ana', email: 'ana@example.com' }, sesion(ADMIN2));
    expect(res.status).toBe(200);
    expect(actualizaciones()).toHaveLength(1);
  });

  it('usuario que no existe (admin) -> 404', async () => {
    const res = await editar(999, { name: 'Nadie', email: 'nadie@example.com' }, sesion(ADMIN2));
    expect(res.status).toBe(404);
    expect(actualizaciones()).toHaveLength(0);
  });
});

describe('PUT /api/users/:id - super admin y otros admins', () => {
  it('admin normal modificando al super admin -> 403', async () => {
    const res = await editar(30, { name: 'Jefe', email: 'admin2.otro@example.com' }, sesion(ADMIN2));
    expect(res.status).toBe(403);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('admin normal modificando a OTRO admin -> 403 (solo el super admin)', async () => {
    const res = await editar(21, { name: 'Admin Tres', email: 'mio@example.com' }, sesion(ADMIN2));
    expect(res.status).toBe(403);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('super admin modificando a un admin -> 200', async () => {
    const res = await editar(21, { name: 'Admin Tres', email: 'admin3.nuevo@example.com' }, sesion(JEFE));
    expect(res.status).toBe(200);
    expect(actualizaciones()).toHaveLength(1);
  });

  it('super admin editando su propio perfil -> 200', async () => {
    const res = await editar(30, { name: 'Jefe Mayor', email: SUPER }, sesion(JEFE));
    expect(res.status).toBe(200);
  });

  it('admin editando su propio perfil -> 200', async () => {
    const res = await editar(20, { name: 'Admin Dos', email: 'admin2@example.com' }, sesion(ADMIN2));
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/users/:id - correo duplicado y correo del super admin', () => {
  it('correo que ya usa otra cuenta -> 409', async () => {
    const res = await editar(10, { name: 'Ana', email: 'luis@example.com' }, sesion(ANA));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/en uso/i);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('correo de otra cuenta con otras mayúsculas -> 409', async () => {
    const res = await editar(10, { name: 'Ana', email: 'LUIS@Example.com' }, sesion(ANA));
    expect(res.status).toBe(409);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('su mismo correo con otras mayúsculas no cuenta como duplicado -> 200', async () => {
    const res = await editar(10, { name: 'Ana', email: 'Ana@Example.com' }, sesion(ANA));
    expect(res.status).toBe(200);
  });

  it('la base responde 23505 (único) al guardar -> 409', async () => {
    fake.reiniciar();
    fake.responder('usuario', 'select', buscarUsuario);
    fake.responder('usuario', 'update', { data: null, error: { code: '23505', message: 'duplicate key' } });
    const res = await editar(10, { name: 'Ana', email: 'ana.otra@example.com' }, sesion(ANA));
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/users/:id - correo del super admin cuando aún no tiene cuenta', () => {
  let appSinJefe;
  const NUEVO_JEFE = 'nuevo.jefe@example.com';
  beforeAll(() => {
    ({ app: appSinJefe } = cargarServidor(fake, { superAdmin: NUEVO_JEFE }));
  });

  it('un cliente no puede ponerse el correo del super admin (ni con mayúsculas) -> 403', async () => {
    const res = await request(appSinJefe)
      .put('/api/users/10')
      .set(sesion(ANA))
      .send({ name: 'Ana', email: 'Nuevo.Jefe@Example.com' });
    expect(res.status).toBe(403);
    expect(actualizaciones()).toHaveLength(0);
  });
});

describe('PUT /api/users/:id - validaciones', () => {
  it.each([
    ['id que no es número', 'abc', { name: 'Ana', email: 'ana@example.com' }],
    ['nombre que no es texto', 10, { name: ['Ana'], email: 'ana@example.com' }],
    ['correo que no es texto', 10, { name: 'Ana', email: { $ne: '' } }],
    ['nombre demasiado largo', 10, { name: 'A'.repeat(101), email: 'ana@example.com' }],
    ['correo demasiado largo', 10, { name: 'Ana', email: `${'a'.repeat(250)}@example.com` }],
    ['correo con formato inválido', 10, { name: 'Ana', email: 'no-es-correo' }],
    ['sin nombre', 10, { email: 'ana@example.com' }],
  ])('%s -> 400', async (_n, id, cuerpo) => {
    const res = await editar(id, cuerpo, sesion(ANA));
    expect(res.status).toBe(400);
    expect(actualizaciones()).toHaveLength(0);
  });
});

describe('PUT /api/users/:id - errores de la base', () => {
  it('falla la búsqueda del usuario -> 500 ok:false', async () => {
    fake.reiniciar();
    fake.responder('usuario', 'select', { data: null, error: { message: 'caída' } });
    const res = await editar(10, { name: 'Ana', email: 'ana@example.com' }, sesion(ANA));
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(actualizaciones()).toHaveLength(0);
  });

  it('falla el guardado -> 500 ok:false (no un éxito falso)', async () => {
    fake.reiniciar();
    fake.responder('usuario', 'select', buscarUsuario);
    fake.responder('usuario', 'update', { data: null, error: { message: 'caída' } });
    const res = await editar(10, { name: 'Ana', email: 'ana@example.com' }, sesion(ANA));
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).not.toMatch(/caída/);
  });
});
