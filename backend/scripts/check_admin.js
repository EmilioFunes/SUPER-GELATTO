// Muestra los datos de una cuenta. Uso: node scripts/check_admin.js correo@dominio.com
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('❌ Uso: node scripts/check_admin.js correo@dominio.com');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

async function checkAdmin() {
  const { data, error } = await supabase.from('usuario').select('id_usuario, nombre, email, rol, estado').eq('email', email);
  console.log('Result:', data);
  console.log('Error:', error);
}

checkAdmin();
