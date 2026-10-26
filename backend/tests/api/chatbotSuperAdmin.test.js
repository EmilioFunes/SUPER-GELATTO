// Herramienta deleteUser del chatbot: el super administrador sale de SUPER_ADMIN_EMAIL (variable de
// entorno), no de un correo escrito en el código. Si la variable está vacía, nadie es super admin.
import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';

const requireNode = createRequire(import.meta.url);
const rutaChatbot = requireNode.resolve('../../chatbot.js');

let fake;
let herramientas;
beforeEach(() => {
  for (const n of ['log', 'warn', 'error']) vi.spyOn(console, n).mockImplementation(() => {});
  fake = crearFakeSupabase();
  fake.responder('usuario', 'select', { data: { id_usuario: 50, nombre: 'Otro', email: 'otro.admin@example.com', rol: 'admin' }, error: null });
  delete requireNode.cache[rutaChatbot];
  ({ functions: herramientas } = requireNode(rutaChatbot));
});
afterEach(() => {
  process.env.SUPER_ADMIN_EMAIL = '';
});

describe('chatbot deleteUser y SUPER_ADMIN_EMAIL', () => {
  it('el correo configurado (sin importar mayúsculas) puede eliminar a otro admin', async () => {
    process.env.SUPER_ADMIN_EMAIL = 'Jefe@Example.com';
    const r = await herramientas.deleteUser(fake.client, '50', 'jefe@example.com');
    expect(r.success).toBe(true);
    expect(fake.consultas('usuario', 'delete')).toHaveLength(1);
  });

  it('SUPER_ADMIN_EMAIL vacío y solicitante sin correo -> no puede eliminar admins', async () => {
    process.env.SUPER_ADMIN_EMAIL = '';
    const r = await herramientas.deleteUser(fake.client, '50', '');
    expect(r.error).toBeTruthy();
    expect(fake.consultas('usuario', 'delete')).toHaveLength(0);
  });
});
