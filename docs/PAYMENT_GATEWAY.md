# 🏦 Pasarela de Pago Simulada (Mock Wompi - PSE, Nequi y Botón Bancolombia)

> **⚠️ MOCK ACADÉMICO**: Esta pasarela **NO procesa pagos reales**. Es una simulación
> fiel del flujo de un checkout colombiano para un laboratorio escolar.

---

## 📌 Descripción

La pasarela simula el flujo de pago de **Wompi** (pasarela de pago colombiana), ofreciendo soporte completo para tres métodos principales:

| Método | Descripción |
|--------|-------------|
| **PSE** | Débito bancario en línea con selector de banco y tipo de persona (Natural/Jurídica) |
| **Nequi** | Pago móvil desde celular (campo validado a 10 dígitos) |
| **Botón Bancolombia** | Transferencia directa simulando la redirección a la App o Sucursal Virtual |

---

## ⚡ Flujo de la Simulación

1. **Selección e información**: El usuario llena sus datos de entrega en la pantalla `/checkout`.
2. **Apertura de la Pasarela**: Al hacer clic en *"Continuar al Pago"*, se despliega el modal interactivo `PaymentGateway.jsx`.
3. **Selección del método**:
   - **PSE**: Elige su entidad bancaria (Bancolombia, Davivienda, BBVA, Banco de Bogotá, etc.) y tipo de persona.
   - **Nequi**: Digita su celular de 10 dígitos.
   - **Botón Bancolombia**: Visualiza pantalla con instrucciones de transferencia.
4. **Procesamiento y Latencia**: Al hacer clic en *"Pagar $[monto] COP"*, el backend simula una latencia realista de 1.0 a 2.0 segundos con un spinner de carga y mensajes rotativos de estado (*"Conectando con la entidad...", "Verificando datos..."*).
5. **Cálculo seguro del monto**: El servidor valida y recalcula el monto basado en los precios actuales.
6. **Resultado Ponderado**:
   - ~90% de las transacciones son **APROBADAS** (`APPROVED`).
   - ~10% de las transacciones son **DECLINADAS** (`DECLINED`) para probar la gestión de errores.
   - **Prueba manual de rechazo**: Seleccionar el banco *"Banco de Pruebas - Rechazo"* en PSE o enviar `forceDecline: true`.
7. **Persistencia y Confirmación**:
   - Si es **APPROVED**: Se crea la orden en la tabla `venta` de Supabase (`estado: 'Pagado'`), se limpia el carrito de compras y se envía una notificación por correo electrónico vía SMTP.
   - Si es **DECLINED**: Muestra un mensaje con el motivo del rechazo y permite reintentar la transacción (*"Reintentar pago"*).

---

## 🔌 Especificación del Endpoint API

### `POST /api/payments/process`

#### Petición (Request Body)
```json
{
  "method": "PSE",
  "bank": "Bancolombia",
  "items": [
    { "id": 1, "name": "Fresa Salvaje", "quantity": 2, "price": 12500 }
  ],
  "amount": 25000,
  "reference": "ORD-SG-1722729600000-A1B2C3",
  "userId": 3,
  "forceDecline": false
}
```

#### Respuesta de Éxito (Approved Response)
```json
{
  "ok": true,
  "message": "¡Pago aprobado exitosamente!",
  "transaction": {
    "id": "TXN-SG-1722729600000-A1B2C3",
    "status": "APPROVED",
    "method": "PSE",
    "bank": "Bancolombia",
    "amount": 25000,
    "reference": "ORD-SG-1722729600000-A1B2C3",
    "timestamp": "2026-08-10T23:45:00.000Z",
    "authCode": "AUTH-8F3K2L"
  }
}
```

#### Respuesta de Rechazo (Declined Response)
```json
{
  "ok": false,
  "message": "Fondos insuficientes en la cuenta.",
  "transaction": {
    "id": "TXN-SG-1722729600000-X9Y8Z7",
    "status": "DECLINED",
    "method": "PSE",
    "bank": "Banco de Pruebas - Rechazo",
    "amount": 25000,
    "reference": "ORD-SG-1722729600000-X9Y8Z7",
    "timestamp": "2026-08-10T23:45:00.000Z",
    "authCode": null
  }
}
```

---

## 🚀 Guía de Migración a Wompi Real (Producción)

Para reemplazar este entorno de simulación (mock) por la integración oficial con la API o Widget de **[Wompi Colombia](https://wompi.com/)**, sigue estos pasos:

### 1. Obtener Credenciales
Regístrate en la consola de desarrolladores de Wompi y añade las llaves en tu `.env` de backend:
```env
WOMPI_PUBLIC_KEY=pub_test_XXXXX
WOMPI_PRIVATE_KEY=prv_test_XXXXX
WOMPI_EVENTS_SECRET=test_events_XXXXX
WOMPI_INTEGRITY_SECRET=test_integrity_XXXXX
```

### 2. Integración en Frontend
Sustituye la modal por el Widget o JS SDK oficial de Wompi pasando la `WOMPI_PUBLIC_KEY`:
```html
<script src="https://checkout.wompi.co/widget.js" data-render="button" data-public-key="pub_test_XXXXX" data-currency="COP" data-amount-in-cents="2500000" data-reference="ORD-SG-12345"></script>
```

### 3. Firma de Integridad SHA-256 (Backend)
Antes de crear la transacción, genera la firma concatenando los datos con la clave de integridad:
```javascript
const crypto = require('crypto');
const currency = 'COP';
const amountInCents = amount * 100;
const signatureString = `${reference}${amountInCents}${currency}${process.env.WOMPI_INTEGRITY_SECRET}`;
const integritySignature = crypto.createHash('sha256').update(signatureString).digest('hex');
```

### 4. Configuración de Webhook
Configura un endpoint `POST /api/payments/webhook` en Express para recibir la confirmación asíncrona de Wompi:
- Valida la firma del evento enviada en los headers usando `WOMPI_EVENTS_SECRET`.
- Al confirmar el evento `transaction.updated` con status `APPROVED`, marca la orden como pagada y despacha el pedido.
