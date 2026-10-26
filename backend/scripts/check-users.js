const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// Clave a comprobar contra los hashes: CLAVE_A_PROBAR=... node scripts/check-users.js (nunca en el código).
const claveAProbar = process.env.CLAVE_A_PROBAR || '';

async function testLogin() {
  console.log('--- Verificando usuarios en Supabase ---');
  const { data: users, error } = await supabase.from('usuario').select('id_usuario, email, rol, password_hash');
  
  if (error) {
    console.error('Error al consultar usuarios:', error.message);
    return;
  }

  console.log(`Usuarios encontrados: ${users.length}`);
  for (const u of users) {
    console.log(`  - [${u.id_usuario}] ${u.email} | rol: ${u.rol} | hash: (oculto)`);
    if (!claveAProbar) continue;
    const match = await bcrypt.compare(claveAProbar, u.password_hash || '');
    console.log(`    ↳ ¿coincide con CLAVE_A_PROBAR? ${match ? "SÍ" : "NO"}`);
  }
}

testLogin();
