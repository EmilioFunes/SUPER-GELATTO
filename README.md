# 🍦 Super Gelatto

¡Bienvenido a **Super Gelatto**! Esta es una aplicación web moderna y completa para una heladería artesanal, que incluye una interfaz de usuario premium, un sistema de puntos de lealtad, autenticación, pasarela de pago simulada estilo Wompi y un constructor de helados interactivo en 3D.

Integrantes:
- Cristian Munera
- Jaider Funes
- Breidis Tabares
- Miguel Villa


## 🚀 Estructura del Proyecto

El proyecto está dividido en dos partes principales:

- **`/frontend`**: Aplicación de cliente desarrollada en React (Vite), con animaciones avanzadas y una experiencia de usuario fluida.
- **`/backend`**: Servidor Node.js con Express, integrado con Supabase para la base de datos y autenticación, y servicios de envío de correos mediante SMTP.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React.js, Vite, Framer Motion, React Three Fiber (para el 3D), Lucide Icons.
- **Backend**: Node.js, Express.
- **Base de Datos & Auth**: Supabase.
- **Estilos**: CSS nativo y diseño moderno (Glassmorphism).

---

## 📦 Instalación y Configuración

Sigue estos pasos para poner en marcha el proyecto localmente:

### 1. Clonar el repositorio
```bash
git clone https://github.com/EmilioFunes/SUPER-GELATTO.git
cd SUPER-GELATTO
```

### 2. Configurar el Backend
1. Navega a la carpeta del servidor:
   ```bash
   cd backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` basado en el `.env.example` y completa tus credenciales de Supabase y SMTP:
   ```bash
   cp .env.example .env
   ```
4. Inicia el servidor:
   ```bash
   npm start
   ```

### 3. Configurar el Frontend
1. Navega a la carpeta del cliente (desde la raíz):
   ```bash
   cd frontend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia la aplicación en modo desarrollo:
   ```bash
   npm run dev
   ```

---

## ✨ Características Principales

- 🎨 **Interfaz Premium**: Diseño moderno con efectos de vidrio y animaciones suaves.
- 🍦 **Constructor 3D**: Personaliza tu helado en tiempo real con una vista tridimensional interactiva.
- 💎 **SuperPoints**: Sistema de fidelización donde los usuarios acumulan puntos por cada compra.
- 🔐 **Autenticación Segura**: Integración con Google Auth y registros tradicionales mediante Supabase.
- 🛒 **Carrito de Compras**: Gestión dinámica de productos y pedidos.
- 💳 **Pasarela de Pago Simulada (Mock Wompi)**: Checkout colombiano realista con PSE, Nequi y Botón Bancolombia (para fines académicos). Ver [Documentación de la Pasarela](./docs/PAYMENT_GATEWAY.md).

---

## 📄 Licencia

Este proyecto es para fines educativos y demostrativos.

---

Desarrollado con ❤️ para **Super Gelatto**.
