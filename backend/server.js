require('dotenv').config();

// Desactivar temporalmente la verificación estricta de SSL en Node para entornos locales con certificados auto-firmados / proxys
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs'); // Usamos bcryptjs para mejor compatibilidad en Windows
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { handleChatbotRequest } = require('./chatbot');


const {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesByImageCommand
} = require('@aws-sdk/client-rekognition');

const supabaseUrl = process.env.SUPABASE_URL;
// Priorizar SUPABASE_SERVICE_ROLE_KEY para realizar operaciones administrativas de backend sin restricciones de RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const JWT_SECRET = process.env.JWT_SECRET || 'supergelatto_secret_jwt_key_2026_default';

// ─── AWS Rekognition Config ─────────────────────────────────────
const rekognitionRegion = process.env.AWS_REGION || 'us-east-2';
const rekognitionCollectionId = process.env.REKOGNITION_COLLECTION_ID || 'supergelatto-admins';

const awsCredentials = {
  accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
  secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
};
if (process.env.AWS_SESSION_TOKEN && process.env.AWS_SESSION_TOKEN.trim()) {
  awsCredentials.sessionToken = process.env.AWS_SESSION_TOKEN.trim();
}

const rekognitionClient = new RekognitionClient({
  region: rekognitionRegion,
  credentials: awsCredentials
});

// ─── Estado persistente de DESTACADOS ───────────────────────────
// Guardamos el mapa {id_producto: boolean} en un archivo local para
// que sobreviva reinicios del servidor y no dependa de Supabase.
const fs = require('fs');
const path = require('path');
const FEATURED_STORE_PATH = path.join(__dirname, 'featured_state.json');

function loadFeaturedState() {
  try {
    if (fs.existsSync(FEATURED_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(FEATURED_STORE_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveFeaturedState(state) {
  try {
    fs.writeFileSync(FEATURED_STORE_PATH, JSON.stringify(state), 'utf8');
  } catch (e) {
    console.warn('No se pudo guardar featured_state.json:', e.message);
  }
}

// Mapa en memoria, cargado desde disco al arrancar
let FEATURED_STATE = loadFeaturedState();

// ─── Estado persistente de VENTAS (Real-Time Fallback) ────────────
const FALLBACK_SALES_PATH = path.join(__dirname, 'fallback_sales.json');

function loadFallbackSales() {
  try {
    if (fs.existsSync(FALLBACK_SALES_PATH)) {
      return JSON.parse(fs.readFileSync(FALLBACK_SALES_PATH, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveFallbackSales(sales) {
  try {
    fs.writeFileSync(FALLBACK_SALES_PATH, JSON.stringify(sales), 'utf8');
  } catch (e) {
    console.warn('No se pudo guardar fallback_sales.json:', e.message);
  }
}

let FALLBACK_SALES = loadFallbackSales();

// ─── Estado persistente de MODELOS 3D (Tripo AI) ────────────────
const TRIPO_STORE_PATH = path.join(__dirname, 'tripo_models_state.json');

function loadTripoModelsState() {
  try {
    if (fs.existsSync(TRIPO_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(TRIPO_STORE_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveTripoModelsState(state) {
  try {
    fs.writeFileSync(TRIPO_STORE_PATH, JSON.stringify(state), 'utf8');
  } catch (e) {
    console.warn('No se pudo guardar tripo_models_state.json:', e.message);
  }
}

let TRIPO_MODELS_STATE = loadTripoModelsState();

// ─── Tripo 3D AI Helper Functions ─────────────────────────────
const TRIPO_API_KEY = process.env.TRIPO_API_KEY || 'tsk_2lZ_a8JY7brp7zM_Ucbx77blqm3R3T3CScLfd-MHF3W';

async function startTripoTask(promptText) {
  const finalPrompt = (promptText && promptText.trim())
    ? promptText.trim()
    : 'A 3D model of a gourmet artisanal gelato ice cream cone with vibrant colors and rich textures';

  console.log(`🤖 Iniciando generación 3D en Tripo AI con prompt: "${finalPrompt}"`);
  const response = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TRIPO_API_KEY}`
    },
    body: JSON.stringify({
      type: 'text_to_model',
      prompt: finalPrompt
    })
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    console.error('❌ Error en respuesta de Tripo3D API:', data);
    throw new Error(data.message || `Error en la API de Tripo3D (Código ${data.code || response.status})`);
  }

  console.log(`✅ Tarea Tripo3D creada con éxito. Task ID: ${data.data.task_id}`);
  return data.data.task_id;
}

async function getTripoTaskStatus(taskId) {
  try {
    const response = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`
      }
    });

    const data = await response.json();
    if (!response.ok || data.code !== 0) {
      throw new Error(data.message || 'Error al consultar tarea en Tripo3D API');
    }

    const task = data.data;
    const status = task.status; // 'queued', 'running', 'success', 'failed'
    const modelUrl = task.output?.model || task.output?.pbr_model || null;

    return {
      status,
      progress: task.progress || 0,
      modelUrl,
      renderedImage: task.output?.rendered_image || null
    };
  } catch (error) {
    console.error(`Error consultando tarea Tripo3D ${taskId}:`, error.message);
    return { status: 'error', progress: 0, modelUrl: null };
  }
}

const FALLBACK_PRODUCTS = [
  {
    id_producto: 1,
    nombre: 'Fresa Salvaje',
    precio: 12500,
    descripcion: 'Fresas recogidas al amanecer con un toque de balsámico. Intenso, sensual y completamente irresistible.',
    long_desc: 'Una experiencia única elaborada con fresas silvestres de los viñedos de Cundinamarca. Cada fruta es seleccionada a mano al amanecer cuando su azúcar natural está en el punto más alto. El toque de vinagre balsámico envejecido realza la acidez natural creando un perfil de sabor que evoluciona en cada bocado.',
    imagen: '/images/gelato_fresa.png',
    categoria: 'Temporada',
    tags: 'Sin gluten, Frutal, Temporada',
    estado: true,
    destacado: false,
    rating: 4.9,
    reviews: 312
  },
  {
    id_producto: 2,
    nombre: 'Cioccolato Nero',
    precio: 13000,
    descripcion: 'Cacao oscuro 72% de origen. Profundo, aterciopelado y con un final que perdura en el paladar.',
    long_desc: 'Elaborado con cacao de origen único proveniente de las fincas de Tumaco, Nariño. Su proceso de tostado lento a baja temperatura preserva los flavonoides naturales y desarrolla notas complejas de cereza negra, madera ahumada y vainilla. Un gelato para los verdaderos amantes del chocolate.',
    imagen: '/images/gelato_chocolate.png',
    categoria: 'Clásico',
    tags: 'Sin gluten, Intenso, Gourmet',
    estado: true,
    destacado: false,
    rating: 4.8,
    reviews: 489
  },
  {
    id_producto: 3,
    nombre: 'Mango Tropical',
    precio: 11500,
    descripcion: 'Mango de cosecha propia, sin lácteos y sin culpa. Una explosión tropical en cada bocado.',
    long_desc: 'Sorbetto 100% vegano elaborado con mangos Tommy Atkins y Ataúlfo en su punto máximo de madurez. Sin lácteos, sin colorantes artificiales. La textura cremosa se logra gracias a la pectina natural de la fruta y un proceso de maduración controlada que concentra todos los azúcares naturales.',
    imagen: '/images/gelato_mango.png',
    categoria: 'Vegano',
    tags: 'Vegano, Sin lácteos, Sin gluten, Frutal',
    estado: true,
    destacado: false,
    rating: 4.7,
    reviews: 275
  },
  {
    id_producto: 4,
    nombre: 'Frutos del Bosque',
    precio: 13500,
    descripcion: 'Una sinfonía de moras, arándanos y frambuesas silvestres. Color vibrante y sabor antioxidante.',
    long_desc: 'Una mezcla cuidadosamente balanceada de moras de Boyacá, arándanos importados y frambuesas silvestres. Alto en antioxidantes naturales. El color profundo morado es completamente natural, resultado de las antocianinas presentes en las frutas.',
    imagen: '/images/gelato_berries.png',
    categoria: 'Temporada',
    tags: 'Antioxidante, Sin gluten, Frutal',
    estado: true,
    destacado: false,
    rating: 4.9,
    reviews: 201
  },
  {
    id_producto: 5,
    nombre: 'Pistacchio di Bronte',
    precio: 15000,
    descripcion: 'Pistacho DOP de Sicilia tostado lentamente. El gelato más codiciado de nuestra carta gourmet.',
    long_desc: 'Utilizamos exclusivamente pistacho Denominazione di Origine Protetta (DOP) de Bronte, Sicilia — considerado el mejor del mundo. Su proceso incluye un tostado artesanal a 140°C durante 20 minutos, molido en pasta pura sin aditivos.',
    imagen: '/images/gelato_pistacho.png',
    categoria: 'Clásico',
    tags: 'DOP Certificado, Gourmet, Importado',
    estado: true,
    destacado: false,
    rating: 5.0,
    reviews: 147
  },
  {
    id_producto: 6,
    nombre: 'Caramelo Salado',
    precio: 12000,
    descripcion: 'Caramelo artesanal con flor de sal marina. El equilibrio perfecto entre dulzura y sofisticación.',
    long_desc: 'El caramelo se elabora en olla de cobre durante 45 minutos hasta alcanzar el punto exacto de color ámbar profundo. Se añade flor de sal de Manaure, La Guajira, recolectada a mano.',
    imagen: '/images/caramelo salado.png',
    categoria: 'Clásico',
    tags: 'Sin gluten, Artesanal, Bestseller',
    estado: true,
    destacado: false,
    rating: 4.9,
    reviews: 523
  },
  {
    id_producto: 7,
    nombre: 'Vainilla de Madagascar',
    precio: 11000,
    descripcion: 'Vainas de vainilla Bourbon de Madagascar infusionadas 48h en leche entera. Elegancia pura.',
    long_desc: 'Utilizamos vainas de vainilla Bourbon grado A de Madagascar, infusionadas durante 48 horas en leche entera fresca. Cada batch contiene exactamente 3 vainas por litro. El resultado es un gelato de color crema natural con puntitos negros visibles y un aroma que transforma cualquier momento en un ritual.',
    imagen: '/images/vainilla de madagascar.png',
    categoria: 'Clásico',
    tags: 'Sin gluten, Clásico, Gourmet',
    estado: true,
    destacado: false,
    rating: 4.8,
    reviews: 398
  },
  {
    id_producto: 8,
    nombre: 'Limone di Amalfi',
    precio: 11500,
    descripcion: 'Sorbetto de limón Sfusato Amalfitano. Refrescante, vibrante y con una acidez brillante.',
    long_desc: 'Elaborado con zumo y ralladura de limones Sfusato Amalfitano IGP, los limones más aromáticos y menos amargos del Mediterráneo. Un sorbetto completamente vegano y libre de lácteos que captura la esencia del sol mediterráneo. Perfecto como palate cleanser entre platos o como postre refrescante.',
    imagen: '/images/limone di amalfi.png',
    categoria: 'Vegano',
    tags: 'Vegano, Sin lácteos, Sin gluten, Refrescante',
    estado: true,
    destacado: false,
    rating: 4.7,
    reviews: 189
  },
  {
    id_producto: 9,
    nombre: 'Tiramisú Artigianale',
    precio: 14000,
    descripcion: 'Mascarpone italiano, espresso ristretto y savoiardi. El postre de los postres en versión helada.',
    long_desc: 'Una oda al tiramisú clásico italiano en formato gelato. Usamos mascarpone DOP importado, espresso ristretto de grano colombiano tostado en nuestras instalaciones, y savoiardi artesanales desmenuzados. Cada cucharada entrega todas las capas del tiramisú original en una experiencia helada y etérea.',
    imagen: '/images/Tiramisú Artigianale.png',
    categoria: 'Clásico',
    tags: 'Gourmet, Artesanal, Especial',
    estado: true,
    destacado: false,
    rating: 4.9,
    reviews: 267
  },
  {
    id_producto: 10,
    nombre: 'Coco & Lima',
    precio: 12000,
    descripcion: 'Leche de coco tailandesa con lima kaffir. Exótico, cremoso y completamente vegano.',
    long_desc: 'Combinamos leche de coco tailandesa entera (60% extracto) con ralladura y zumo de lima kaffir, la lima más aromática del sudeste asiático. Sin lácteos, sin gluten, la textura cremosa natural del coco crea una experiencia indistinguible de un gelato lácteo tradicional. Un viaje sensorial al trópico.',
    imagen: '/images/Coco & Lima.png',
    categoria: 'Vegano',
    tags: 'Vegano, Sin lácteos, Sin gluten, Tropical',
    estado: true,
    destacado: false,
    rating: 4.6,
    reviews: 143
  },
  {
    id_producto: 11,
    nombre: 'Rosa & Lichi',
    precio: 14500,
    descripcion: 'Agua de rosas de Damasco y lichi fresco. Un gelato perfumado, delicado y absolutamente único.',
    long_desc: 'Creado con agua de rosas destilada de Damasco, Siria — la más apreciada del mundo — y puré de lichi fresco importado. Un sabor que evoca jardines florales y noches exóticas. Limitado a 30 porciones semanales por la disponibilidad del ingrediente principal. Una rareza gastronómica.',
    imagen: '/images/rosa y lichi.png',
    categoria: 'Temporada',
    tags: 'Premium, Edición Limitada, Floral',
    estado: true,
    destacado: false,
    rating: 5.0,
    reviews: 89
  },
  {
    id_producto: 12,
    nombre: 'Matcha Ceremonial',
    precio: 13500,
    descripcion: 'Matcha de grado ceremonial de Uji, Kyoto. Terroso, amargo y profundamente relajante.',
    long_desc: 'Elaborado con matcha de grado ceremonial producido en los jardines de Uji, Kyoto — el origen del matcha japonés por excelencia. Sin colorantes, sin azúcares ocultos. El color verde intenso es 100% natural. Un gelato antioxidante y energizante que encarna la filosofía japonesa de simplicidad y perfección.',
    imagen: '/images/Matcha Ceremonial.png',
    categoria: 'Vegano',
    tags: 'Vegano, Sin lácteos, Antioxidante, Ceremonial',
    estado: true,
    destacado: false,
    rating: 4.8,
    reviews: 176
  }
];

let supabase;

const isSupabaseConfigured = supabaseUrl && 
                             supabaseKey && 
                             !supabaseUrl.includes('your_supabase_url') && 
                             supabaseUrl.startsWith('http');

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key (Bypass RLS)' : 'Anon Key';
    console.log(`✅ Cliente Supabase inicializado correctamente con ${keyType}.`);

    // Auto-crear tabla admin_face_rekognition si no existe
    supabase.from('admin_face_rekognition').select('id').limit(1).then(({ error }) => {
      if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.message?.includes('not found'))) {
        console.log('ℹ️ Tabla admin_face_rekognition no encontrada, creando...');
        const createSql = `
          CREATE TABLE IF NOT EXISTS public.admin_face_rekognition (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            aws_face_id TEXT UNIQUE NOT NULL,
            id_usuario INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE public.admin_face_rekognition ENABLE ROW LEVEL SECURITY;
        `;
        fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ sql: createSql })
        }).then(r => {
          if (r.ok) console.log('✅ Tabla admin_face_rekognition creada automáticamente.');
          else console.warn('⚠️ No se pudo auto-crear la tabla. Ejecútalo manualmente en el SQL Editor de Supabase.');
        }).catch(() => console.warn('⚠️ No se pudo auto-crear la tabla. Ejecútalo manualmente en el SQL Editor de Supabase.'));
      }
    });
  } catch (err) {
    console.error('❌ Error al inicializar Supabase:', err);
  }
}

if (!supabase) {
  console.warn('⚠️ Advertencia: Usando base de datos en memoria (Mock Supabase) debido a la falta de configuración válida.');
  
  // Base de datos local simulada en memoria
  const mockDb = {
    producto: FALLBACK_PRODUCTS,
    usuario: [
      { id_usuario: 1, nombre: 'Admin', apellido: 'SuperGelatto', email: 'saldarriagac890@gmail.com', password_hash: '$2a$10$GamiM2h7IwlRhosL5hQD0.OSBb2rdwSXVmkfpQS1rNOTkC2.Cw3zK', rol: 'admin' },
      { id_usuario: 2, nombre: 'Admin', apellido: 'Secundario', email: 'admin@supergelatto.com', password_hash: '$2a$10$GamiM2h7IwlRhosL5hQD0.OSBb2rdwSXVmkfpQS1rNOTkC2.Cw3zK', rol: 'admin' },
      { id_usuario: 3, nombre: 'Cliente', apellido: 'Prueba', email: 'cliente@supergelatto.com', password_hash: '$2a$10$.2ki7UXxL2rjAX8VqUIIEewGFKxfLiGpqLeXZLX6oN7elDoMDQJU6', rol: 'cliente' }
    ],
    rostros_admin: [],
    venta: []
  };

  const makeQueryBuilder = (tableName) => {
    let queryData = [...(mockDb[tableName] || [])];
    
    const builder = {
      select: (fields) => {
        return builder;
      },
      eq: (field, value) => {
        queryData = queryData.filter(item => String(item[field]) === String(value));
        return builder;
      },
      order: (field, options) => {
        const asc = options?.ascending !== false;
        queryData.sort((a, b) => {
          if (a[field] < b[field]) return asc ? -1 : 1;
          if (a[field] > b[field]) return asc ? 1 : -1;
          return 0;
        });
        return builder;
      },
      limit: (n) => {
        queryData = queryData.slice(0, n);
        return builder;
      },
      single: async () => {
        const item = queryData[0];
        return { data: item || null, error: item ? null : { message: 'Not found' } };
      },
      insert: (arr) => {
        const newItems = arr.map((item) => {
          const nextId = mockDb[tableName].length + 1;
          return {
            id_usuario: nextId,
            id_producto: nextId,
            id_venta: nextId,
            id_detalle_venta: nextId,
            fecha: new Date().toISOString(),
            ...item
          };
        });
        mockDb[tableName].push(...newItems);
        queryData = newItems;
        return builder;
      },
      upsert: (obj) => {
        const item = Array.isArray(obj) ? obj[0] : obj;
        if (!mockDb[tableName]) mockDb[tableName] = [];
        const existingIdx = mockDb[tableName].findIndex(i => i.id_usuario === item.id_usuario);
        if (existingIdx >= 0) {
          Object.assign(mockDb[tableName][existingIdx], item);
        } else {
          mockDb[tableName].push({ ...item });
        }
        return Promise.resolve({ data: item, error: null });
      },
      in: (field, values) => {
        queryData = queryData.filter(item => values.includes(item[field]));
        return builder;
      },
      delete: async () => {
        const idsToRemove = queryData.map(item => item.id_usuario || item.id_producto || item.id_venta);
        mockDb[tableName] = mockDb[tableName].filter(item => {
          const id = item.id_usuario || item.id_producto || item.id_venta;
          return !idsToRemove.includes(id);
        });
        return { data: null, error: null };
      },
      then: (onfulfilled, onrejected) => {
        return Promise.resolve({ data: queryData, error: null }).then(onfulfilled, onrejected);
      }
    };
    return builder;
  };

  supabase = {
    from: (tableName) => makeQueryBuilder(tableName),
    rpc: (name, args) => {
      return Promise.resolve({ data: [], error: null });
    }
  };
}

const app = express();
app.use(compression());
const PORT = process.env.PORT || 5000;
const saltRounds = 10; // <--- Configuración de seguridad

// Middleware - CORS Configurado seguro para permitir solo el origen del frontend
const allowedOrigins = ['http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes('*') ||
      allowedOrigins.indexOf(origin) !== -1 ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Acceso denegado por la política CORS del servidor.'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// In-memory reset token store
const resetTokens = [];

// ─── Email Transport ────────────────────────────────────────
let transporter = null;
async function getTransporter() {
  if (transporter) return transporter;

  // Configuración SMTP Real (si existe en .env)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  // Test account (Ethereal) fallback para entorno de desarrollo
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  return transporter;
}

// ─── Helpers ────────────────────────────────────────────────
function generateResetToken() { return crypto.randomBytes(32).toString('hex'); }

function cleanExpiredTokens() {
  const now = Date.now();
  for (let i = resetTokens.length - 1; i >= 0; i--) {
    if (resetTokens[i].expiresAt < now) resetTokens.splice(i, 1);
  }
}

// Sanitización XSS: Escapa caracteres peligrosos (<, >, &, ", ', /)
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Validación de caracteres prohibidos para inputs
function hasForbiddenChars(str) {
  if (typeof str !== 'string') return false;
  return /[<>&"'\/]/.test(str);
}

// Middleware seguro para validar que la petición incluye un JWT válido de Administrador
function requireAuthenticatedAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.headers['x-user-token'];

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. No se proporcionó un token de autenticación.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.rol !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token de sesión inválido o expirado. Por favor inicia sesión nuevamente.' });
  }
}

// Alias para mantener compatibilidad con rutas existentes
const requireAdmin = requireAuthenticatedAdmin;

// Helper para asignar imágenes reales basadas en el nombre
function getProductImage(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('fresa') || n.includes('romeo')) return '/images/gelato_fresa.png';
  if (n.includes('chocolate')) return '/images/gelato_chocolate.png';
  if (n.includes('mango')) return '/images/gelato_mango.png';
  if (n.includes('pistacho')) return '/images/gelato_pistacho.png';
  if (n.includes('coco')) return '/images/Coco & Lima.png';
  if (n.includes('vainilla')) return '/images/vainilla de madagascar.png';
  if (n.includes('matcha')) return '/images/Matcha Ceremonial.png';
  if (n.includes('tiramisu') || n.includes('tiramisú')) return '/images/Tiramisú Artigianale.png';
  if (n.includes('caramelo')) return '/images/caramelo salado.png';
  if (n.includes('limon') || n.includes('limone')) return '/images/limone di amalfi.png';
  if (n.includes('rosa')) return '/images/rosa y lichi.png';
  return '/images/gelato_berries.png'; // Default
}

// Mapa de datos nutricionales, ingredientes y alérgenos por nombre de producto
const FLAVOR_DATA_MAP = [
  {
    keys: ['fresa'],
    ingredients: ['Fresas silvestres', 'Azúcar de caña', 'Leche entera', 'Crema de leche', 'Vinagre balsámico', 'Zumo de limón'],
    allergens: ['Lácteos'],
    nutrition: { calorias: 210, grasas: 8, carbos: 32, proteinas: 4 },
    flavorProfile: [
      { label: 'Dulzura', value: 75 }, { label: 'Acidez', value: 60 },
      { label: 'Cremosidad', value: 80 }, { label: 'Intensidad', value: 85 },
    ],
    origin: 'Cundinamarca, CO',
  },
  {
    keys: ['chocolate', 'cioccolato'],
    ingredients: ['Cacao 72% Tumaco', 'Azúcar moscabado', 'Leche entera', 'Crema de leche', 'Yemas de huevo', 'Extracto de vainilla'],
    allergens: ['Lácteos', 'Huevo', 'Cacao'],
    nutrition: { calorias: 265, grasas: 14, carbos: 28, proteinas: 5 },
    flavorProfile: [
      { label: 'Dulzura', value: 50 }, { label: 'Amargor', value: 70 },
      { label: 'Cremosidad', value: 90 }, { label: 'Intensidad', value: 95 },
    ],
    origin: 'Tumaco, Nariño CO',
  },
  {
    keys: ['mango'],
    ingredients: ['Mango Tommy Atkins', 'Mango Ataúlfo', 'Azúcar de palma', 'Zumo de maracuyá', 'Zumo de limón'],
    allergens: ['Ninguno'],
    nutrition: { calorias: 160, grasas: 0, carbos: 40, proteinas: 1 },
    flavorProfile: [
      { label: 'Dulzura', value: 85 }, { label: 'Acidez', value: 50 },
      { label: 'Frescura', value: 90 }, { label: 'Intensidad', value: 80 },
    ],
    origin: 'Valle del Cauca, CO',
  },
  {
    keys: ['bosque', 'berries', 'frutos'],
    ingredients: ['Moras de Boyacá', 'Arándanos silvestres', 'Frambuesas', 'Leche entera', 'Crema de leche', 'Azúcar de caña'],
    allergens: ['Lácteos'],
    nutrition: { calorias: 195, grasas: 7, carbos: 30, proteinas: 4 },
    flavorProfile: [
      { label: 'Dulzura', value: 65 }, { label: 'Acidez', value: 70 },
      { label: 'Cremosidad', value: 75 }, { label: 'Intensidad', value: 88 },
    ],
    origin: 'Boyacá, CO',
  },
  {
    keys: ['pistacho', 'pistacchio'],
    ingredients: ['Pistacho DOP Bronte 40%', 'Leche entera', 'Crema de leche', 'Azúcar de caña', 'Yemas de huevo'],
    allergens: ['Pistacho', 'Lácteos', 'Huevo'],
    nutrition: { calorias: 310, grasas: 18, carbos: 26, proteinas: 8 },
    flavorProfile: [
      { label: 'Dulzura', value: 55 }, { label: 'Nuttiness', value: 95 },
      { label: 'Cremosidad', value: 95 }, { label: 'Intensidad', value: 92 },
    ],
    origin: 'Bronte, Sicilia IT',
  },
  {
    keys: ['caramelo'],
    ingredients: ['Azúcar caramelizado', 'Flor de sal La Guajira', 'Leche entera', 'Crema extra grasa', 'Mantequilla artesanal', 'Extracto de vainilla'],
    allergens: ['Lácteos'],
    nutrition: { calorias: 280, grasas: 16, carbos: 35, proteinas: 3 },
    flavorProfile: [
      { label: 'Dulzura', value: 80 }, { label: 'Salinidad', value: 55 },
      { label: 'Cremosidad', value: 95 }, { label: 'Intensidad', value: 85 },
    ],
    origin: 'La Guajira, CO',
  },
  {
    keys: ['vainilla'],
    ingredients: ['Vainilla Bourbon Madagascar', 'Leche entera', 'Crema de leche', 'Yemas de huevo', 'Azúcar de caña'],
    allergens: ['Lácteos', 'Huevo'],
    nutrition: { calorias: 230, grasas: 12, carbos: 27, proteinas: 5 },
    flavorProfile: [
      { label: 'Dulzura', value: 70 }, { label: 'Floral', value: 65 },
      { label: 'Cremosidad', value: 98 }, { label: 'Intensidad', value: 60 },
    ],
    origin: 'Madagascar / Bogotá CO',
  },
  {
    keys: ['limon', 'limone', 'amalfi'],
    ingredients: ['Limón Sfusato Amalfitano IGP', 'Azúcar de caña', 'Agua mineral', 'Ralladura de limón', 'Jarabe de glucosa'],
    allergens: ['Ninguno'],
    nutrition: { calorias: 130, grasas: 0, carbos: 34, proteinas: 0 },
    flavorProfile: [
      { label: 'Dulzura', value: 45 }, { label: 'Acidez', value: 90 },
      { label: 'Frescura', value: 98 }, { label: 'Intensidad', value: 82 },
    ],
    origin: 'Amalfi, Italia / Bogotá CO',
  },
  {
    keys: ['tiramisu', 'tiramisú'],
    ingredients: ['Mascarpone DOP', 'Espresso ristretto', 'Savoiardi artesanales', 'Yemas de huevo', 'Leche entera', 'Cacao en polvo'],
    allergens: ['Lácteos', 'Huevo', 'Gluten', 'Cafeína'],
    nutrition: { calorias: 295, grasas: 17, carbos: 29, proteinas: 6 },
    flavorProfile: [
      { label: 'Dulzura', value: 65 }, { label: 'Café', value: 80 },
      { label: 'Cremosidad', value: 95 }, { label: 'Intensidad', value: 90 },
    ],
    origin: 'Receta veneciana / Bogotá CO',
  },
  {
    keys: ['coco'],
    ingredients: ['Leche de coco tailandesa', 'Lima kaffir', 'Azúcar de coco', 'Ralladura de lima', 'Aceite de coco virgen'],
    allergens: ['Coco'],
    nutrition: { calorias: 200, grasas: 12, carbos: 25, proteinas: 2 },
    flavorProfile: [
      { label: 'Dulzura', value: 60 }, { label: 'Acidez', value: 55 },
      { label: 'Cremosidad', value: 85 }, { label: 'Exotismo', value: 92 },
    ],
    origin: 'Tailandia / Bogotá CO',
  },
  {
    keys: ['rosa', 'lichi'],
    ingredients: ['Agua de rosas Damasco', 'Puré de lichi fresco', 'Leche entera', 'Crema de leche', 'Azúcar de caña'],
    allergens: ['Lácteos'],
    nutrition: { calorias: 215, grasas: 9, carbos: 30, proteinas: 4 },
    flavorProfile: [
      { label: 'Dulzura', value: 70 }, { label: 'Floral', value: 95 },
      { label: 'Cremosidad', value: 80 }, { label: 'Exotismo', value: 97 },
    ],
    origin: 'Damasco SY / Bogotá CO',
  },
  {
    keys: ['matcha'],
    ingredients: ['Matcha ceremonial Uji', 'Leche de avena', 'Azúcar de caña', 'Jarabe de arroz', 'Aceite de coco'],
    allergens: ['Avena'],
    nutrition: { calorias: 175, grasas: 5, carbos: 28, proteinas: 3 },
    flavorProfile: [
      { label: 'Dulzura', value: 35 }, { label: 'Amargor', value: 75 },
      { label: 'Cremosidad', value: 80 }, { label: 'Umami', value: 88 },
    ],
    origin: 'Uji, Kyoto JP / Bogotá CO',
  },
];

// Busca en el mapa de sabores por nombre de producto
function getFlavorData(name) {
  const n = (name || '').toLowerCase();
  const match = FLAVOR_DATA_MAP.find(entry => entry.keys.some(k => n.includes(k)));
  return match || null;
}

// ─── Register (CON BCRYPT) ──────────────────────────────────
app.post('/api/register', async (req, res) => {
  let { name, lastName, email, password, confirmPassword } = req.body;

  if (hasForbiddenChars(name) || hasForbiddenChars(lastName) || hasForbiddenChars(email)) {
    return res.status(400).json({ message: 'No se permiten caracteres especiales peligrosos (< > & " \' /).' });
  }

  // 1. Sanitización (SENA standard)
  name = sanitizeInput(name);
  lastName = sanitizeInput(lastName);
  email = sanitizeInput(email);

  // 2. Validación de tipos y presencia (SENA standard)
  if (!name || typeof name !== 'string' || !email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Nombre y email deben ser textos válidos.' });
  }

  if (!password || !confirmPassword) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  // 3. Lógica de negocio (SENA standard)
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
  }

  // Nuevas reglas estrictas (SENA)
  if (/\s/.test(email) || /^\s/.test(email)) {
    return res.status(400).json({ message: 'El correo no puede contener espacios.' });
  }
  if (/\s/.test(password)) {
    return res.status(400).json({ message: 'La contraseña no puede contener espacios.' });
  }
  if (name !== name.trim() || /^\s/.test(name)) {
    return res.status(400).json({ message: 'El nombre no puede tener espacios al inicio ni al final.' });
  }
  if (/\s{2,}/.test(name)) {
    return res.status(400).json({ message: 'Solo se permite un espacio sencillo entre palabras.' });
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido (sin caracteres especiales) terminado en .com, .net o .edu.' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'La contraseña debe tener 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.' });
  }

  // Verificar si el usuario ya existe
  const { data: existingUser } = await supabase.from('usuario').select('email').eq('email', email).single();
  if (existingUser) return res.status(409).json({ message: 'El email ya está registrado.' });

  try {
    // ENCRIPTAR CONTRASEÑA
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { data: newUser, error: registerError } = await supabase
      .from('usuario')
      .insert([{ nombre: name, apellido: lastName || '', email, password_hash: hashedPassword, rol: 'cliente' }])
      .select().single();

    if (registerError) throw registerError;

    return res.status(201).json({ message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// ─── Login (CON BCRYPT) ─────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: 'Campos obligatorios.' });

  if (hasForbiddenChars(email)) {
    return res.status(400).json({ message: 'No se permiten caracteres especiales peligrosos (< > & " \' /).' });
  }

  if (/\s/.test(email) || /^\s/.test(email)) {
    return res.status(400).json({ message: 'El correo no puede contener espacios.' });
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido (sin caracteres especiales) terminado en .com, .net o .edu.' });
  }

  const { data: user, error } = await supabase.from('usuario').select('*').eq('email', email).single();

  if (error || !user) return res.status(401).json({ message: 'Email o contraseña incorrectos.' });

  // COMPARAR HASH Y MIGRACIÓN LEGACY
  const isMatch = await bcrypt.compare(password, user.password_hash);
  
  if (!isMatch) {
    // Si no hace match con bcrypt, comprobamos si es una contraseña en texto plano antigua
    if (password === user.password_hash) {
      // MIGRACIÓN AUTOMÁTICA: Convertir texto plano a bcrypt hash
      const newHash = await bcrypt.hash(password, saltRounds);
      await supabase.from('usuario').update({ password_hash: newHash }).eq('id_usuario', user.id_usuario);
    } else {
      return res.status(401).json({ message: 'Email o contraseña incorrectos.' });
    }
  }

  // GENERAR TOKEN JWT FIRMADO
  const token = jwt.sign(
    { id_usuario: user.id_usuario, email: user.email, rol: user.rol },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.status(200).json({
    ok: true,
    message: 'Inicio de sesión exitoso.',
    token,
    user: { id: user.id_usuario, id_usuario: user.id_usuario, name: user.nombre, email: user.email, rol: user.rol }
  });
});

// ─── AWS Rekognition (Reconocimiento Facial Admin) ─────────────────

// 1. Registro Facial con AWS Rekognition (Protegido Admin)
app.post('/api/admin/faceid/rekognition-register', requireAuthenticatedAdmin, async (req, res) => {
  try {
    const { image } = req.body;
    const userId = req.user.id_usuario;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ ok: false, message: 'La imagen en base64 es obligatoria.' });
    }

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    const command = new IndexFacesCommand({
      CollectionId: rekognitionCollectionId,
      Image: { Bytes: imageBuffer },
      ExternalImageId: String(userId),
      MaxFaces: 1,
      QualityFilter: 'AUTO',
      DetectionAttributes: []
    });

    const response = await rekognitionClient.send(command);

    if (!response.FaceRecords || response.FaceRecords.length === 0 || !response.FaceRecords[0]?.Face?.FaceId) {
      return res.status(400).json({
        ok: false,
        message: 'No se detectó ningún rostro claro en la imagen. Asegúrate de tener buena iluminación y mirar de frente a la cámara.'
      });
    }

    const faceId = response.FaceRecords[0].Face.FaceId;

    // Guardar estrictamente en Supabase (sin respaldo en memoria)
    const { error: dbErr } = await supabase
      .from('admin_face_rekognition')
      .insert([{ aws_face_id: faceId, id_usuario: userId }]);

    if (dbErr) {
      console.error('❌ Error al guardar registro facial en Supabase:', dbErr);
      return res.status(500).json({
        ok: false,
        message: 'Error al guardar la vinculación facial en la base de datos. Por favor reintenta.'
      });
    }

    return res.status(200).json({
      ok: true,
      message: '¡Reconocimiento facial registrado exitosamente con AWS Rekognition!',
      faceId
    });
  } catch (err) {
    console.error('Error al registrar rostro en AWS Rekognition:', err);
    let msg = err.message || 'Error al procesar el reconocimiento facial en AWS Rekognition.';
    if (err.name === 'UnrecognizedClientException' || err.name === 'InvalidSignatureException' || (msg && msg.includes('security token included in the request is invalid'))) {
      msg = 'Las credenciales de AWS (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) en tu backend/.env son inválidas o han expirado en AWS IAM. Por favor actualiza tus llaves de AWS.';
    }
    return res.status(500).json({
      ok: false,
      message: msg
    });
  }
});

// 2. Login Facial con AWS Rekognition (Público)
app.post('/api/admin/faceid/rekognition-login', async (req, res) => {
  const genericError = { ok: false, message: 'Reconocimiento facial no reconocido o acceso denegado.' };
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json(genericError);
    }

    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    const command = new SearchFacesByImageCommand({
      CollectionId: rekognitionCollectionId,
      Image: { Bytes: imageBuffer },
      MaxFaces: 1,
      FaceMatchThreshold: 75
    });

    const response = await rekognitionClient.send(command);
    const SIMILARITY_THRESHOLD = 75;

    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      console.warn('⚠️ rekognition-login: AWS no encontró ninguna coincidencia facial.');
      return res.status(401).json(genericError);
    }

    const match = response.FaceMatches[0];
    console.log(`ℹ️ rekognition-login: similarity=${match.Similarity?.toFixed(2)}% faceId=${match.Face?.FaceId}`);
    if (!match.Similarity || match.Similarity < SIMILARITY_THRESHOLD || !match.Face?.FaceId) {
      console.warn(`⚠️ rekognition-login: similarity ${match.Similarity?.toFixed(2)}% < ${SIMILARITY_THRESHOLD}% (umbral mínimo)`);
      return res.status(401).json(genericError);
    }

    const matchedFaceId = match.Face.FaceId;

    // Buscar id_usuario vinculado ÚNICAMENTE en la base de datos Supabase
    const { data: faceRecord, error: faceErr } = await supabase
      .from('admin_face_rekognition')
      .select('id_usuario')
      .eq('aws_face_id', matchedFaceId)
      .maybeSingle();

    if (faceErr || !faceRecord || !faceRecord.id_usuario) {
      console.warn('⚠️ Rostro reconocido por AWS pero no encontrado en la tabla admin_face_rekognition:', faceErr?.message || matchedFaceId);
      return res.status(401).json(genericError);
    }

    const userId = faceRecord.id_usuario;

    // Buscar el usuario real en la tabla "usuario" de Supabase
    const { data: user, error: userErr } = await supabase
      .from('usuario')
      .select('*')
      .eq('id_usuario', userId)
      .maybeSingle();

    if (userErr || !user || user.rol !== 'admin') {
      console.warn('⚠️ Usuario no encontrado o no posee rol admin:', userErr?.message || userId);
      return res.status(401).json(genericError);
    }

    const token = jwt.sign(
      { id_usuario: user.id_usuario, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      ok: true,
      message: 'Inicio de sesión facial exitoso.',
      token,
      user: { id: user.id_usuario, id_usuario: user.id_usuario, name: user.nombre, email: user.email, rol: user.rol }
    });
  } catch (err) {
    console.error('Error al autenticar por rostro en AWS Rekognition:', err);
    return res.status(401).json(genericError);
  }
});



// ─── Google Login ───────────────────────────────────────────
app.post('/api/google-login', async (req, res) => {
  const { email, name } = req.body;

  if (!email) return res.status(400).json({ message: 'Email es obligatorio.' });

  // 1. Buscar si el usuario ya existe
  const { data: user, error } = await supabase.from('usuario').select('*').eq('email', email).single();

  if (user) {
    // Si existe, lo logueamos directamente (Google ya validó su identidad)
    return res.status(200).json({
      message: 'Inicio de sesión con Google exitoso.',
      user: { id: user.id_usuario, name: user.nombre, email: user.email, rol: user.rol }
    });
  }

  // 2. Si no existe, lo registramos automáticamente
  try {
    // Generamos una contraseña aleatoria super segura que pasa el regex
    const randomPassword = "Gg1!" + crypto.randomBytes(12).toString('hex') + "@#";
    const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

    const { data: newUser, error: registerError } = await supabase
      .from('usuario')
      .insert([{ nombre: name, apellido: '', email, password_hash: hashedPassword, rol: 'cliente' }])
      .select().single();

    if (registerError) throw registerError;

    return res.status(200).json({
      message: 'Registro e inicio de sesión con Google exitoso.',
      user: { id: newUser.id_usuario, name: newUser.nombre, email: newUser.email, rol: newUser.rol }
    });
  } catch (err) {
    console.error('Error en Google Login:', err);
    return res.status(500).json({ message: 'Error al vincular cuenta de Google.' });
  }
});

// ─── Forgot Password ───────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email es obligatorio.' });

  if (hasForbiddenChars(email)) {
    return res.status(400).json({ message: 'No se permiten caracteres especiales peligrosos (< > & " \' /).' });
  }

  if (/\s/.test(email) || /^\s/.test(email)) {
    return res.status(400).json({ message: 'El correo no puede contener espacios.' });
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido (sin caracteres especiales) terminado en .com, .net o .edu.' });
  }
  const genericMessage = 'Si este correo está registrado, recibirás un enlace.';

  const { data: dbUser } = await supabase.from('usuario').select('nombre, email').eq('email', email).single();
  if (!dbUser) return res.status(200).json({ message: genericMessage });

  cleanExpiredTokens();
  const token = generateResetToken();
  resetTokens.push({ token, email, expiresAt: Date.now() + 3600000, used: false });

  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;

  try {
    const emailTransporter = await getTransporter();
    const fromEmail = process.env.SMTP_USER || 'no-reply@supergelatto.com';
    const info = await emailTransporter.sendMail({
      from: `"super gelatto 🍦" <${fromEmail}>`,
      to: email,
      subject: '🔐 Restablecer contraseña',
      html: `<p>Hola ${dbUser.nombre}, haz clic aquí: <a href="${resetLink}">${resetLink}</a></p>`
    });
    
    // Obtener link de Ethereal solo si no se configuró un SMTP real
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📬 Preview Link (Ethereal): ${previewUrl}`);
    } else {
      console.log(`📬 Correo de recuperación enviado a: ${email}`);
    }
    
    // En el modo desarrollador, podemos devolver la previewUrl para mostrarla en pantalla
    return res.status(200).json({ message: genericMessage, previewUrl: previewUrl || undefined });
  } catch (err) {
    console.error('Error al enviar email:', err);
    return res.status(500).json({ message: 'Error al enviar email.' });
  }
});

// ─── Reset Password (CON BCRYPT & SUPABASE) ────────────────
app.post('/api/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) return res.status(400).json({ message: 'Todos los campos son obligatorios.' });

  if (password !== confirmPassword) return res.status(400).json({ message: 'No coinciden.' });

  if (password.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'La contraseña debe tener 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.' });
  }

  if (/\s/.test(password)) {
    return res.status(400).json({ message: 'La contraseña no puede contener espacios.' });
  }

  cleanExpiredTokens();
  const tokenEntry = resetTokens.find(t => t.token === token && !t.used);
  if (!tokenEntry) return res.status(400).json({ message: 'Token inválido o expirado.' });

  try {
    // ENCRIPTAR NUEVA CONTRASEÑA
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { error } = await supabase
      .from('usuario')
      .update({ password_hash: hashedPassword })
      .eq('email', tokenEntry.email);

    if (error) throw error;

    tokenEntry.used = true;
    return res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar.' });
  }
});

// ─── Orders (using 'venta' table for sales) ────────────────
app.get('/api/orders/:userId', async (req, res) => {
  const { userId } = req.params;
  const { data: orders, error } = await supabase
    .from('venta')
    .select('*')
    .eq('id_usuario', userId)
    .order('fecha', { ascending: false });

  if (error) {
    console.error('SUPABASE ERROR (fetching orders):', error);
    return res.status(500).json({ message: 'Error al obtener pedidos.', error: error.message });
  }
  return res.status(200).json(orders);
});

app.post('/api/orders', async (req, res) => {
  const { userId, total, items } = req.body;

  // 1. Validación de tipos y negocio (SENA standard)
  if (!userId || isNaN(total) || total <= 0) {
    return res.status(400).json({ message: 'Datos de pedido inválidos o total debe ser positivo.' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'El carrito no puede estar vacío.' });
  }

  try {
    // 1. Registrar la venta en la base de datos
    const { data: newOrder, error } = await supabase
      .from('venta')
      .insert([{ 
        id_usuario: userId, 
        total: total, 
        fecha: new Date().toISOString()
      }])
      .select().single();

    if (error) throw error;

    // 1.1 Insertar detalles en detalle_venta y descontar stock de cada producto
    for (const item of items) {
      const prodId = item.id;
      const qty = item.quantity || 1;

      if (prodId) {
        // Registrar en detalle_venta
        await supabase.from('detalle_venta').insert([{
          id_venta: newOrder.id_venta,
          id_producto: prodId,
          cantidad: qty,
          precio_unitario: item.price || 0
        }]);

        // Consultar stock actual y descontar
        const { data: prodData } = await supabase.from('producto').select('stock').eq('id_producto', prodId).single();
        if (prodData && prodData.stock !== undefined) {
          const newStock = Math.max(0, prodData.stock - qty);
          await supabase.from('producto').update({ stock: newStock }).eq('id_producto', prodId);
          await supabase.from('inventario').update({ stock_disponible: newStock, fecha_actualizacion: new Date().toISOString() }).eq('id_producto', prodId);
        }
      }
    }

    // 2. Obtener datos del usuario para el correo
    const { data: user, error: userError } = await supabase
      .from('usuario')
      .select('nombre, email')
      .eq('id_usuario', userId)
      .single();

    if (user && !userError) {
      // 3. Preparar detalles del pedido
      const deliveryTime = Math.floor(Math.random() * (45 - 30 + 1) + 30); // 30-45 mins
      const itemsHtml = items && items.length > 0 
        ? `<ul>${items.map(item => `<li><strong>${item.name}</strong> x ${item.quantity} - $${item.price}</li>`).join('')}</ul>`
        : '<p>Detalles del pedido no disponibles.</p>';

      // 4. Enviar correo de confirmación
      try {
        const emailTransporter = await getTransporter();
        const fromEmail = process.env.SMTP_USER || 'no-reply@supergelatto.com';
        
        await emailTransporter.sendMail({
          from: `"super gelatto 🍦" <${fromEmail}>`,
          to: user.email,
          subject: '🍦 ¡Tu pedido está en camino!',
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
              <h2 style="color: #ac2a5d; text-align: center;">¡Hola ${user.nombre}!</h2>
              <p style="font-size: 16px; text-align: center;">Gracias por elegir <strong>super gelatto</strong>. Tu pedido ha sido confirmado con éxito.</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #705d00;">Resumen de tu pedido:</h3>
                ${itemsHtml}
                <p style="font-size: 18px; border-top: 1px solid #ddd; padding-top: 10px;"><strong>Total: $${total}</strong></p>
              </div>
              
              <div style="text-align: center; margin: 30px 0; padding: 20px; border: 2px dashed #ac2a5d; border-radius: 15px;">
                <span style="font-size: 24px;">🚚</span>
                <h3 style="margin: 10px 0;">Tiempo estimado de entrega:</h3>
                <p style="font-size: 22px; font-weight: bold; color: #ac2a5d; margin: 0;">${deliveryTime} minutos</p>
              </div>
              
              <p style="text-align: center; color: #888; font-size: 12px;">Si tienes alguna duda, contáctanos respondiendo a este correo.</p>
              <p style="text-align: center; font-weight: bold; color: #ac2a5d;">¡Que lo disfrutes! 🍦✨</p>
            </div>
          `
        });
        console.log(`📧 Correo de confirmación enviado a: ${user.email}`);
      } catch (mailErr) {
        console.error('Error enviando correo de confirmación:', mailErr);
      }
    }

    return res.status(201).json({ message: 'Pedido creado exitosamente.', order: newOrder });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ message: 'Error al procesar el pedido.' });
  }
});

// ─── Update User Profile ─────────────────────────────────────
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  let { name, email } = req.body;

  if (hasForbiddenChars(name) || hasForbiddenChars(email)) {
    return res.status(400).json({ message: 'No se permiten caracteres especiales peligrosos (< > & " \' /).' });
  }

  // 1. Sanitización (SENA standard)
  name = sanitizeInput(name);
  email = sanitizeInput(email);

  if (!name || !email) {
    return res.status(400).json({ message: 'Nombre y email son obligatorios.' });
  }

  if (/\s/.test(email) || /^\s/.test(email)) {
    return res.status(400).json({ message: 'El correo no puede contener espacios.' });
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido (sin caracteres especiales) terminado en .com, .net o .edu.' });
  }

  if (name !== name.trim() || /^\s/.test(name)) {
    return res.status(400).json({ message: 'El nombre no puede tener espacios al inicio ni al final.' });
  }
  if (/\s{2,}/.test(name)) {
    return res.status(400).json({ message: 'Solo se permite un espacio sencillo entre palabras.' });
  }

  try {
    const { data: updatedUser, error } = await supabase
      .from('usuario')
      .update({ nombre: name, email: email })
      .eq('id_usuario', id)
      .select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'El email ya está en uso.' });
      throw error;
    }

    return res.status(200).json({
      message: 'Perfil actualizado correctamente.',
      user: { id: updatedUser.id_usuario, name: updatedUser.nombre, email: updatedUser.email }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Error al actualizar el perfil.' });
  }
});

// ─── Admin Dashboard ──────────────────────────────────────────
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  // Nota: En producción, aquí debe haber un middleware que verifique que el token del usuario es de rol "admin"
  try {
    // Obtener usuarios
    const { data: users, error: userError } = await supabase
      .from('usuario')
      .select('id_usuario, nombre, apellido, email, rol, fecha_registro')
      .order('fecha_registro', { ascending: false });

    if (userError) throw userError;

    // Obtener ventas combinando Supabase y FALLBACK_SALES en tiempo real
    let rawSales = [];
    try {
      const { data: salesData, error: salesErr } = await supabase
        .from('venta')
        .select('id_venta, id_usuario, total, fecha, estado')
        .order('fecha', { ascending: false });
      
      if (salesErr) {
        console.warn('Advertencia obteniendo ventas de Supabase:', salesErr.message);
      } else if (salesData) {
        rawSales = salesData;
      }
    } catch (e) {
      console.warn('Error al obtener ventas:', e);
    }

    const salesMap = new Map();
    rawSales.forEach(s => salesMap.set(String(s.id_venta), s));
    FALLBACK_SALES.forEach(s => {
      if (!salesMap.has(String(s.id_venta))) {
        salesMap.set(String(s.id_venta), s);
      }
    });

    const combinedRawSales = Array.from(salesMap.values()).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const sales = combinedRawSales.map(s => {
      const u = (users || []).find(usr => String(usr.id_usuario) === String(s.id_usuario));
      return {
        ...s,
        email: s.email || (u ? u.email : null),
        nombre: s.nombre || (u ? u.nombre : null),
        apellido: s.apellido || (u ? u.apellido : null),
        estado: s.estado || 'En proceso'
      };
    });

    // Obtener productos
    let products = [];
    try {
      const { data: prodData } = await supabase.from('producto').select('*').order('id_producto', { ascending: true });
      if (prodData && prodData.length > 0) {
        products = prodData.map(p => ({
          id: p.id_producto,
          name: p.nombre,
          precio: p.precio,
          desc: p.descripcion,
          image: p.imagen || getProductImage(p.nombre),
          categoria: p.categoria || 'Clásico',
          destacado: Boolean(p.destacado !== undefined ? p.destacado : false),
          stock: p.stock !== undefined && p.stock !== null ? Number(p.stock) : (p.stock_disponible !== undefined && p.stock_disponible !== null ? Number(p.stock_disponible) : 50)
        }));
      } else {
        products = FALLBACK_PRODUCTS.map(p => ({
          id: p.id_producto,
          name: p.nombre,
          precio: p.precio,
          desc: p.descripcion,
          image: p.imagen || getProductImage(p.nombre),
          categoria: p.categoria || 'Clásico',
          destacado: Boolean(p.destacado !== undefined ? p.destacado : false),
          stock: p.stock !== undefined && p.stock !== null ? Number(p.stock) : 50
        }));
      }
    } catch (e) {
      products = FALLBACK_PRODUCTS.map(p => ({
        id: p.id_producto,
        name: p.nombre,
        precio: p.precio,
        desc: p.descripcion,
        image: p.imagen || getProductImage(p.nombre),
        categoria: p.categoria || 'Clásico',
        destacado: Boolean(p.destacado !== undefined ? p.destacado : false),
        stock: p.stock !== undefined && p.stock !== null ? Number(p.stock) : 50
      }));
    }

    // Calcular estadísticas
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const activeUsers = users.filter(u => u.rol === 'cliente').length;

    return res.status(200).json({
      stats: {
        totalRevenue,
        activeUsers,
        totalSales: sales.length
      },
      users,
      sales,
      products
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return res.status(500).json({ message: 'Error al obtener datos del panel de control.' });
  }
});

const SUPER_ADMIN_EMAIL = 'muneracristian63@gmail.com';

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let requesterEmail = (req.user?.email || '').toLowerCase().trim();

  try {
    if (!requesterEmail && req.user?.id_usuario) {
      const { data: reqUserData } = await supabase.from('usuario').select('email').eq('id_usuario', req.user.id_usuario).single();
      if (reqUserData?.email) {
        requesterEmail = reqUserData.email.toLowerCase().trim();
      }
    }

    const { data: targetUser } = await supabase.from('usuario').select('*').eq('id_usuario', id).single();

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const targetEmail = (targetUser.email || '').toLowerCase().trim();
    const isTargetSuperAdmin = targetEmail === SUPER_ADMIN_EMAIL || targetUser.rol === 'super_admin';

    // No se permite eliminar la cuenta principal de super administrador
    if (isTargetSuperAdmin) {
      return res.status(403).json({ message: 'Acceso denegado. La cuenta principal de super administrador está protegida y no se puede eliminar.' });
    }

    // Permisos de eliminación:
    // - Super Admin: Puede eliminar tanto cuentas de administrador como de clientes.
    // - Admin normal: Solo puede eliminar cuentas de clientes, NO otros administradores.
    const isTargetAdmin = targetUser.rol === 'admin';
    const isRequesterSuperAdmin = requesterEmail === SUPER_ADMIN_EMAIL;

    if (isTargetAdmin && !isRequesterSuperAdmin) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Solo la cuenta principal de Super Administrador puede eliminar usuarios administradores.' 
      });
    }

    // Limpiar o desvincular registros dependientes en otras tablas para evitar errores de clave foránea (FK)
    try {
      await supabase.from('admin_face_rekognition').delete().eq('id_usuario', id);
      await supabase.from('admin_face_credentials').delete().eq('id_usuario', id);
      await supabase.from('admin_webauthn_challenges').delete().eq('id_usuario', id);
      await supabase.from('venta').update({ id_usuario: null }).eq('id_usuario', id);
    } catch (cleanupErr) {
      console.warn('Advertencia al limpiar datos asociados del usuario:', cleanupErr.message);
    }

    const { error } = await supabase.from('usuario').delete().eq('id_usuario', id);
    if (error) {
      console.error('Error en Supabase al eliminar usuario:', error);
      throw error;
    }
    return res.status(200).json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar usuario.' });
  }
});

app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;
  const requesterEmail = (req.user?.email || '').toLowerCase();

  if (!rol || !['admin', 'cliente'].includes(rol)) {
    return res.status(400).json({ message: 'Rol no válido.' });
  }

  try {
    const { data: targetUser } = await supabase.from('usuario').select('*').eq('id_usuario', id).single();

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // No se puede modificar el rol de la cuenta principal de super administrador
    if ((targetUser.email || '').toLowerCase() === SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Acceso denegado. No se puede modificar el rol de la cuenta principal de super administrador.' });
    }

    // Si el usuario objetivo es administrador y se intenta bajar a cliente:
    // Solo el super administrador (muneracristian63@gmail.com) puede realizar el cambio.
    if (targetUser.rol === 'admin' && rol === 'cliente' && requesterEmail !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Solo la cuenta de super administrador principal (muneracristian63@gmail.com) puede bajar de categoría a los administradores a cliente.' 
      });
    }

    const { error } = await supabase.from('usuario').update({ rol }).eq('id_usuario', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Rol de usuario actualizado correctamente.', id, rol });
  } catch (error) {
    console.error('Error al actualizar rol de usuario:', error);
    return res.status(500).json({ message: 'Error al actualizar el rol del usuario.' });
  }
});

// Endpoint para actualizar el estado de una venta (orden)
app.put('/api/admin/sales/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  const validStatuses = ['En proceso', 'En entrega', 'Enviado', 'Entregado', 'Completado', 'Cancelado'];
  if (!estado || !validStatuses.includes(estado)) {
    return res.status(400).json({ message: 'Estado de venta no válido.' });
  }

  try {
    // Actualizar en FALLBACK_SALES
    const fbSale = FALLBACK_SALES.find(s => String(s.id_venta) === String(id));
    if (fbSale) {
      fbSale.estado = estado;
      saveFallbackSales(FALLBACK_SALES);
    }

    const { data, error } = await supabase
      .from('venta')
      .update({ estado })
      .eq('id_venta', id)
      .select()
      .single();

    if (error) {
      console.warn('Advertencia al actualizar estado en Supabase:', error.message);
    }

    return res.status(200).json({
      message: 'Estado de venta actualizado correctamente.',
      id_venta: id,
      estado
    });
  } catch (error) {
    console.error('Error al actualizar el estado de la venta:', error);
    return res.status(500).json({ message: 'Error al actualizar el estado de la venta.' });
  }
});

// ─── CREACIÓN Y REGISTRO DE VENTAS EN TIEMPO REAL ─────────────────
app.post('/api/orders', async (req, res) => {
  const { userId, total, deliveryDetails, items } = req.body;

  const numTotal = Number(total);
  if (isNaN(numTotal) || numTotal <= 0) {
    return res.status(400).json({ message: 'El total del pedido debe ser un número mayor a 0.' });
  }

  try {
    const saleId = Date.now();
    const nowIso = new Date().toISOString();

    const newSaleItem = {
      id_venta: saleId,
      id_usuario: userId || null,
      total: numTotal,
      fecha: nowIso,
      estado: 'En proceso',
      email: deliveryDetails?.email || (req.user?.email || null),
      nombre: deliveryDetails?.fullName || 'Cliente Realtime',
      deliveryDetails: deliveryDetails || {},
      items: items || []
    };

    // 1. Guardar localmente para disponibilidad instantánea en tiempo real
    FALLBACK_SALES.unshift(newSaleItem);
    saveFallbackSales(FALLBACK_SALES);

    // 2. Intentar guardar en Supabase
    try {
      await supabase.from('venta').insert([{
        id_venta: saleId,
        id_usuario: userId || null,
        total: numTotal,
        fecha: nowIso,
        estado: 'En proceso'
      }]);
    } catch (supaErr) {
      console.warn('Advertencia Supabase al insertar venta:', supaErr.message);
    }

    // 3. Descontar stock en tiempo real
    if (Array.isArray(items)) {
      items.forEach(item => {
        const itemName = (item.name || item.nombre || '').toLowerCase().trim();
        const qty = item.quantity || item.cantidad || 1;
        const prod = FALLBACK_PRODUCTS.find(p => (p.nombre || '').toLowerCase().trim() === itemName || (p.name || '').toLowerCase().trim() === itemName);
        if (prod) {
          prod.stock = Math.max(0, (prod.stock !== undefined ? prod.stock : 50) - qty);
          prod.stock_disponible = prod.stock;
        }
      });
    }

    console.log(`🛒 ¡Venta registrada en TIEMPO REAL! ID: ${saleId}, Total: $${numTotal}`);
    return res.status(201).json({
      ok: true,
      message: 'Venta registrada con éxito en tiempo real.',
      sale: newSaleItem
    });
  } catch (error) {
    console.error('Error al registrar pedido:', error);
    return res.status(500).json({ message: 'Error interno al procesar el pedido.' });
  }
});

app.post('/api/sales', async (req, res) => {
  const { userId, total, deliveryDetails, items } = req.body;
  const numTotal = Number(total);

  try {
    const saleId = Date.now();
    const nowIso = new Date().toISOString();

    const newSaleItem = {
      id_venta: saleId,
      id_usuario: userId || null,
      total: numTotal,
      fecha: nowIso,
      estado: 'En proceso',
      email: deliveryDetails?.email || null,
      nombre: deliveryDetails?.fullName || 'Cliente Realtime',
      deliveryDetails: deliveryDetails || {},
      items: items || []
    };

    FALLBACK_SALES.unshift(newSaleItem);
    saveFallbackSales(FALLBACK_SALES);

    return res.status(201).json({ ok: true, sale: newSaleItem });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar venta.' });
  }
});

// Endpoint para crear un nuevo Administrador y enrolar su Face ID
app.post('/api/admin/create-admin', requireAdmin, async (req, res) => {
  let { name, lastName, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { data: newUser, error } = await supabase
      .from('usuario')
      .insert([{ nombre: name, apellido: lastName || '', email, password_hash: hashedPassword, rol: 'admin' }])
      .select()
      .single();

    if (error) {
      console.error('Error al insertar nuevo admin:', error);
      throw error;
    }

    const createdUser = newUser || { id_usuario: Date.now(), nombre: name, apellido: lastName, email, rol: 'admin' };

    return res.status(201).json({
      ok: true,
      message: 'Administrador registrado con éxito.',
      user: createdUser
    });
  } catch (error) {
    console.error('Error en /api/admin/create-admin:', error);
    return res.status(500).json({ message: error.message || 'Error interno al crear el administrador.' });
  }
});

// Nota: Para añadir un usuario se usa el flujo de /api/register (con o sin admin check).
// Nota: La tabla de productos puede no estar completamente configurada en Supabase según los datos, 
// pero dejamos el endpoint preparado.
// Endpoint para agregar un nuevo producto al catálogo
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  let { name, description, price, category, image, featured, stock, nombre, descripcion, precio, categoria, prompt_usado, prompt3d, prompt } = req.body;

  name = name || nombre;
  description = description || descripcion;
  price = price || precio;
  category = category || categoria;

  if (!name || !price) {
    return res.status(400).json({ message: 'El nombre y el precio del producto son obligatorios.' });
  }

  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return res.status(400).json({ message: 'El precio debe ser un número mayor a 0.' });
  }

  const numStock = stock !== undefined && stock !== null && !isNaN(parseInt(stock, 10)) ? Math.max(0, parseInt(stock, 10)) : 50;

  try {
    const nextId = Date.now();
    const finalImage = image || getProductImage(name);
    const isFeatured = Boolean(featured);
    const cat = category || 'Clásico';
    const desc = description || '';

    const newProdItem = {
      id_producto: nextId,
      nombre: name,
      precio: numPrice,
      descripcion: desc,
      imagen: finalImage,
      categoria: cat,
      destacado: isFeatured,
      stock: numStock,
      stock_disponible: numStock,
      estado: true,
      rating: 4.9,
      reviews: 1
    };

    // Insertar en Supabase o mockDb
    try {
      await supabase.from('producto').insert([newProdItem]);
    } catch (e) {
      console.warn('Advertencia al insertar producto en Supabase:', e);
    }

    // Agregar a FALLBACK_PRODUCTS para sincronización local en memoria
    FALLBACK_PRODUCTS.unshift(newProdItem);

    // Iniciar generación 3D con Tripo AI si se proporcionó un prompt
    let modelObj = null;
    const tripoPrompt = prompt_usado || prompt3d || prompt;
    if (tripoPrompt && tripoPrompt.trim()) {
      try {
        const taskId = await startTripoTask(tripoPrompt);
        TRIPO_MODELS_STATE[nextId] = {
          taskId,
          prompt: tripoPrompt,
          estado: 'generando',
          url: null,
          createdAt: new Date().toISOString()
        };
        saveTripoModelsState(TRIPO_MODELS_STATE);
        modelObj = { taskId, estado: 'generando' };
      } catch (tripoErr) {
        console.warn('Advertencia al iniciar tarea en Tripo3D AI:', tripoErr.message);
      }
    }

    const createdProductObj = {
      id: nextId,
      name: name,
      precio: numPrice,
      price: numPrice,
      desc: desc,
      image: finalImage,
      categoria: cat,
      destacado: isFeatured,
      stock: numStock
    };

    return res.status(201).json({
      ok: true,
      message: 'Producto creado y agregado al catálogo exitosamente.',
      product: createdProductObj,
      model: modelObj
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    return res.status(500).json({ message: 'Error interno al crear el producto.' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const prodId = parseInt(id, 10);
    const { error } = await supabase.from('producto').delete().eq('id_producto', prodId);
    if (error) throw error;
    // Fallback local
    const fbIdx = FALLBACK_PRODUCTS.findIndex(p => p.id_producto === prodId);
    if (fbIdx !== -1) FALLBACK_PRODUCTS.splice(fbIdx, 1);
    return res.status(200).json({ message: 'Producto eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar producto.' });
  }
});

// Actualizar producto y stock (Admin)
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, precio, descripcion, categoria, stock, estado } = req.body;

  try {
    const updateData = {};
    if (name !== undefined) updateData.nombre = name;
    if (precio !== undefined) updateData.precio = Number(precio);
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (stock !== undefined) updateData.stock = Math.max(0, parseInt(stock, 10) || 0);
    if (estado !== undefined) updateData.estado = Boolean(estado);

    const { data: updatedProduct, error } = await supabase
      .from('producto')
      .update(updateData)
      .eq('id_producto', id)
      .select()
      .single();

    if (error) throw error;

    // Sincronizar en tabla inventario si se actualizó el stock
    if (stock !== undefined) {
      await supabase
        .from('inventario')
        .update({ stock_disponible: updateData.stock, fecha_actualizacion: new Date().toISOString() })
        .eq('id_producto', id);
    }

    return res.status(200).json({
      message: 'Producto y stock actualizados correctamente.',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(500).json({ message: 'Error al actualizar el producto o stock.' });
  }
});

// Actualizar estado destacado del producto
app.put('/api/admin/products/:id/featured', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { destacado } = req.body;

  try {
    const prodId = parseInt(id, 10);
    const isFeatured = Boolean(destacado);

    // 1. Guardar en archivo persistente (fuente de verdad principal)
    FEATURED_STATE[prodId] = isFeatured;
    saveFeaturedState(FEATURED_STATE);

    // 2. Actualizar en memoria del fallback
    const fbItem = FALLBACK_PRODUCTS.find(p => p.id_producto === prodId);
    if (fbItem) fbItem.destacado = isFeatured;

    // 3. Intentar Supabase (opcional, no bloquea)
    try {
      await supabase.from('producto').update({ destacado: isFeatured }).eq('id_producto', prodId);
    } catch (e) {
      console.warn('Advertencia en actualización Supabase (no crítico):', e.message);
    }

    console.log(`✅ Producto ${prodId} destacado=${isFeatured} guardado en disco.`);
    return res.status(200).json({ ok: true, message: `Producto ${isFeatured ? 'destacado' : 'retirado de destacados'} con éxito.`, id: prodId, destacado: isFeatured });
  } catch (error) {
    console.error('Error al actualizar estado destacado:', error);
    return res.status(500).json({ message: 'Error al actualizar estado destacado.' });
  }
});

// Actualizar precio del producto
app.put('/api/admin/products/:id/price', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { precio } = req.body;
  const numPrice = parseInt(precio, 10);

  if (!numPrice || numPrice <= 0) {
    return res.status(400).json({ message: 'El precio debe ser un número positivo.' });
  }

  try {
    const prodId = parseInt(id, 10);

    // Actualizar en fallback en memoria
    const fbItem = FALLBACK_PRODUCTS.find(p => p.id_producto === prodId);
    if (fbItem) fbItem.precio = numPrice;

    // Intentar Supabase
    try {
      await supabase.from('producto').update({ precio: numPrice }).eq('id_producto', prodId);
    } catch (e) {
      console.warn('Advertencia Supabase al actualizar precio:', e.message);
    }

    console.log(`✅ Producto ${prodId} precio=${numPrice} actualizado.`);
    return res.status(200).json({ ok: true, message: 'Precio actualizado con éxito.', id: prodId, precio: numPrice });
  } catch (error) {
    console.error('Error al actualizar precio:', error);
    return res.status(500).json({ message: 'Error al actualizar el precio.' });
  }
});

// Actualizar categoría del producto
app.put('/api/admin/products/:id/category', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { categoria } = req.body;
  const VALID_CATS = ['Clásico', 'Vegano', 'Temporada', 'Gourmet'];

  if (!categoria || !VALID_CATS.includes(categoria)) {
    return res.status(400).json({ message: 'Categoría inválida. Opciones: ' + VALID_CATS.join(', ') });
  }

  try {
    const prodId = parseInt(id, 10);

    // Actualizar en fallback en memoria
    const fbItem = FALLBACK_PRODUCTS.find(p => p.id_producto === prodId);
    if (fbItem) fbItem.categoria = categoria;

    // Intentar Supabase
    try {
      await supabase.from('producto').update({ categoria }).eq('id_producto', prodId);
    } catch (e) {
      console.warn('Advertencia Supabase al actualizar categoría:', e.message);
    }

    console.log(`✅ Producto ${prodId} categoría=${categoria} actualizada.`);
    return res.status(200).json({ ok: true, message: 'Categoría actualizada con éxito.', id: prodId, categoria });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    return res.status(500).json({ message: 'Error al actualizar la categoría.' });
  }
});

// Actualizar stock del producto
app.put('/api/admin/products/:id/stock', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  const numStock = parseInt(stock, 10);

  if (isNaN(numStock) || numStock < 0) {
    return res.status(400).json({ message: 'El stock debe ser un número entero mayor o igual a 0.' });
  }

  try {
    const prodId = parseInt(id, 10);

    // Actualizar en fallback en memoria
    const fbItem = FALLBACK_PRODUCTS.find(p => p.id_producto === prodId);
    if (fbItem) {
      fbItem.stock = numStock;
      fbItem.stock_disponible = numStock;
    }

    // Intentar Supabase
    try {
      await supabase.from('producto').update({ stock: numStock, stock_disponible: numStock }).eq('id_producto', prodId);
    } catch (e) {
      console.warn('Advertencia Supabase al actualizar stock:', e.message);
    }

    console.log(`✅ Producto ${prodId} stock=${numStock} actualizado.`);
    return res.status(200).json({ ok: true, message: 'Stock disponible actualizado con éxito.', id: prodId, stock: numStock });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    return res.status(500).json({ message: 'Error al actualizar el stock disponible.' });
  }
});

// ─── Productos (desde Supabase con Fallback) ───────────────────
app.get('/api/products', async (req, res) => {
  try {
    let data;
    let error;

    try {
      const result = await supabase
        .from('producto')
        .select('*')
        .eq('estado', true)
        .order('id_producto', { ascending: true });
      data = result.data;
      error = result.error;
    } catch (dbErr) {
      console.warn('⚠️ Error consultando Supabase, usando fallback local:', dbErr.message);
      data = FALLBACK_PRODUCTS;
    }

    if (error || !data || data.length === 0) {
      console.warn('⚠️ No se obtuvieron datos de Supabase, usando fallback local.');
      data = FALLBACK_PRODUCTS;
    }

    const mapped = data.map((p) => {
      const tags = p.tags ? (typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()) : p.tags) : [];
      const cat = p.categoria || 'Clásico';
      const fd = getFlavorData(p.nombre);

      // Estilos por defecto según categoría
      let badgeColor = 'bg-gold-premium/20 text-gold-premium border-gold-premium/30';
      let accent = 'from-amber-500/20 to-yellow-500/10';

      if (cat === 'Vegano') {
        badgeColor = 'bg-green-500/20 text-green-300 border-green-500/30';
        accent = 'from-green-500/20 to-emerald-500/10';
      } else if (cat === 'Temporada') {
        badgeColor = 'bg-pink-400/20 text-pink-300 border-pink-400/30';
        accent = 'from-pink-500/20 to-rose-500/10';
      }

      return {
        id:          p.id_producto,
        name:        p.nombre,
        precio:      p.precio,
        price:       p.precio,
        stock:       p.stock !== undefined && p.stock !== null ? p.stock : 50,
        priceLabel:  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.precio),
        desc:        p.descripcion || '',
        longDesc:    p.long_desc || p.descripcion || '',
        image:       p.imagen || getProductImage(p.nombre),
        categoria:   cat,
        // FEATURED_STATE tiene prioridad absoluta sobre Supabase y fallback
        destacado:   FEATURED_STATE.hasOwnProperty(p.id_producto)
                       ? FEATURED_STATE[p.id_producto]
                       : Boolean(p.destacado !== undefined ? p.destacado : false),
        badge:       cat,
        badgeColor:  badgeColor,
        accent:      accent,
        glow:        'group-hover:shadow-amber-500/20',
        accentColor: cat === 'Vegano' ? '#10b981' : (cat === 'Temporada' ? '#fb7185' : '#D4AF37'),
        glowModal:   fd ? fd.glowModal || 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.15)',
        tags:        tags,
        rating:      p.rating || 4.8,
        reviews:     p.reviews || 150,
        ingredients: fd ? fd.ingredients : (p.ingredientes ? p.ingredientes.split(',').map(i => i.trim()) : []),
        allergens:   fd ? fd.allergens   : (p.alergenos   ? p.alergenos.split(',').map(a => a.trim())   : []),
        flavorProfile: fd ? fd.flavorProfile : [
          { label: 'Dulzura', value: 75 },
          { label: 'Cremosidad', value: 80 },
          { label: 'Intensidad', value: 85 },
        ],
        nutrition:   fd ? fd.nutrition : { calorias: 0, grasas: 0, carbos: 0, proteinas: 0 },
        prepTime:    p.prep_time || '48h',
        origin:      fd ? fd.origin : (p.origen || 'Colombia'),
      };
    });

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error al obtener productos.' });
  }
});

// ─── Chatbot (MCP RBAC) ──────────────────────────────────────
app.post('/api/chatbot', async (req, res) => {
  await handleChatbotRequest(req, res, supabase);
});

// ─── TRI PO 3D AI GENERATOR ENDPOINTS ─────────────────────────

// Consultar el estado o la URL del modelo 3D de un producto
app.get('/api/admin/products/:id/model-3d', async (req, res) => {
  const { id } = req.params;
  const prodId = parseInt(id, 10);

  try {
    const modelState = TRIPO_MODELS_STATE[prodId];

    if (!modelState) {
      return res.status(200).json({ estado: 'idle', url: null, glb_url: null });
    }

    // Si ya está listo y tenemos la URL guardada
    if (modelState.estado === 'listo' && modelState.url) {
      return res.status(200).json({
        estado: 'listo',
        url: modelState.url,
        glb_url: modelState.url,
        prompt: modelState.prompt
      });
    }

    // Si hay una tarea activa en Tripo AI, consultar estado en tiempo real
    if (modelState.taskId && (modelState.estado === 'generando' || modelState.estado === 'enviando')) {
      const taskInfo = await getTripoTaskStatus(modelState.taskId);

      if (taskInfo.status === 'success' && taskInfo.modelUrl) {
        TRIPO_MODELS_STATE[prodId].estado = 'listo';
        TRIPO_MODELS_STATE[prodId].url = taskInfo.modelUrl;
        TRIPO_MODELS_STATE[prodId].glb_url = taskInfo.modelUrl;
        saveTripoModelsState(TRIPO_MODELS_STATE);

        try {
          await supabase.from('producto').update({ model_3d_url: taskInfo.modelUrl }).eq('id_producto', prodId);
        } catch (e) {}

        return res.status(200).json({
          estado: 'listo',
          url: taskInfo.modelUrl,
          glb_url: taskInfo.modelUrl,
          prompt: modelState.prompt
        });
      } else if (taskInfo.status === 'failed') {
        TRIPO_MODELS_STATE[prodId].estado = 'error';
        saveTripoModelsState(TRIPO_MODELS_STATE);
        return res.status(200).json({ estado: 'error', message: 'La generación 3D en Tripo AI falló.' });
      } else {
        return res.status(200).json({
          estado: 'generando',
          progress: taskInfo.progress,
          message: `Generando estructura 3D en Tripo AI (${taskInfo.progress}%)...`
        });
      }
    }

    return res.status(200).json({
      estado: modelState.estado || 'idle',
      url: modelState.url || null,
      glb_url: modelState.url || null
    });
  } catch (error) {
    console.error('Error al consultar modelo 3D:', error);
    return res.status(500).json({ message: 'Error interno al consultar modelo 3D.' });
  }
});

// Regenerar o crear modelo 3D para un producto existente
app.post('/api/admin/products/:id/regenerate-3d', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { prompt } = req.body;
  const prodId = parseInt(id, 10);

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ message: 'El prompt descriptivo es obligatorio para generar el modelo 3D.' });
  }

  try {
    const taskId = await startTripoTask(prompt);

    TRIPO_MODELS_STATE[prodId] = {
      taskId,
      prompt,
      estado: 'generando',
      url: null,
      updatedAt: new Date().toISOString()
    };
    saveTripoModelsState(TRIPO_MODELS_STATE);

    return res.status(200).json({
      ok: true,
      message: 'Tarea de modelado 3D iniciada en Tripo AI con éxito.',
      taskId,
      productId: prodId
    });
  } catch (error) {
    console.error('Error al iniciar regeneración 3D:', error);
    return res.status(500).json({ message: error.message || 'Error al conectar con la API de Tripo AI.' });
  }
});

app.listen(PORT, () => console.log(`🍦 Servidor en puerto ${PORT}`));
