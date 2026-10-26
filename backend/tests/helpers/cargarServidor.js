// Carga backend/server.js con el cliente Supabase FALSO ya inyectado.
//
// Por qué así: server.js es CommonJS y hace require('@supabase/supabase-js'); vi.mock solo
// intercepta imports de ESM. Aquí se usa un require REAL de Node (createRequire) y se coloca
// el fake en require.cache ANTES de cargar server.js. Las variables de entorno ficticias evitan
// que server.js caiga en su mockDb interna (que acepta cualquier cosa).
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { vi } from 'vitest';

const requireNode = createRequire(import.meta.url);
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const JWT_SECRET_PRUEBA = 'secreto-solo-para-pruebas';

// Opciones:
//  - sinSupabase: true -> sin SUPABASE_URL ni llaves: server.js usa su base simulada en memoria (mockDb).
//  - produccion: true -> NODE_ENV=production (el servidor debe negarse a arrancar sin Supabase).
//  - correo: función que recibe cada correo enviado (sendMail) en vez de usar SMTP/Ethereal reales.
//  - limitePagos: tope de peticiones por minuto a /api/payments/process (por defecto muy alto para que
//    las pruebas no choquen con el límite de intentos).
export function cargarServidor(fake, { sinSupabase = false, limitePagos = 100000, produccion = false, render = false, correo = null } = {}) {
  // Cadena vacía (no delete): así dotenv no vuelve a leerlas de un .env local.
  process.env.SUPABASE_URL = sinSupabase ? '' : 'http://supabase.fake.local';
  process.env.SUPABASE_SERVICE_ROLE_KEY = sinSupabase ? '' : 'service-role-key-falsa';
  process.env.SUPABASE_KEY = '';
  process.env.PAYMENT_RATE_LIMIT_MAX = String(limitePagos);
  process.env.JWT_SECRET = JWT_SECRET_PRUEBA;
  delete process.env.SIMULATION_MODE; // que requireAdmin exija un JWT real
  process.env.NODE_ENV = produccion ? 'production' : 'development'; // 'test' habilitaría la puerta trasera x-user-role
  if (render) process.env.RENDER = 'true';
  else delete process.env.RENDER;

  // Ninguna prueba debe tocar featured_state.json, fallback_sales.json ni tripo_models_state.json.
  const escrituras = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

  // server.js es muy hablador; se silencia para leer la salida de las pruebas.
  for (const n of ['log', 'warn', 'error']) vi.spyOn(console, n).mockImplementation(() => {});

  if (!sinSupabase) {
    const rutaSupabase = requireNode.resolve('@supabase/supabase-js');
    requireNode.cache[rutaSupabase] = {
      id: rutaSupabase,
      filename: rutaSupabase,
      loaded: true,
      exports: { createClient: () => fake.client },
    };
  }

  if (correo) {
    const rutaNodemailer = requireNode.resolve('nodemailer');
    const transporte = { sendMail: async (mensaje) => (correo(mensaje), { messageId: 'prueba' }) };
    requireNode.cache[rutaNodemailer] = {
      id: rutaNodemailer,
      filename: rutaNodemailer,
      loaded: true,
      exports: {
        createTransport: () => transporte,
        createTestAccount: async () => ({ smtp: { host: 'x', port: 25, secure: false }, user: 'u', pass: 'p' }),
        getTestMessageUrl: () => false,
      },
    };
  }

  const rutaServer = resolve(raiz, 'server.js');
  delete requireNode.cache[rutaServer];
  const app = requireNode(rutaServer);
  return { app, escrituras };
}

export const authAdmin = () => ({
  Authorization: `Bearer ${jwt.sign({ id_usuario: 1, rol: 'admin' }, JWT_SECRET_PRUEBA, { expiresIn: '1h' })}`,
});
