import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { useCart } from '../context/CartContext';

const parseInlineStyles = (text) => {
  if (typeof text !== 'string') return text;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-gold-premium font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const renderMessageText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-1" />;
    
    // Check for bullet list
    const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
    if (isBullet) {
      const cleanLine = trimmed.replace(/^[•\-\*]\s*/, '');
      return (
        <div key={idx} className="flex gap-2 ml-2 my-1 items-start text-white/95">
          <span className="text-gold-premium mt-1.5 w-1.5 h-1.5 rounded-full bg-gold-premium flex-shrink-0" />
          <span>{parseInlineStyles(cleanLine)}</span>
        </div>
      );
    }
    
    // Check for section headers (e.g. ══ ROLES ══ or ### Header)
    const isHeader = trimmed.startsWith('###') || trimmed.startsWith('==') || trimmed.startsWith('══');
    if (isHeader) {
      const cleanHeader = trimmed.replace(/[#=═]/g, '').trim();
      return (
        <h5 key={idx} className="text-xs font-bold text-gold-premium uppercase tracking-wider mt-3 mb-1">
          {cleanHeader}
        </h5>
      );
    }
    
    return (
      <p key={idx} className="my-0.5 leading-relaxed text-white/90">
        {parseInlineStyles(line)}
      </p>
    );
  });
};

const Gelbot = ({ user }) => {
  const { addToCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  const welcomeMsg = (u) => ({
    id: 1,
    text: u?.rol === 'admin'
      ? `¡Hola Admin ${u?.name || u?.nombre || ''}! Soy Gelbot 🍦 ¿En qué puedo ayudarte hoy a gestionar la tienda?`
      : `¡Hola ${u?.name || u?.nombre || 'Gelattista'}! Soy Gelbot 🍦 ¿En qué puedo ayudarte hoy?`,
    sender: 'bot'
  });

  const [messages, setMessages] = useState([welcomeMsg(user)]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Enviamos el historial para mantener contexto
      const chatHistory = messages.map(m => ({
        role:    m.sender === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          userId:  user?.id,
          userName: user?.name,
          userRole: user?.rol,
          history: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Acción: añadir producto al carrito
      if (data.action === 'addToCart' && data.product) {
        addToCart(data.product, 1);
        // Añadimos un mensaje de confirmación si el bot no dio texto
        if (!data.response) {
          data.response = `¡${data.product.nombre} añadido al carrito! 🍦`;
        }
      }

      // Guardar mensaje del bot con metadatos de acción
      const botMsg = {
        id:         Date.now() + 1,
        text:       data.response || (data.action ? '' : '...'),
        sender:     'bot',
        action:     data.action,
        actionData: data.actionData
      };
      setMessages(prev => [...prev, botMsg]);

      // Acción: cerrar chat automáticamente (despedida)
      if (data.action === 'closeChat') {
        setTimeout(() => {
          setIsOpen(false);
          setTimeout(() => {
            setMessages([welcomeMsg(user)]);
          }, 500);
        }, 3500);
      }

    } catch (error) {
      console.error("Error en el chat:", error);
      setMessages(prev => [...prev, {
        id:     Date.now() + 1,
        text:   'Ups, algo salió mal. Inténtalo de nuevo en un momento.',
        sender: 'bot'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-20 right-0 w-80 sm:w-[400px] glass-card shadow-2xl overflow-hidden flex flex-col h-[500px]"
          >
            {/* Header */}
            <div className="p-4 bg-gold-premium/10 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-background-dark flex items-center justify-center overflow-hidden border-2 border-gold-premium shadow-lg">
                  <img src="/images/gelbot-logo.png" alt="Gelbot" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Gelbot</h4>
                  <p className="text-[10px] text-green-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> En línea
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-white/30 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  
                  {/* Burbuja de texto */}
                  <div className={`max-w-[90%] p-3 rounded-2xl text-sm ${
                    msg.sender === 'user'
                      ? 'bg-gold-premium text-background-dark font-medium rounded-tr-none'
                      : 'bg-white/5 border border-white/10 text-white rounded-tl-none'
                  }`}>
                    {msg.sender === 'user' ? msg.text : renderMessageText(msg.text)}
                  </div>

                  {/* ── Tabla de Usuarios (Admin) ── */}
                  {msg.action === 'showUsersTable' && msg.actionData && (
                    <div className="w-[95%] bg-black/60 border border-white/20 rounded-xl overflow-hidden mt-1 text-xs shadow-lg shadow-black/50">
                      <div className="p-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
                        <span className="font-bold text-gold-premium uppercase tracking-wider text-[10px]">👥 Usuarios</span>
                        <span className="text-white/50 text-[10px]">{msg.actionData.length} registros</span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-white/5 text-white/70 sticky top-0">
                            <tr>
                              <th className="p-2 font-medium">Nombre</th>
                              <th className="p-2 font-medium">Rol</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.actionData.map((u, idx) => (
                              <tr key={idx} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                <td className="p-2 text-white/90">
                                  {u.nombre}
                                  <div className="text-[9px] text-white/40 font-mono truncate max-w-[130px]">{u.email}</div>
                                </td>
                                <td className="p-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                                    u.rol === 'admin'
                                      ? 'bg-gold-premium/20 text-gold-premium'
                                      : 'bg-white/10 text-white/60'
                                  }`}>
                                    {u.rol}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Tabla de Ventas (Admin) ── */}
                  {msg.action === 'showSalesTable' && msg.actionData && (
                    <div className="w-[95%] bg-black/60 border border-white/20 rounded-xl overflow-hidden mt-1 text-xs shadow-lg shadow-black/50">
                      <div className="p-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
                        <span className="font-bold text-gold-premium uppercase tracking-wider text-[10px]">💰 Últimas Ventas</span>
                        <span className="text-white/50 text-[10px]">{msg.actionData.length} registros</span>
                      </div>
                      <div className="max-h-[220px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-white/5 text-white/70 sticky top-0">
                            <tr>
                              <th className="p-2 font-medium">Cliente</th>
                              <th className="p-2 font-medium">Total</th>
                              <th className="p-2 font-medium">Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.actionData.map((s, idx) => (
                              <tr key={idx} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                <td className="p-2 text-white/90">
                                  {s.usuario?.nombre || 'Cliente'}
                                  <div className="text-[9px] text-white/40 font-mono truncate max-w-[110px]">
                                    {s.usuario?.email || (s.id_usuario?.slice(0, 8) + '...')}
                                  </div>
                                </td>
                                <td className="p-2 font-bold text-green-400">
                                  {new Intl.NumberFormat('es-CO', {
                                    style: 'currency', currency: 'COP', minimumFractionDigits: 0
                                  }).format(s.total)}
                                </td>
                                <td className="p-2 text-white/50">
                                  {new Date(s.fecha).toLocaleDateString('es-CO', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Tabla Dinámica (Admin) ── */}
                  {msg.action === 'showTable' && Array.isArray(msg.actionData) && msg.actionData.length > 0 && (
                    <div className="w-[95%] bg-black/60 border border-white/20 rounded-xl overflow-hidden mt-1 text-[11px] shadow-lg shadow-black/50">
                      <div className="p-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
                        <span className="font-bold text-gold-premium uppercase tracking-wider text-[10px]">📊 Consulta Base de Datos</span>
                        <span className="text-white/50 text-[10px]">{msg.actionData.length} filas</span>
                      </div>
                      <div className="max-h-[220px] overflow-x-auto overflow-y-auto">
                        <table className="w-full text-left border-collapse min-w-[320px]">
                          <thead className="bg-white/10 text-white/80 sticky top-0">
                            <tr>
                              {Object.keys(msg.actionData[0]).map((header) => (
                                <th key={header} className="p-2 font-semibold capitalize border-b border-white/10 text-[9px] tracking-wider uppercase">
                                  {header.replace(/_/g, ' ')}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.actionData.map((row, idx) => (
                              <tr key={idx} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                {Object.values(row).map((val, cellIdx) => {
                                  let displayVal = val;
                                  if (typeof val === 'boolean') {
                                    displayVal = val ? 'Sí' : 'No';
                                  } else if (val === null || val === undefined) {
                                    displayVal = '-';
                                  } else if (typeof val === 'object') {
                                    displayVal = JSON.stringify(val);
                                  }
                                  
                                  const keyName = Object.keys(row)[cellIdx].toLowerCase();
                                  const isCountField = /ventas|pedidos|usuarios|clientes|productos|cantidad|count|numero|num|id/i.test(keyName);
                                  if (typeof val === 'number' && !isCountField && (keyName.includes('total') || keyName.includes('precio') || keyName.includes('salario') || keyName.includes('ingresos') || keyName.includes('puntos'))) {
                                    displayVal = new Intl.NumberFormat('es-CO', {
                                      style: 'currency', currency: 'COP', minimumFractionDigits: 0
                                    }).format(val);
                                  } else if (keyName.includes('fecha') && val && !isNaN(Date.parse(val))) {
                                    displayVal = new Date(val).toLocaleDateString('es-CO', {
                                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    });
                                  }

                                  return (
                                    <td key={cellIdx} className="p-2 text-white/95 truncate max-w-[150px]" title={String(displayVal)}>
                                      {displayVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              ))}

              {/* Indicador de carga */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-tl-none">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gold-premium rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-gold-premium rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-gold-premium rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/10 flex gap-2 bg-background-dark/50">
              <input
                type="text"
                placeholder="Pregunta algo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 text-sm focus:outline-none focus:border-gold-premium/50"
              />
              <button
                type="submit"
                className="p-2 bg-gold-premium rounded-full text-background-dark hover:scale-105 transition-transform"
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-20 h-20 rounded-full bg-background-dark shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center justify-center z-50 overflow-hidden group border-2 border-gold-premium relative p-0"
      >
        <div className="absolute inset-0 bg-gold-premium/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10" />
        <img
          src="/images/gelbot-logo.png"
          alt="Gelbot Toggle"
          className="w-full h-full object-cover relative z-0 scale-100 group-hover:scale-110 transition-transform duration-500"
        />
      </motion.button>
    </div>
  );
};

export default Gelbot;
