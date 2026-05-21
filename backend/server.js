// Desactivar temporalmente la verificación estricta de SSL en Node para entornos locales con certificados auto-firmados / proxys
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs'); // Usamos bcryptjs para mejor compatibilidad en Windows
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { handleChatbotRequest } = require('./chatbot');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Advertencia: SUPABASE_URL o SUPABASE_KEY faltan en el archivo .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

const app = express();
const PORT = 5000;
const saltRounds = 10; // <--- Configuración de seguridad

// Middleware - CORS Configurado seguro para permitir solo el origen del frontend
const allowedOrigins = ['http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acceso denegado por la política CORS del servidor.'));
    }
  },
  credentials: true
}));
app.use(express.json());

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

// Middleware para validar que el usuario es administrador
function requireAdmin(req, res, next) {
  const role = req.headers['x-user-role'];
  if (role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
}

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
  if (n.includes('tiramisu')) return '/images/Tiramisú Artigianale.png';
  if (n.includes('caramelo')) return '/images/caramelo salado.png';
  if (n.includes('limon')) return '/images/limone di amalfi.png';
  if (n.includes('rosa')) return '/images/rosa y lichi.png';
  return '/images/gelato_berries.png'; // Default
}

// ─── Register (CON BCRYPT) ──────────────────────────────────
app.post('/api/register', async (req, res) => {
  let { name, lastName, email, password, confirmPassword } = req.body;

  if (hasForbiddenChars(name) || hasForbiddenChars(lastName) || hasForbiddenChars(email) || hasForbiddenChars(password) || hasForbiddenChars(confirmPassword)) {
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido terminado en .com, .net o .edu.' });
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

  if (hasForbiddenChars(email) || hasForbiddenChars(password)) {
    return res.status(400).json({ message: 'No se permiten caracteres especiales peligrosos (< > & " \' /).' });
  }

  if (/\s/.test(email) || /^\s/.test(email)) {
    return res.status(400).json({ message: 'El correo no puede contener espacios.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido terminado en .com, .net o .edu.' });
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

  return res.status(200).json({
    message: 'Inicio de sesión exitoso.',
    user: { id: user.id_usuario, name: user.nombre, email: user.email, rol: user.rol }
  });
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido terminado en .com, .net o .edu.' });
  }
  const genericMessage = 'Si este correo está registrado, recibirás un enlace.';

  const { data: dbUser } = await supabase.from('usuario').select('nombre, email').eq('email', email).single();
  if (!dbUser) return res.status(200).json({ message: genericMessage });

  cleanExpiredTokens();
  const token = generateResetToken();
  resetTokens.push({ token, email, expiresAt: Date.now() + 3600000, used: false });

  const resetLink = `http://localhost:3000/reset-password/${token}`;

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

  if (hasForbiddenChars(password) || hasForbiddenChars(confirmPassword)) {
    return res.status(400).json({ message: 'No se permiten caracteres especiales peligrosos (< > & " \' /).' });
  }

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

  const emailRegex = /^[^\s@]+@[^\s@]+\.(com|net|edu)$/i;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un email válido terminado en .com, .net o .edu.' });
  }

  if (name !== name.trim() || /^\s/.test(name)) {
    return res.status(400).json({ message: 'El nombre no puede tener espacios al inicio ni al final.' });
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

    // Obtener ventas
    const { data: sales, error: salesError } = await supabase
      .from('venta')
      .select('id_venta, id_usuario, total, fecha')
      .order('fecha', { ascending: false });

    if (salesError) throw salesError;

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
      sales
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return res.status(500).json({ message: 'Error al obtener datos del panel de control.' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('usuario').delete().eq('id_usuario', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar usuario.' });
  }
});

// Nota: Para añadir un usuario se usa el flujo de /api/register (con o sin admin check).
// Nota: La tabla de productos puede no estar completamente configurada en Supabase según los datos, 
// pero dejamos el endpoint preparado.
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('producto').delete().eq('id_producto', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Producto eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar producto.' });
  }
});

// ─── Productos (desde Supabase) ───────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('producto')
      .select('*')
      .eq('estado', true)
      .order('id_producto', { ascending: true });

    if (error) throw error;

    const mapped = data.map((p) => {
      const tags = p.tags ? p.tags.split(',').map(t => t.trim()) : [];
      const cat = p.categoria || 'Clásico';
      
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
        priceLabel:  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.precio),
        desc:        p.descripcion || '',
        longDesc:    p.long_desc || p.descripcion || '',
        image:       p.imagen || getProductImage(p.nombre),
        categoria:   cat,
        badge:       cat,
        badgeColor:  badgeColor,
        accent:      accent,
        glow:        'group-hover:shadow-amber-500/20',
        accentColor: cat === 'Vegano' ? '#10b981' : (cat === 'Temporada' ? '#fb7185' : '#D4AF37'),
        glowModal:   'rgba(212,175,55,0.15)',
        tags:        tags,
        rating:      p.rating || 4.8,
        reviews:     p.reviews || 150,
        ingredients: [],
        allergens:   [],
        flavorProfile: [
          { label: 'Dulzura', value: 75 },
          { label: 'Cremosidad', value: 80 },
          { label: 'Intensidad', value: 85 },
        ],
        nutrition:   { calorias: 0, grasas: 0, carbos: 0, proteinas: 0 },
        prepTime:    '48h',
        origin:      'Colombia',
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

app.listen(PORT, () => console.log(`🍦 Servidor en puerto ${PORT}`));
