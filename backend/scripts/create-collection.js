const { RekognitionClient, CreateCollectionCommand } = require('@aws-sdk/client-rekognition');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const region = process.env.AWS_REGION || 'us-east-2';
const collectionId = process.env.REKOGNITION_COLLECTION_ID || 'supergelatto-admins';

const client = new RekognitionClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

async function createCollection() {
  console.log(`🚀 Creando colección de AWS Rekognition: "${collectionId}" en región ${region}...`);
  try {
    const command = new CreateCollectionCommand({ CollectionId: collectionId });
    const response = await client.send(command);
    console.log(`✅ Colección creada con éxito. StatusCode: ${response.StatusCode}, CollectionARN: ${response.CollectionArn}`);
  } catch (error) {
    if (error.name === 'ResourceAlreadyExistsException') {
      console.log(`ℹ️ La colección "${collectionId}" ya existe en AWS Rekognition.`);
    } else {
      console.error(`❌ Error al crear la colección de AWS Rekognition:`, error.message || error);
    }
  }
}

createCollection();
