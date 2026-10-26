// Cliente Supabase FALSO para probar server.js sin red ni base real.
//
// Reproduce lo importante del cliente real:
//  - NUNCA lanza excepciones: devuelve { data, error } (por eso los try/catch no atrapan nada).
//  - Si un insert/update usa una columna que no existe, responde el error real de PostgREST (PGRST204).
//  - Registra todas las llamadas (fake.llamadas) para poder comprobarlas.
//
// Las columnas válidas salen de supabase/schema_base_2026-10-25.sql (CREATE TABLE) más las
// que añaden las migraciones (ADD COLUMN). Así el fake no puede quedar desactualizado.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizSupabase = resolve(aqui, '../../../supabase');

export function cargarColumnas() {
  const columnas = {};
  const esquema = readFileSync(resolve(raizSupabase, 'schema_base_2026-10-25.sql'), 'utf8');
  const reTabla = /create table public\.(\w+)\s*\(([\s\S]*?)\n\);/gi;
  let m;
  while ((m = reTabla.exec(esquema))) {
    const cols = new Set();
    for (const linea of m[2].split('\n')) {
      const palabra = linea.trim().split(/\s+/)[0];
      if (!palabra || /^(constraint|primary|unique|check|foreign)$/i.test(palabra)) continue;
      cols.add(palabra.replace(/,$/, ''));
    }
    columnas[m[1]] = cols;
  }
  // Columnas añadidas por las migraciones.
  const dirMig = resolve(raizSupabase, 'migrations');
  for (const f of readdirSync(dirMig).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(resolve(dirMig, f), 'utf8');
    const reAdd = /alter table public\.(\w+)\s+add column(?: if not exists)?\s+(\w+)/gi;
    while ((m = reAdd.exec(sql))) columnas[m[1]]?.add(m[2]);
  }
  return columnas;
}

// Firmas de las funciones SQL: { nombre: Set(parámetros) }, leídas de los
// `create or replace function public.<nombre>(...)` de las migraciones. Así el fake rechaza
// (PGRST202, como PostgREST) un rpc a una función que no existe o con argumentos que no coinciden.
export function cargarFunciones() {
  const funciones = {};
  const dirMig = resolve(raizSupabase, 'migrations');
  for (const f of readdirSync(dirMig).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(resolve(dirMig, f), 'utf8');
    const re = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([^)]*)\)/gi;
    let m;
    while ((m = re.exec(sql))) {
      const params = m[2].split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
      funciones[m[1]] = new Set(params);
    }
  }
  return funciones;
}

export function crearFakeSupabase() {
  const columnas = cargarColumnas();
  const funciones = cargarFunciones();
  const contadoresId = {}; // secuencias "identity" simuladas, una por tabla
  const fake = {
    columnas,
    errores: [], // errores PGRST204 que el fake generó por columnas inexistentes
    llamadas: [], // { tipo:'query', tabla, op, payload, filtros, modo } | { tipo:'rpc', nombre, args }
    _respuestasQuery: [],
    _respuestasRpc: {},

    reiniciar() {
      fake.llamadas.length = 0;
      fake.errores.length = 0;
      fake._respuestasQuery.length = 0;
      fake._respuestasRpc = {};
    },
    // Respuesta fija (u función llamada => respuesta) para una operación:
    //   fake.responder('producto', 'update', { data: null, error: { message: '...' } })
    responder(tabla, op, respuesta) {
      fake._respuestasQuery.push({ tabla, op, respuesta });
    },
    // Respuesta (o función args => respuesta) para un rpc.
    responderRpc(nombre, respuesta) {
      fake._respuestasRpc[nombre] = respuesta;
    },
    consultas(tabla, op) {
      return fake.llamadas.filter((l) => l.tipo === 'query' && (!tabla || l.tabla === tabla) && (!op || l.op === op));
    },
    rpcs(nombre) {
      return fake.llamadas.filter((l) => l.tipo === 'rpc' && (!nombre || l.nombre === nombre));
    },
  };

  function errorColumna(tabla, payload) {
    const filas = Array.isArray(payload) ? payload : [payload];
    for (const fila of filas) {
      for (const col of Object.keys(fila || {})) {
        if (columnas[tabla] && !columnas[tabla].has(col)) {
          return {
            code: 'PGRST204',
            details: null,
            hint: null,
            message: `Could not find the '${col}' column of '${tabla}' in the schema cache`,
          };
        }
      }
    }
    return null;
  }

  function resolverConsulta(llamada) {
    if (llamada.payload !== undefined && llamada.op !== 'delete') {
      const error = errorColumna(llamada.tabla, llamada.payload);
      if (error) {
        fake.errores.push(error.message);
        return { data: null, error };
      }
    }
    const cfg = fake._respuestasQuery.find((r) => r.tabla === llamada.tabla && r.op === llamada.op);
    if (cfg) return typeof cfg.respuesta === 'function' ? cfg.respuesta(llamada) : cfg.respuesta;
    // Por defecto: éxito. Los inserts devuelven la fila enviada; lo demás, vacío.
    if (llamada.op === 'insert' || llamada.op === 'upsert') {
      // Como la base real: la columna identity (id_<tabla>) la genera la secuencia si el insert no la manda.
      const colId = `id_${llamada.tabla}`;
      const filas = (Array.isArray(llamada.payload) ? llamada.payload : [llamada.payload]).map((fila) => {
        if (!columnas[llamada.tabla]?.has(colId) || fila[colId] != null) return fila;
        contadoresId[llamada.tabla] = (contadoresId[llamada.tabla] || 1000) + 1;
        return { ...fila, [colId]: contadoresId[llamada.tabla] };
      });
      // single/maybeSingle devuelven una fila (objeto), como supabase-js; si no, un arreglo.
      return { data: llamada.modo === 'varias' ? filas : filas[0] ?? null, error: null };
    }
    return { data: llamada.modo === 'varias' ? [] : null, error: null };
  }

  function from(tabla) {
    const llamada = { tipo: 'query', tabla, op: 'select', payload: undefined, filtros: [], modo: 'varias' };
    fake.llamadas.push(llamada);
    const b = {};
    const encadenar = (n) => (...args) => {
      llamada.filtros.push([n, ...args]);
      return b;
    };
    for (const n of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'ilike', 'like', 'order', 'limit', 'range', 'or', 'not', 'match']) {
      b[n] = encadenar(n);
    }
    // select() tras insert/update solo pide devolver filas; no cambia la operación.
    b.select = () => b;
    for (const op of ['insert', 'update', 'upsert', 'delete']) {
      b[op] = (payload) => {
        llamada.op = op;
        llamada.payload = payload;
        return b;
      };
    }
    b.single = () => ((llamada.modo = 'single'), b);
    b.maybeSingle = () => ((llamada.modo = 'maybeSingle'), b);
    b.then = (resolver, rechazar) => Promise.resolve(resolverConsulta(llamada)).then(resolver, rechazar);
    return b;
  }

  fake.client = {
    from,
    rpc(nombre, args) {
      fake.llamadas.push({ tipo: 'rpc', nombre, args });
      const firma = funciones[nombre];
      const pasados = Object.keys(args || {}).filter((k) => args[k] !== undefined);
      if (!firma || pasados.length !== firma.size || !pasados.every((k) => firma.has(k))) {
        return Promise.resolve({
          data: null,
          error: {
            code: 'PGRST202',
            message: `Could not find the function public.${nombre}(${pasados.sort().join(', ')}) in the schema cache`,
          },
        });
      }
      const cfg = fake._respuestasRpc[nombre];
      const respuesta = typeof cfg === 'function' ? cfg(args) : cfg;
      return Promise.resolve(
        respuesta ?? { data: null, error: { code: 'PGRST202', message: `rpc ${nombre} no configurado en la prueba` } },
      );
    },
  };
  return fake;
}
