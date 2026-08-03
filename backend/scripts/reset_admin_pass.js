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

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPasswords() {
  const hash = await bcrypt.hash('gelato1234', 10);
  console.log('Generated Hash for "gelato1234":', hash);

  const { error: err1 } = await supabase
    .from('usuario')
    .update({ password_hash: hash, rol: 'admin' })
    .eq('email', 'saldarriagac890@gmail.com');
  console.log('Update saldarriagac890:', err1 ? err1.message : 'OK');

  const { error: err2 } = await supabase
    .from('usuario')
    .update({ password_hash: hash, rol: 'admin' })
    .eq('email', 'supergelattoadmin@gmail.com');
  console.log('Update supergelattoadmin:', err2 ? err2.message : 'OK');

  const { error: err3 } = await supabase
    .from('usuario')
    .update({ password_hash: hash, rol: 'admin' })
    .eq('email', 'jefe@supergelatto.com');
  console.log('Update jefe@supergelatto.com:', err3 ? err3.message : 'OK');

  const { error: err4 } = await supabase
    .from('usuario')
    .update({ password_hash: hash, rol: 'admin' })
    .eq('email', 'cristianmunera979@gmail.com');
  console.log('Update cristianmunera979@gmail.com:', err4 ? err4.message : 'OK');

  const { error: err5 } = await supabase
    .from('usuario')
    .update({ password_hash: hash, rol: 'admin' })
    .eq('email', 'emiliofunes28@gmail.com');
  console.log('Update emiliofunes28@gmail.com:', err5 ? err5.message : 'OK');

  console.log('✅ Passwords reset successfully to: gelato1234');
}

fixPasswords();
