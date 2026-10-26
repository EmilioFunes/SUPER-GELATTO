// Sin Supabase configurado, producción NO debe arrancar en modo simulado (aprobaría pagos sin guardarlos).
import { describe, it, expect, afterEach } from 'vitest';
import { cargarServidor } from '../helpers/cargarServidor.js';

afterEach(() => {
  delete process.env.RENDER;
});

describe('arranque sin Supabase', () => {
  it('NODE_ENV=production sin SUPABASE_URL -> el módulo falla con un mensaje claro en español', () => {
    expect(() => cargarServidor(null, { sinSupabase: true, produccion: true })).toThrow(/SUPABASE_URL/);
  });

  it('en Render (RENDER definido) sin Supabase -> también se niega a arrancar', () => {
    process.env.RENDER = 'true';
    // cargarServidor borra RENDER; se fija de nuevo justo antes de cargar mediante la opción de entorno.
    expect(() => cargarServidor(null, { sinSupabase: true, render: true })).toThrow(/SUPABASE_URL/);
  });

  it('producción con Supabase configurado -> arranca normal', () => {
    const fake = { client: {} };
    expect(() => cargarServidor(fake, { produccion: true })).not.toThrow();
  });

  it('desarrollo sin Supabase -> sigue en modo simulado', () => {
    expect(() => cargarServidor(null, { sinSupabase: true })).not.toThrow();
  });
});
