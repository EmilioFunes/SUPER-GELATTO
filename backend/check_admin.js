require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkAdmin() {
  const { data, error } = await supabase.from('usuario').select('*').eq('email', 'saldarriagac890@gmail.com');
  console.log('Result:', data);
  console.log('Error:', error);
}

checkAdmin();
