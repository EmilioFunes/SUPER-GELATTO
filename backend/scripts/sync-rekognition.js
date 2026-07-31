const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { RekognitionClient, ListFacesCommand } = require('@aws-sdk/client-rekognition');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID || 'supergelatto-admins';

async function main() {
  console.log('--- Caras indexadas en AWS Rekognition ---');
  const { Faces } = await rekognition.send(new ListFacesCommand({ CollectionId: COLLECTION_ID }));
  console.log(`Total en AWS: ${Faces.length}`);
  for (const f of Faces) {
    console.log(`  FaceId: ${f.FaceId} | ExternalImageId: ${f.ExternalImageId}`);
  }

  console.log('\n--- Registros en Supabase admin_face_rekognition ---');
  const { data: rows, error } = await supabase.from('admin_face_rekognition').select('*');
  if (error) { console.error('❌ Error:', error.message); return; }
  console.log(`Total en Supabase: ${rows.length}`);
  for (const r of rows) console.log(`  FaceId: ${r.aws_face_id} | id_usuario: ${r.id_usuario}`);

  // Caras en AWS pero no en Supabase (sin vincular)
  const supabaseIds = new Set(rows.map(r => r.aws_face_id));
  const unlinked = Faces.filter(f => !supabaseIds.has(f.FaceId));
  
  if (unlinked.length === 0) {
    console.log('\n✅ Todo sincronizado.');
    return;
  }

  console.log(`\n⚠️ Caras en AWS sin registro en Supabase: ${unlinked.length}`);
  for (const f of unlinked) {
    console.log(`  → FaceId: ${f.FaceId} | ExternalImageId: ${f.ExternalImageId}`);
  }

  // Intentar vincular usando ExternalImageId (contiene id_usuario)
  console.log('\n--- Intentando sincronizar con Supabase ---');
  for (const f of unlinked) {
    // ExternalImageId tiene formato "admin_<id_usuario>" o similar
    const rawId = f.ExternalImageId || '';
    const match = rawId.match(/(\d+)/);
    if (!match) {
      console.log(`  ⚠️ No se pudo extraer id_usuario de: ${rawId}`);
      continue;
    }
    const id_usuario = parseInt(match[1]);
    const { error: insertErr } = await supabase
      .from('admin_face_rekognition')
      .insert({ aws_face_id: f.FaceId, id_usuario });
    if (insertErr) {
      console.error(`  ❌ Error al insertar FaceId ${f.FaceId}:`, insertErr.message);
    } else {
      console.log(`  ✅ FaceId ${f.FaceId} vinculado a id_usuario=${id_usuario}`);
    }
  }
}

main().catch(console.error);
