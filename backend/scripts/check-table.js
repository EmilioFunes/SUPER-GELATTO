const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkTable() {
  console.log('--- Verificando tabla admin_face_rekognition ---');
  const { data, error } = await supabase
    .from('admin_face_rekognition')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ La tabla NO existe o hay un error:', error.message);
    console.error('Código:', error.code);
    return;
  }

  console.log('✅ La tabla admin_face_rekognition EXISTE. Registros actuales:', data.length);
}

checkTable();
