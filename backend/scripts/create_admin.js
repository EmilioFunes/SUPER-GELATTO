require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('gelato1234', 10);
  
  const { data, error } = await supabase.from('usuario').insert([{
    nombre: 'Admin',
    apellido: 'Principal',
    email: 'saldarriagac890@gmail.com',
    password_hash: hashedPassword,
    rol: 'admin'
  }]);
  
  console.log('Result:', data);
  console.log('Error:', error);
}

createAdmin();
