// n. El panel de administración debe sumar como ingreso SOLO las ventas cobradas
// (mismos estados que ESTADOS_COBRADOS del servidor). Función pura del frontend.
import { describe, it, expect } from 'vitest';
import { ESTADOS_COBRADOS, soloVentasCobradas } from '../../../frontend/src/utils/ingresos.js';

describe('soloVentasCobradas', () => {
  it('conserva las cobradas y descarta Pendiente, Fallido y Cancelado', () => {
    const ventas = ['Pendiente', 'Pagado', 'Fallido', 'En proceso', 'En entrega', 'Enviado', 'Entregado', 'Completado', 'Cancelado']
      .map((estado, i) => ({ id_venta: i, estado, total: 1000 }));

    const cobradas = soloVentasCobradas(ventas).map((v) => v.estado);

    expect(cobradas).toEqual(['Pagado', 'En proceso', 'En entrega', 'Enviado', 'Entregado', 'Completado']);
  });

  it('una venta sin estado no cuenta como cobrada y una lista inválida da []', () => {
    expect(soloVentasCobradas([{ total: 5 }])).toEqual([]);
    expect(soloVentasCobradas(null)).toEqual([]);
  });

  it('coincide con los estados cobrados del servidor', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
    const m = src.match(/const ESTADOS_COBRADOS = \[([^\]]*)\]/);
    const delServidor = m[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect([...ESTADOS_COBRADOS]).toEqual(delServidor);
  });
});
