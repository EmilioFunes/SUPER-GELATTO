# 🤖 Documentación Técnica: Gelbot (Super Gelatto)

Gelbot es el asistente virtual inteligente de la plataforma Super Gelatto. No es solo un chatbot de texto; es un agente capaz de interactuar con la base de datos, gestionar el carrito de compras y ayudar en la administración de la tienda mediante inteligencia artificial.

---

## 🚀 Tecnologías Utilizadas

1.  **Motor de IA (LLM)**: [Groq Cloud](https://groq.com/) utilizando el modelo **Llama 3.1 8B Instant**.
    *   **Razón**: Es uno de los modelos más rápidos del mercado con latencias inferiores a 500ms, lo cual es vital para una experiencia de usuario fluida. Además, tiene una gran capacidad para ejecutar "Function Calling" (herramientas).
2.  **Backend**: Node.js con Express.
3.  **Base de Datos**: Supabase (PostgreSQL) para la persistencia de usuarios y ventas.
4.  **Frontend**: React.js con Framer Motion (animaciones) y Tailwind CSS (estilos).

---

## 🏗️ Arquitectura del Sistema

### 1. El Cerebro (`backend/chatbot.js`)
Este archivo contiene toda la lógica de inteligencia. Funciona mediante un ciclo de dos pasos:
*   **Paso 1: Clasificación e Intención**: El mensaje del usuario se envía a Groq. El modelo decide si necesita ejecutar una "Herramienta" (como `getProducts` o `addToCart`) o si puede responder directamente.
*   **Paso 2: Ejecución de Herramientas**: Si el modelo pide una herramienta, el servidor Node.js ejecuta la lógica correspondiente (ej: consultar Supabase) y le devuelve el resultado al modelo para que genere la respuesta final.

### 2. El Corazón Visual (`frontend/src/components/Gelbot.jsx`)
Es el componente React que el usuario ve.
*   **Contexto del Carrito**: Está conectado al `CartContext`, lo que permite que el bot añada helados al carrito del usuario automáticamente cuando el usuario dice algo como "quiero un helado de fresa".
*   **RBAC (Role Based Access Control)**: El bot sabe si el usuario es un **Cliente** o un **Administrador** y adapta sus capacidades y respuestas en consecuencia.

---

## 🛠️ Herramientas y Capacidades (Function Calling)

Gelbot tiene acceso a las siguientes funciones que puede "invocar" según lo que el usuario pida:

| Función | Descripción | Quién puede usarla |
| :--- | :--- | :--- |
| `getProducts` | Muestra el catálogo de helados estáticos. | Todos |
| `addToCart` | Añade un helado específico al carrito de compras. | Todos |
| `getOrders` | Muestra el historial de pedidos del usuario. | Todos |
| `getAllUsers` | Muestra una lista de todos los clientes (Modo Admin). | Admin |
| `getAllOrders` | Muestra las últimas 10 ventas (Modo Admin). | Admin |
| `addProduct` | Agrega un nuevo sabor a la base de datos. | Admin |
| `deleteUser` | Elimina a un usuario por su Email o ID. | Admin |

---

## 🔗 Conexión con el Proyecto

La conexión se realiza mediante una API REST interna:

1.  **Endpoint**: `POST http://localhost:5000/api/chatbot`
2.  **Flujo de Datos**:
    *   El usuario escribe en el componente de React.
    *   React envía el mensaje + ID de usuario + Historial de chat al Backend.
    *   El Backend procesa la lógica con Groq y Supabase.
    *   El Backend responde con un JSON que contiene:
        *   `response`: El texto que el bot dirá.
        *   `action`: Una acción especial para que el frontend la ejecute (ej: `showUsersTable`).
        *   `actionData`: Datos adicionales para renderizar tablas o productos.

---

## 🛡️ Seguridad y Personalidad

*   **System Prompt**: Hemos diseñado un "System Prompt" estricto que obliga al bot a ser profesional, amable y a no revelar nunca que es un programa o que usa herramientas JSON.
*   **Sanitización**: Todas las entradas del usuario son limpiadas antes de ser procesadas para evitar inyecciones de código.
*   **Filtrado de Respuestas**: Una función llamada `cleanText` elimina cualquier rastro de nombres de funciones técnicas de la respuesta final del modelo antes de mostrarla al usuario.

---

## 🍦 Cómo probarlo
1. Asegúrate de tener una `GROQ_API_KEY` válida en el archivo `.env`.
2. Inicia sesión en la plataforma.
3. Haz clic en el logo de Gelbot en la esquina inferior derecha.
4. Prueba pidiéndole: *"¿Qué sabores tienes?"* o si eres Admin: *"Muéstrame las últimas ventas"*.

---
*Documentación generada automáticamente para el proyecto Super Gelatto.*
