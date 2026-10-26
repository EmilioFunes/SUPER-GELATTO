// m. Aviso por correo al cambiar el estado de una venta (función de la unión con Cristian):
//  - todo dato que viene del usuario / URL va escapado en el HTML,
//  - solo se avisa si la base guardó el cambio,
//  - si falla la lectura del cliente, el cambio de estado igual queda guardado (sin correo).
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { crearFakeSupabase } from '../helpers/fakeSupabase.js';
import { cargarServidor, authAdmin } from '../helpers/cargarServidor.js';

const fake = crearFakeSupabase();
const correos = [];
let app;

beforeAll(() => {
  ({ app } = cargarServidor(fake, { correo: (m) => correos.push(m) }));
});
beforeEach(() => {
  fake.reiniciar();
  correos.length = 0;
});

const ID = '987654321'; // no existe en fallback_sales.json
const cambiar = (id, estado) => request(app).put(`/api/admin/sales/${encodeURIComponent(id)}/status`).set(authAdmin()).send({ estado });
const ventaDe = (id_usuario = 7) => ({ data: { id_venta: 1, id_usuario, total: 12000 }, error: null });

describe('PUT /api/admin/sales/:id/status - correo', () => {
  it('envía el correo al cliente de la venta', async () => {
    fake.responder('venta', 'update', ventaDe());
    fake.responder('usuario', 'select', { data: { email: 'cliente@ejemplo.test', nombre: 'Ana', apellido: 'Pérez' }, error: null });

    const res = await cambiar(ID, 'Enviado');

    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(correos).toHaveLength(1));
    expect(correos[0].to).toBe('cliente@ejemplo.test');
    expect(correos[0].html).toContain('Ana Pérez');
  });

  it('escapa el nombre del cliente y el id de la venta en el HTML', async () => {
    fake.responder('venta', 'update', ventaDe());
    fake.responder('usuario', 'select', {
      data: { email: 'cliente@ejemplo.test', nombre: '<img src=x onerror=alert(1)>', apellido: '"><script>x()</script>' },
      error: null,
    });

    const res = await cambiar('<b>77</b>', 'Cancelado');

    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(correos).toHaveLength(1));
    const { html, subject } = correos[0];
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>77');
    expect(html).toContain('&lt;img');
    expect(subject).not.toContain('<b>');
  });

  it('si la base falla al guardar el estado -> 500 y no se envía correo', async () => {
    fake.responder('venta', 'update', { data: null, error: { code: '23514', message: 'violates check constraint' } });

    const res = await cambiar(ID, 'Enviado');

    expect(res.status).toBe(500);
    await new Promise((r) => setTimeout(r, 50));
    expect(correos).toHaveLength(0);
    expect(fake.consultas('usuario')).toHaveLength(0);
  });

  it('si falla la lectura del cliente: 200, estado guardado y sin correo', async () => {
    fake.responder('venta', 'update', ventaDe());
    fake.responder('usuario', 'select', { data: null, error: { message: 'fetch failed' } });

    const res = await cambiar(ID, 'Enviado');

    expect(res.status).toBe(200);
    expect(res.body.emailNotified).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(correos).toHaveLength(0);
  });

  it('el estado inválido sigue dando 400 y no toca la base ni envía correo', async () => {
    const res = await cambiar(ID, '<script>');

    expect(res.status).toBe(400);
    expect(fake.llamadas).toHaveLength(0);
    expect(correos).toHaveLength(0);
  });
});
