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

// 32+ caracteres: en producción el servidor se niega a arrancar con un JWT_SECRET más corto.
export const JWT_SECRET_PRUEBA = 'secreto-solo-para-pruebas-con-mas-de-32-caracteres';
export const GOOGLE_CLIENT_ID_PRUEBA = 'cliente-google-de-prueba.apps.googleusercontent.com';

// Opciones:
//  - sinSupabase: true -> sin SUPABASE_URL ni llaves: server.js usa su base simulada en memoria (mockDb).
//  - produccion: true -> NODE_ENV=production (el servidor debe negarse a arrancar sin Supabase).
//  - correo: función que recibe cada correo enviado (sendMail) en vez de usar SMTP/Ethereal reales.
//  - limitePagos: tope de peticiones por minuto a /api/payments/process (por defecto muy alto para que
//    las pruebas no choquen con el límite de intentos).
//  - jwtSecret: valor de JWT_SECRET ('' = sin configurar).
//  - googleClientId: valor de GOOGLE_CLIENT_ID ('' = sin configurar).
//  - adminEmails / superAdmin: valores de ADMIN_EMAILS y SUPER_ADMIN_EMAIL (por defecto vacíos, para no
//    depender del .env local).
//  - simulacion: true -> SIMULATION_MODE=true.
//  - verificadorGoogle: async ({ idToken, audience }) => payload | lanza error. Reemplaza a
//    google-auth-library (OAuth2Client.verifyIdToken): las pruebas NUNCA llaman a Google de verdad.
export function cargarServidor(fake, { sinSupabase = false, limitePagos = 100000, produccion = false, render = false, correo = null,
  jwtSecret = JWT_SECRET_PRUEBA, googleClientId = GOOGLE_CLIENT_ID_PRUEBA, adminEmails = '', superAdmin = '',
  simulacion = false, verificadorGoogle = null } = {}) {
  // Cadena vacía (no delete): así dotenv no vuelve a leerlas de un .env local.
  process.env.SUPABASE_URL = sinSupabase ? '' : 'http://supabase.fake.local';
  process.env.SUPABASE_SERVICE_ROLE_KEY = sinSupabase ? '' : 'service-role-key-falsa';
  process.env.SUPABASE_KEY = '';
  process.env.PAYMENT_RATE_LIMIT_MAX = String(limitePagos);
  process.env.JWT_SECRET = jwtSecret;
  process.env.GOOGLE_CLIENT_ID = googleClientId;
  process.env.ADMIN_EMAILS = adminEmails;
  process.env.SUPER_ADMIN_EMAIL = superAdmin;
  if (simulacion) process.env.SIMULATION_MODE = 'true';
  else delete process.env.SIMULATION_MODE;
  process.env.NODE_ENV = produccion ? 'production' : 'development';
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

  // google-auth-library falso: por defecto rechaza todo token.
  const rutaGoogle = requireNode.resolve('google-auth-library');
  const verificar = verificadorGoogle || (async () => { throw new Error('Wrong number of segments in token'); });
  class OAuth2Client {
    async verifyIdToken({ idToken, audience }) {
      const payload = await verificar({ idToken, audience });
      return { getPayload: () => payload };
    }
  }
  requireNode.cache[rutaGoogle] = { id: rutaGoogle, filename: rutaGoogle, loaded: true, exports: { OAuth2Client } };

  const rutaServer = resolve(raiz, 'server.js');
  delete requireNode.cache[rutaServer];
  const app = requireNode(rutaServer);
  return { app, escrituras };
}

export const authAdmin = () => ({
  Authorization: `Bearer ${jwt.sign({ id_usuario: 1, rol: 'admin' }, JWT_SECRET_PRUEBA, { algorithm: 'HS256', expiresIn: '1h' })}`,
});
