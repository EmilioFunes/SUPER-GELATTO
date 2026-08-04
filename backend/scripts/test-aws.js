const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { RekognitionClient, ListCollectionsCommand } = require('@aws-sdk/client-rekognition');

console.log('--- TEST AWS REKOGNITION ---');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '*****' + process.env.AWS_SECRET_ACCESS_KEY.slice(-4) : 'MISSING');
console.log('AWS_REGION:', process.env.AWS_REGION);

const client = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
  }
});

async function test() {
  try {
    const command = new ListCollectionsCommand({});
    const res = await client.send(command);
    console.log('✅ AWS REKOGNITION CONEXIÓN EXITOSA!');
    console.log('Colecciones encontradas:', res.CollectionIds);
  } catch (err) {
    console.error('❌ ERROR AWS:', err.name, '-', err.message);
    console.error(err);
  }
}

test();
