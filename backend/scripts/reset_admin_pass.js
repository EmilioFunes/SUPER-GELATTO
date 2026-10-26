// Cambia la contraseña (y deja rol admin) de las cuentas de ADMIN_EMAILS. Uso:
//   ADMIN_EMAILS=a@x.com,b@y.com ADMIN_RESET_PASSWORD=... node scripts/reset_admin_pass.js
// Los correos y la contraseña van en variables de entorno, nunca en el código.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_KEY en .env');
  process.exit(1);
}

const correos = String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const password = process.env.ADMIN_RESET_PASSWORD || '';
if (!correos.length || password.length < 12) {
  console.error('❌ Define ADMIN_EMAILS y ADMIN_RESET_PASSWORD (12+ caracteres) en el entorno.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPasswords() {
  const hash = await bcrypt.hash(password, 10);

  for (const email of correos) {
    const { error } = await supabase
      .from('usuario')
      .update({ password_hash: hash, rol: 'admin' })
      .eq('email', email);
    console.log(`Actualizar ${email}:`, error ? error.message : 'OK');
  }

  console.log('✅ Contraseñas actualizadas.');
}

fixPasswords();
