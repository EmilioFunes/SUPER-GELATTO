import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { User, Mail, Star, Package, CreditCard, ChevronRight, Edit2, Sparkles, Gift, Crown, Info, Loader2, Save, X, CheckCircle2, AlertCircle } from 'lucide-react';

const ProfilePage = ({ user, onUpdateUser }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // SI NO ESTÁ REGISTRADO (no tiene ID de base de datos), LO MANDAMOS A REGISTRARSE
  if (!user?.id) {
    return <Navigate to="/register" state={{ from: '/perfil' }} />;
  }
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [errors, setErrors] = useState({});

  const handleKeyDownNoSpaces = (e) => {
    if (e.key === ' ' || e.keyCode === 32) {
      e.preventDefault();
    }
  };

  const validateField = (name, value) => {
    let error = '';
    const forbiddenRegex = /[<>&"'\/]/;

    if (forbiddenRegex.test(value)) {
      error = 'No se permiten los caracteres: < > & " \' /';
    } else {
      if (name === 'name') {
        if (value.trim().length < 3) {
          error = 'Nombre demasiado corto.';
        } else if (/^\s/.test(value) || value !== value.trim()) {
          error = 'No puede tener espacios al inicio ni al final.';
        } else if (/\s{2,}/.test(value)) {
          error = 'Solo se permite un espacio sencillo entre palabras.';
        }
      }
      if (name === 'email') {
        if (/\s/.test(value)) {
          error = 'El correo no puede tener espacios.';
        } else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i.test(value)) {
          error = 'Email inválido (sin caracteres especiales y debe terminar en .com, .net o .edu).';
        }
      }
    }
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const isFormValid = editName && 
                      editName.trim().length >= 3 && 
                      !/\s{2,}/.test(editName) &&
                      /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i.test(editEmail) && 
                      !/\s/.test(editEmail) &&
                      !/[<>&"'\/]/.test(editEmail) &&
                      !/[<>&"'\/]/.test(editName) &&
                      !errors.name && 
                      !errors.email;

  const superPoints = user?.points || 120;
  const nextTierPoints = 500;
  const progress = (superPoints / nextTierPoints) * 100;

  useEffect(() => {
    if (!user?.id) return;

    const fetchOrders = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/orders/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // "Tiempo real" simple: Polling cada 10 segundos para no saturar
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    
    setUpdating(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: '¡Perfil actualizado con éxito!' });
        if (onUpdateUser) {
          onUpdateUser(data.user);
        }
        setTimeout(() => {
          setIsEditing(false);
          setStatus({ type: null, message: '' });
        }, 2000);
      } else {
        setStatus({ type: 'error', message: data.message || 'Error al actualizar.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Error de conexión con el servidor.' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="pt-[80px] pb-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Sidebar Info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card p-8 flex flex-col items-center">
              <div className="relative group mb-6">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pastel-pink to-gold-premium p-1 transition-transform group-hover:scale-105">
                  <div className="w-full h-full rounded-full bg-background-dark flex items-center justify-center text-5xl font-bold">
                    {editName?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
                {isEditing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2 size={24} className="text-white" />
                  </div>
                )}
              </div>

              {!isEditing ? (
                <div className="text-center w-full">
                  <h2 className="text-3xl font-playfair font-bold mb-1">{user?.name || 'Usuario'}</h2>
                  <p className="text-white/40 text-sm mb-6 flex items-center justify-center gap-2">
                    <Mail size={14} /> {user?.email}
                  </p>
                  
                  {user?.id ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-gold-premium hover:text-background-dark border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      <Edit2 size={14} /> Editar Perfil
                    </button>
                  ) : (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-[10px] uppercase font-bold text-yellow-500 tracking-wider">
                      Regístrate para editar tu perfil
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="w-full space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Nombre</label>
                    <div className="relative">
                      <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); validateField('name', e.target.value); }}
                        className={`w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-gold-premium/50 focus:outline-none transition-all ${errors.name ? 'input-field-error' : ''}`}
                        placeholder="Tu nombre"
                        required
                      />
                    </div>
                    {errors.name && <span className="field-error-msg">{errors.name}</span>}
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Email</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input 
                        type="text" 
                        inputMode="email"
                        value={editEmail}
                        onChange={(e) => { setEditEmail(e.target.value); validateField('email', e.target.value); }}
                        className={`w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-gold-premium/50 focus:outline-none transition-all ${errors.email ? 'input-field-error' : ''}`}
                        placeholder="tu@email.com"
                        onKeyDown={handleKeyDownNoSpaces}
                        required
                      />
                    </div>
                    {errors.email && <span className="field-error-msg">{errors.email}</span>}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => { setIsEditing(false); setEditName(user?.name); setEditEmail(user?.email); setStatus({type:null, message:''}); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      <X size={14} /> Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={updating || !isFormValid}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${!isFormValid ? 'button-disabled' : 'bg-gold-premium text-background-dark hover:scale-[1.02]'}`}
                    >
                      {updating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                      {updating ? 'Guardando' : 'Guardar'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {status.message && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-3 rounded-lg flex items-center gap-2 text-[11px] font-bold ${
                          status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {status.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              )}
            </div>

            <div className="glass-card p-6 space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Configuración</h3>
              <button className="w-full flex justify-between items-center text-sm p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3 text-white/70 group-hover:text-gold-premium"><Package size={18} /> Mis Pedidos</div>
                <ChevronRight size={16} className="text-white/20" />
              </button>
              <button className="w-full flex justify-between items-center text-sm p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3 text-white/70 group-hover:text-gold-premium"><CreditCard size={18} /> Métodos de Pago</div>
                <ChevronRight size={16} className="text-white/20" />
              </button>
              <button className="w-full flex justify-between items-center text-sm p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3 text-white/70 group-hover:text-gold-premium"><Star size={18} /> SuperPoints</div>
                <ChevronRight size={16} className="text-white/20" />
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* SuperPoints Progress - VIP Card Style */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden rounded-[32px] p-10 bg-gradient-to-br from-[#1a1c29] via-[#11121a] to-[#0a0b10] border border-white/5 shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gold-premium/5 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pastel-pink/5 blur-[100px] rounded-full pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-premium/10 rounded-full border border-gold-premium/20 mb-4">
                    <Crown size={14} className="text-gold-premium" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-gold-premium">Membresía Elite</span>
                  </div>
                  <h3 className="text-4xl font-playfair font-bold text-white flex items-center gap-3 mb-2">
                    SuperPoints <Sparkles className="text-pastel-pink animate-pulse" size={24} />
                  </h3>
                  <p className="text-white/40 text-sm">Nivel actual: <span className="text-white font-bold italic bg-white/5 px-3 py-1 rounded-lg ml-2 border border-white/5">Lover</span></p>
                </div>
                
                <div className="bg-black/40 p-6 rounded-[24px] backdrop-blur-xl border border-white/10 shadow-xl">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Balance Total</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold bg-gradient-to-r from-gold-premium via-white to-gold-premium text-transparent bg-clip-text drop-shadow-sm">{superPoints}</span>
                    <span className="text-white/20 text-sm font-medium">/ 500 pts</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="relative mb-10 z-10">
                <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-white/30 mb-3 ml-1 mr-1">
                  <span>Lover</span>
                  <span className="text-gold-premium/60">Fan</span>
                </div>
                <div className="h-5 w-full bg-black/50 rounded-full overflow-hidden p-1 border border-white/5 backdrop-blur-sm">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-pastel-pink via-gold-premium to-yellow-200 relative"
                  >
                     <div className="absolute top-0 right-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                  </motion.div>
                </div>
                <div className="flex justify-between items-center mt-4 text-[13px]">
                  <p className="text-white/40">
                    Siguiente nivel en <strong className="text-gold-premium">{nextTierPoints - superPoints} puntos</strong>
                  </p>
                  <button className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-widest border-b border-transparent hover:border-white/20 pb-0.5">
                    Historial de puntos <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-4 mt-4 z-10 relative">
                <button className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 transition-all rounded-[18px] border border-white/5 text-sm font-bold group">
                  <Gift size={18} className="text-pastel-pink group-hover:scale-110 transition-transform" /> Canjear Premios
                </button>
                <button className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-gold-premium to-yellow-500 text-background-dark hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-all rounded-[18px] text-sm font-bold">
                  Ver Catálogo <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>

            {/* Order History */}
            <div className="glass-card p-10 overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-premium/10 flex items-center justify-center text-gold-premium">
                    <Package size={20} />
                  </div>
                  <h3 className="text-2xl font-bold font-playfair">Tus Pedidos</h3>
                </div>
                <div className="flex items-center gap-4">
                  {loading && <Loader2 className="animate-spin text-gold-premium/50" size={18} />}
                  <button onClick={() => window.location.reload()} className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white transition-colors">Refrescar</button>
                </div>
              </div>
              
              {orders.length === 0 && !loading ? (
                <div className="text-center py-20 bg-white/[0.02] rounded-[24px] border border-dashed border-white/10">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Package className="text-white/10" size={40} />
                  </div>
                  <p className="text-white/40 font-medium">Aún no has realizado pedidos.</p>
                  <Link 
                    to="/#sabores-destacados" 
                    className="mt-4 inline-block text-gold-premium text-xs font-bold uppercase tracking-widest hover:underline"
                  >
                    Ir a la tienda
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-center border-separate border-spacing-y-4">
                    <thead>
                      <tr className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-black">
                        <th className="px-4 pb-2 text-center">ID Pedido</th>
                        <th className="px-4 pb-2 text-center">Fecha</th>
                        <th className="px-4 pb-2 text-center">Total</th>
                        <th className="px-4 pb-2 text-center">Estado</th>
                        <th className="px-4 pb-2 text-center">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {orders.map((order) => (
                        <tr key={order.id_venta || order.id_pedido || order.id} className="group">
                          <td className="py-5 px-4 bg-white/[0.03] border-y border-l border-white/10 rounded-l-[18px] font-bold text-white group-hover:bg-white/[0.05] transition-colors">
                            #SG-{order.id_venta || order.id_pedido || order.id}
                          </td>
                          <td className="py-5 px-4 bg-white/[0.03] border-y border-white/10 text-white/50 group-hover:bg-white/[0.05] transition-colors">
                            {new Date(order.fecha).toLocaleDateString()}
                          </td>
                          <td className="py-5 px-4 bg-white/[0.03] border-y border-white/10 font-black text-gold-premium group-hover:bg-white/[0.05] transition-colors">
                            ${(order.total || 0).toLocaleString()}
                          </td>
                          <td className="py-5 px-4 bg-white/[0.03] border-y border-white/10 group-hover:bg-white/[0.05] transition-colors">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center justify-center w-fit gap-1.5 mx-auto ${
                              order.estado === 'Cancelado' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                              order.estado === 'En proceso' || order.estado === 'Pendiente' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                              order.estado === 'En entrega' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 
                              order.estado === 'Enviado' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                              'bg-green-500/10 text-green-500 border border-green-500/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                order.estado === 'Cancelado' ? 'bg-red-500' : 
                                order.estado === 'En proceso' || order.estado === 'Pendiente' ? 'bg-amber-400' : 
                                order.estado === 'En entrega' ? 'bg-cyan-400' : 
                                order.estado === 'Enviado' ? 'bg-blue-400' : 
                                'bg-green-500'
                              }`} />
                              {order.estado || 'En proceso'}
                            </span>
                          </td>
                          <td className="py-5 px-4 bg-white/[0.03] border-y border-r border-white/10 rounded-r-[18px] text-center group-hover:bg-white/[0.05] transition-colors">
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/20 hover:text-gold-premium mx-auto">
                              <ChevronRight size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
