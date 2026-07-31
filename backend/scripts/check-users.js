const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function testLogin() {
  console.log('--- Verificando usuarios en Supabase ---');
  const { data: users, error } = await supabase.from('usuario').select('id_usuario, email, rol, password_hash');
  
  if (error) {
    console.error('Error al consultar usuarios:', error.message);
    return;
  }

  console.log(`Usuarios encontrados: ${users.length}`);
  for (const u of users) {
    console.log(`  - [${u.id_usuario}] ${u.email} | rol: ${u.rol} | hash: ${u.password_hash?.slice(0, 20)}...`);
    const match = await bcrypt.compare('gelato1234', u.password_hash || '');
    console.log(`    ↳ ¿coincide con "gelato1234"? ${match ? '✅ SÍ' : '❌ NO'}`);
  }
}

testLogin();
