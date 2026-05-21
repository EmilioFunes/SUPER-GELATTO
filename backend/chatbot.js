const Groq = require("groq-sdk");
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// WEB_FLAVORS se obtendrá ahora dinámicamente de Supabase para mayor consistencia.

// ── Herramientas del LLM ─────────────────────────────────────
const tools = [
  {
    type: "function",
    function: {
      name: "getProducts",
      description: "Obtiene el catálogo completo de helados disponibles en la tienda.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "addToCart",
      description: "Añade un helado al carrito del cliente. Debes usar el nombre exacto del sabor obtenido de getProducts.",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "El nombre del helado tal como aparece en el catálogo." }
        },
        required: ["productName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getOrders",
      description: "Obtiene el historial de pedidos del usuario actual.",
      parameters: {
        type: "object",
        properties: { userId: { type: "string", description: "ID del usuario." } },
        required: ["userId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getAllUsers",
      description: "SOLO ADMIN: Lista todos los usuarios registrados en la plataforma.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getAllOrders",
      description: "SOLO ADMIN: Lista las últimas 10 ventas/pedidos de la tienda.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteUser",
      description: "SOLO ADMIN: Elimina un usuario por su email o ID.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Email o ID del usuario a eliminar." }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteProduct",
      description: "SOLO ADMIN: Elimina un producto del catálogo por su ID numérico.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID del producto a eliminar." }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "addProduct",
      description: "SOLO ADMIN: Agrega un nuevo sabor de helado a la base de datos.",
      parameters: {
        type: "object",
        properties: {
          nombre:      { type: "string", description: "Nombre del nuevo sabor." },
          precio:      { type: "number", description: "Precio en pesos colombianos (ej: 12000)." },
          descripcion: { type: "string", description: "Descripción breve del sabor." }
        },
        required: ["nombre", "precio"]
      }
    }
  }
];

// ── Implementación de herramientas ───────────────────────────
const functions = {
  getProducts: async (supabase) => {
    console.log("🏎️ Tool: getProducts");
    const { data, error } = await supabase.from('producto').select('*').eq('estado', true);
    return error ? { error: "No pude obtener los productos." } : data;
  },

  getOrders: async (supabase, userId) => {
    console.log(`🏎️ Tool: getOrders for ${userId}`);
    const { data, error } = await supabase
      .from('venta')
      .select('*')
      .eq('id_usuario', userId)
      .order('fecha', { ascending: false })
      .limit(5);
    return error ? { error: "No pude obtener tus pedidos." } : (data.length ? data : { message: "Aún no tienes pedidos registrados." });
  },

  getAllUsers: async (supabase) => {
    console.log("🏎️ Tool: getAllUsers");
    const { data, error } = await supabase.from('usuario').select('id_usuario, nombre, email, rol');
    if (error) return { error: "Error obteniendo usuarios." };
    return { count: data.length, users: data };
  },

  getAllOrders: async (supabase) => {
    console.log("🏎️ Tool: getAllOrders");
    const { data: sales, error } = await supabase
      .from('venta')
      .select('id_venta, total, fecha, id_usuario, usuario(nombre, email)')
      .order('fecha', { ascending: false })
      .limit(10);
    if (error) {
      // Fallback sin join si hay problema de FK
      const { data: raw, error: err2 } = await supabase
        .from('venta')
        .select('id_venta, total, fecha, id_usuario')
        .order('fecha', { ascending: false })
        .limit(10);
      if (err2) return { error: "Error obteniendo ventas." };
      return { count: raw.length, sales: raw };
    }
    return { count: sales.length, sales };
  },

  deleteUser: async (supabase, identifier) => {
    console.log(`🏎️ Tool: deleteUser → ${identifier}`);
    const isEmail = identifier.includes('@');
    const { error } = await supabase.from('usuario').delete().eq(isEmail ? 'email' : 'id_usuario', identifier);
    return error
      ? { error: "Error al eliminar usuario.", detalle: error.message }
      : { success: true, message: `Usuario ${identifier} eliminado correctamente.` };
  },

  deleteProduct: async (supabase, id) => {
    console.log(`🏎️ Tool: deleteProduct → ${id}`);
    const { error } = await supabase.from('producto').delete().eq('id_producto', id);
    return error
      ? { error: "Error al eliminar producto.", detalle: error.message }
      : { success: true, message: `Producto ID ${id} eliminado correctamente.` };
  },

  addProduct: async (supabase, args) => {
    console.log(`🏎️ Tool: addProduct → ${args.nombre}`);
    const { error } = await supabase.from('producto').insert([{
      nombre:      args.nombre,
      precio:      args.precio,
      descripcion: args.descripcion || "Sabor especial de Super Gelatto",
      estado:      true
    }]);
    return error
      ? { error: "Error al agregar producto.", detalle: error.message }
      : { success: true, message: `¡El sabor "${args.nombre}" fue añadido al menú exitosamente!` };
  }
};

// ── Limpiador de respuestas ───────────────────────────────────
// ── Limpiador de respuestas ───────────────────────────────────
function cleanText(text) {
  return (text || "")
    .replace(/\[TIPO\s*\d+[^\]]*\]/gi, "")
    .replace(/getProducts|getAllOrders|getOrders|addToCart|addProduct|getAllUsers|deleteUser|deleteProduct|tool_calls|functions/gi, "")
    .replace(/<\/?function[^>]*>/gi, "")
    .replace(/<\/?tool_call[^>]*>/gi, "")
    .replace(/(function|tool_call)\s*=?\s*>?/gi, "")
    .replace(/\{[\s\S]*?\}/g, "")
    .replace(/con\s*$/i, "")
    .trim();
}

// ── Controlador principal ────────────────────────────────────
async function handleChatbotRequest(req, res, supabase) {
  const { message, userId, history = [] } = req.body;
  console.log(`🤖 Chatbot request: "${message}" from user ${userId}`);

  try {
    const { data: user } = await supabase
      .from('usuario')
      .select('*')
      .eq('id_usuario', userId)
      .single();

    const isAdmin = user?.rol === 'admin';
    const userName = user?.nombre || 'Gelattista';

    // Filtramos el mensaje de bienvenida para no confundir al LLM
    const filteredHistory = history.filter(m => !m.content?.includes("Soy Gelbot"));

    const systemPrompt = `Eres Gelbot, el Sommelier Digital de Super Gelatto. Estás siendo presentado en una exposición oficial ante el SENA.
Tu misión es demostrar la potencia de esta plataforma, atendiendo a Clientes y Administradores según su rango.

══ ROLES Y CAPACIDADES ══
1. 👤 PARA CLIENTES (Rol: cliente):
   • Tu objetivo es guiarlos en su compra artesanal.
   • Puedes listar los helados disponibles (getProducts).
   • Puedes consultar sus pedidos anteriores (getOrders).
   • Puedes añadir productos al carrito (addToCart).
   • Explica con pasión ingredientes como el Cacao de Tumaco o la Vainilla de Madagascar.

2. 🔑 PARA ADMINISTRADORES (Rol: admin):
   • Tienes acceso total al "Panel de Control de Voz".
   • Puedes ver todas las ventas del sistema (getAllOrders) para análisis financiero.
   • Puedes gestionar el personal y clientes (deleteUser).
   • Puedes controlar el inventario (addProduct, deleteProduct).
   • Al ser consultado por un ADMIN, tu tono es más ejecutivo y eficiente, listo para ejecutar comandos de gestión.

══ REGLAS DE ORO ══
• EXPOSICIÓN SENA: Si se menciona la "exposición" o "SENA", destaca que Super Gelatto usa un stack moderno (React, Node.js, Supabase) para una experiencia de usuario fluida y segura.
• CARRITO: Solo usa 'addToCart' si el cliente lo pide explícitamente.
• SEGURIDAD: Nunca menciones datos sensibles, pero sí destaca que el sistema es seguro y escalable.

Usuario Actual: ${userName} | Rol: ${user?.rol || 'cliente'}.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...filteredHistory,
      { role: "user", content: message }
    ];

    // ── Primera llamada al LLM ───────────────────────────────
    let response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools,
      tool_choice: "auto"
    });

    let responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    // ── Ejecutar herramientas si el LLM las solicitó ─────────
    if (toolCalls && toolCalls.length > 0) {
      messages.push(responseMessage);

      let actionToPerform = null;
      let productToBuy    = null;
      let actionData      = null;

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionResponse;

        try {
          if (functionName === "getProducts") {
            functionResponse = await functions.getProducts(supabase);

          } else if (functionName === "getOrders") {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            functionResponse = await functions.getOrders(supabase, args.userId || userId);

          } else if (functionName === "getAllUsers") {
            if (!isAdmin) {
              functionResponse = { error: "Acceso denegado." };
            } else {
              functionResponse = await functions.getAllUsers(supabase);
              actionToPerform = 'showUsersTable';
              actionData = functionResponse.users;
            }

          } else if (functionName === "getAllOrders") {
            if (!isAdmin) {
              functionResponse = { error: "Acceso denegado." };
            } else {
              functionResponse = await functions.getAllOrders(supabase);
              actionToPerform = 'showSalesTable';
              actionData = functionResponse.sales;
            }

          } else if (functionName === "deleteUser") {
            if (!isAdmin) {
              functionResponse = { error: "Acceso denegado." };
            } else {
              const args = JSON.parse(toolCall.function.arguments || '{}');
              functionResponse = await functions.deleteUser(supabase, args.identifier);
            }

          } else if (functionName === "deleteProduct") {
            if (!isAdmin) {
              functionResponse = { error: "Acceso denegado." };
            } else {
              const args = JSON.parse(toolCall.function.arguments || '{}');
              functionResponse = await functions.deleteProduct(supabase, args.id);
            }

          } else if (functionName === "addProduct") {
            if (!isAdmin) {
              functionResponse = { error: "Acceso denegado." };
            } else {
              const args = JSON.parse(toolCall.function.arguments || '{}');
              functionResponse = await functions.addProduct(supabase, args);
            }

          } else if (functionName === "addToCart") {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            if (!args?.productName || typeof args.productName !== 'string') {
              functionResponse = { error: "Necesito saber qué helado deseas agregar al carrito." };
            } else {
              // Obtenemos sabores actuales de la DB para validar
              const { data: dbProducts } = await supabase.from('producto').select('*').eq('estado', true);
              const query = args.productName.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); 
              
              if (query.length < 3) {
                functionResponse = { error: "El nombre del helado es muy corto o ambiguo." };
              } else {
                const found = dbProducts?.find(p => {
                  const name = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  return name.includes(query) || query.includes(name);
                });

                if (found) {
                  actionToPerform = 'addToCart';
                  productToBuy    = { 
                    id: found.id_producto, 
                    nombre: found.nombre, 
                    precio: found.precio,
                    image: found.imagen,
                    descripcion: found.descripcion
                  };
                  functionResponse = { success: true, message: `${found.nombre} listo para el carrito.` };
                } else {
                  functionResponse = { error: `No encontré "${args.productName}" en el catálogo.` };
                }
              }
            }

          } else {
            functionResponse = { error: "Herramienta no reconocida." };
          }

        } catch (e) {
          console.error("❌ Error en tool:", functionName, e);
          functionResponse = { error: "Error interno al ejecutar la función." };
        }

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(functionResponse ?? { error: "Sin respuesta" })
        });
      }

      // ── Segunda llamada: LLM procesa resultados de tools ────
      const second = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages
      });

      const finalText = cleanText(second.choices[0].message.content);

      return res.json({
        response:   finalText,
        action:     actionToPerform,
        product:    productToBuy,
        actionData: actionData
      });
    }

    // ── Respuesta directa (sin tools) ────────────────────────
    const cleanResponse = cleanText(responseMessage.content);

    // Detección de despedida para cerrar el chat automáticamente
    const isFarewell = /^(gracias|muchas gracias|adiós|adios|chao|hasta luego|nos vemos|bye)\b/i.test(message.trim());

    res.json({
      response: cleanResponse,
      action:   isFarewell ? 'closeChat' : null
    });

  } catch (error) {
    console.error("❌ Error chatbot:", error);
    if (error?.message?.includes('429')) {
      res.json({ response: "¡Ups! Hay mucha demanda en este momento 🍦. Inténtalo de nuevo en unos segundos." });
    } else {
      res.json({ response: "Estoy teniendo una falla técnica momentánea 🔧. Inténtalo de nuevo en un minuto." });
    }
  }
}

module.exports = { handleChatbotRequest };
