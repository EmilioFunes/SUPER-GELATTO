const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt'); // <--- Importado
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
const PORT = 5000;
const saltRounds = 10; // <--- Configuración de seguridad

// Middleware
app.use(cors());
app.use(bodyParser.json());

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

// ─── Register (CON BCRYPT) ──────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, lastName, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
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

  const { data: user, error } = await supabase.from('usuario').select('*').eq('email', email).single();

  if (error || !user) return res.status(401).json({ message: 'Email o contraseña incorrectos.' });

  // COMPARAR HASH
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) return res.status(401).json({ message: 'Email o contraseña incorrectos.' });

  return res.status(200).json({
    message: 'Inicio de sesión exitoso.',
    user: { id: user.id_usuario, name: user.nombre, email: user.email }
  });
});

// ─── Forgot Password ───────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
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

  if (password !== confirmPassword) return res.status(400).json({ message: 'No coinciden.' });

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

// ─── Products ──────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  const { data: products, error } = await supabase.from('producto').select('*').eq('estado', true);
  if (error) return res.status(500).json({ message: 'Error.' });
  return res.status(200).json(products);
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

  if (!userId || !total) return res.status(400).json({ message: 'Datos incompletos.' });

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
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Nombre y email son obligatorios.' });
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

app.listen(PORT, () => console.log(`🍦 Servidor en puerto ${PORT}`));
