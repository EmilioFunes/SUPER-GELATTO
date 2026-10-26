// Crea un usuario administrador. Uso (los datos van en variables de entorno, nunca en el código):
//   ADMIN_NUEVO_EMAIL=... ADMIN_NUEVO_PASSWORD=... node scripts/create_admin.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const email = (process.env.ADMIN_NUEVO_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_NUEVO_PASSWORD || '';
if (!email || password.length < 12) {
  console.error('❌ Define ADMIN_NUEVO_EMAIL y ADMIN_NUEVO_PASSWORD (12+ caracteres) en el entorno.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

async function createAdmin() {
  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabase.from('usuario').insert([{
    nombre: 'Admin',
    apellido: 'Principal',
    email,
    password_hash: hashedPassword,
    rol: 'admin'
  }]);

  console.log(error ? `Error: ${error.message}` : 'Administrador creado.');
}

createAdmin();
