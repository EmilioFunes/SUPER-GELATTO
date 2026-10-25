// Utilidades para probar la base de datos con PGlite (Postgres real en memoria, sin Docker).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizSupabase = resolve(aqui, '../../../supabase');

export const RUTA_ESQUEMA = resolve(raizSupabase, 'schema_base_2026-10-25.sql');
export const RUTA_MIGRACION = resolve(raizSupabase, 'migrations/20261025120000_ventas_pagos_y_productos.sql');
export const RUTA_ROLLBACK = resolve(raizSupabase, 'rollbacks/20261025120000_ventas_pagos_y_productos.rollback.sql');

export const leer = (ruta) => readFileSync(ruta, 'utf8');

// Imita lo que Supabase trae de fábrica: roles anon/authenticated/service_role y los
// privilegios por defecto que reciben sobre tablas, secuencias y FUNCIONES nuevas en public.
const ROLES_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

// Datos que reproducen el estado real: producto con max(id)=13 y secuencia en 4,
// venta con IDs tipo Date.now() y secuencia en 14, detalle_venta vacío.
const SEMILLA = `
  insert into public.usuario (id_usuario, nombre, apellido, email, password_hash, rol)
  values (1, 'Ana', 'Prueba', 'ana@test.local', 'x', 'cliente');

  insert into public.producto (id_producto, nombre, precio, estado, stock) values
    (5,  'Helado de fresa',     2500.00, true,  10),
    (6,  'Helado descontinuado', 1000.00, false, 10),
    (13, 'Paleta de mango',     1200.50, true,  3);
  select setval(pg_get_serial_sequence('public.producto', 'id_producto'), 4);

  insert into public.venta (id_venta, total, tipo_venta, id_usuario) values
    (15, 5000.00, 'Online', null),
    (1786407836737, 2500.00, 'Online', 1);
  select setval(pg_get_serial_sequence('public.venta', 'id_venta'), 14);
`;

export async function crearBase({ migrar = true } = {}) {
  const db = new PGlite();
  await db.exec(ROLES_SUPABASE);
  await db.exec(leer(RUTA_ESQUEMA));
  // Igual que en la base real: RLS activo y sin políticas.
  // Así la prueba de service_role demuestra que registrar_venta depende de BYPASSRLS.
  await db.exec(`
    alter table public.detalle_venta enable row level security;
    alter table public.inventario enable row level security;
  `);
  await db.exec(SEMILLA);
  if (migrar) await db.exec(leer(RUTA_MIGRACION));
  return db;
}

export async function registrarVenta(db, idUsuario, items, estado) {
  const r = await db.query('select public.registrar_venta($1, $2::jsonb, $3) as r', [
    idUsuario,
    items === undefined ? null : JSON.stringify(items),
    estado,
  ]);
  return r.rows[0].r;
}

export async function valor(db, sql, params = []) {
  const r = await db.query(sql, params);
  const fila = r.rows[0];
  return fila ? Object.values(fila)[0] : undefined;
}

export async function contar(db, tabla) {
  return Number(await valor(db, `select count(*) from public.${tabla}`));
}
