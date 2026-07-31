const http = require('http');

console.log('🍦 Iniciando pruebas de integración del Panel Admin en modo simulación...\n');

// Configurar puerto y entorno de prueba
process.env.PORT = 5050;
process.env.NODE_ENV = 'test';

// Iniciar el servidor
const server = require('../server.js');

// Helper para hacer llamadas HTTP
function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5050,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  // Esperar a que el servidor Express inicie correctamente
  await new Promise(r => setTimeout(r, 1500));
  
  try {
    const testAdminId = "999";

    // Test: Crear producto con generación 3D en simulación
    console.log('\n1. Creando producto y disparando generador 3D (Simulación)...');
    const productRes = await makeRequest('POST', '/api/admin/products', {
      'x-user-role': 'admin',
      'x-user-id': testAdminId
    }, {
      nombre: 'Helado de Pistacho Italiano',
      descripcion: 'Gelato artesanal de pistachos importados',
      precio: 14500,
      categoria: 'Clásico',
      prompt_usado: 'gourmet pistachio gelato cup, extreme detail'
    });
    console.log(`   Estatus HTTP: ${productRes.statusCode}`);
    console.log(`   Producto Registrado:`, productRes.body.product);
    if (productRes.statusCode !== 201) throw new Error('Fallo al crear producto');

    console.log('\n🎉 ¡PRUEBAS COMPLETADAS CON EXITO!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Falla en la validación:', err.message);
    process.exit(1);
  }
}

runTests();
