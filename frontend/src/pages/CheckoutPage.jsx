import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useCart, formatPrice } from '../context/CartContext';
import { MapPin, CheckCircle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import FlavorImage from '../components/FlavorImage';
import PaymentGateway from '../components/PaymentGateway';

const CheckoutPage = ({ user }) => {
  const { cart, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
  });
  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    let error = '';
    if (name === 'fullName') {
      if (value.trim().length < 3) {
        error = 'Nombre demasiado corto.';
      } else if (/^\s/.test(value) || value !== value.trim()) {
        error = 'No puede tener espacios al inicio ni al final.';
      } else if (/\s{2,}/.test(value)) {
        error = 'Solo se permite un espacio sencillo entre palabras.';
      }
    }
    if (name === 'phone' && !/^\+?[0-9\s-]{7,15}$/.test(value)) error = 'Teléfono inválido.';
    if (name === 'address' && value.trim().length < 5) error = 'Dirección insuficiente.';
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const isFormValid = 
    formData.fullName.trim().length >= 3 && 
    !/^\s/.test(formData.fullName) &&
    formData.fullName === formData.fullName.trim() &&
    !/\s{2,}/.test(formData.fullName) &&
    /^\+?[0-9\s-]{7,15}$/.test(formData.phone) && 
    formData.address.trim().length >= 5 &&
    Object.values(errors).every(x => x === '');

  // SI NO ESTÁ REGISTRADO (no tiene ID de base de datos), LO MANDAMOS A REGISTRARSE
  if (!user?.id) {
    return <Navigate to="/register" state={{ from: '/checkout' }} />;
  }

  const handleOpenPayment = (e) => {
    e.preventDefault();
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = (transaction) => {
    setPaymentResult(transaction);
    clearCart();
    setIsPaymentOpen(false);
  };

  const handleClosePayment = () => {
    setIsPaymentOpen(false);
  };

  // ─── Screen de Confirmación Exitosa (después de pago APROBADO) ───
  if (paymentResult) {
    return (
      <div className="pt-[80px] pb-24 px-6 min-h-screen flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center max-w-lg border border-white/15 shadow-2xl"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="text-green-400" size={40} />
          </div>
          <h2 className="text-4xl font-playfair font-bold mb-4">¡Pedido Confirmado!</h2>
          <p className="text-white/50 mb-6 leading-relaxed">
            Tu pago fue aprobado y tu gelato está en camino. Prepárate para una experiencia artesanal única.
          </p>
          <div className="glass-card p-4.5 text-left space-y-2.5 text-sm mb-8 border border-white/10">
            <div className="flex justify-between">
              <span className="text-white/40">Referencia</span>
              <span className="font-bold font-mono text-xs text-white">{paymentResult.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Método</span>
              <span className="font-bold text-white">{paymentResult.method} — {paymentResult.bank}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Autorización</span>
              <span className="font-bold font-mono text-xs text-green-400">{paymentResult.authCode}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
              <span className="text-white/40">Total pagado</span>
              <span className="font-bold text-gold-premium">{formatPrice(paymentResult.amount)}</span>
            </div>
          </div>
          <Link to="/" className="w-full py-4 rounded-full font-bold text-sm bg-gold-premium text-background-dark hover:scale-[1.02] transition-all inline-block shadow-lg shadow-gold-premium/20">
            Volver al Inicio
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <Link to="/productos" className="text-white/40 hover:text-gold-premium flex items-center gap-2 mb-4 text-sm font-bold transition-colors">
            <ArrowLeft size={16} /> Volver a Productos
          </Link>
          <h1 className="text-5xl font-playfair font-bold">Finalizar <span className="text-gold-premium italic">Pedido</span></h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          
          {/* Formulario de envío */}
          <div className="lg:col-span-2">
            <form onSubmit={handleOpenPayment} className="space-y-8">
              {/* Sección de Entrega */}
              <section className="glass-card p-8 border border-white/10">
                <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                  <MapPin className="text-gold-premium" /> Información de Entrega
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-white/40 uppercase">Nombre Completo</label>
                    <input 
                      type="text" 
                      name="fullName"
                      required 
                      placeholder="Ej. Juan Pérez" 
                      className={`input-field ${errors.fullName ? 'border-red-500/50' : ''}`} 
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                    {errors.fullName && <span className="text-xs text-red-400 font-semibold">{errors.fullName}</span>}
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-white/40 uppercase">Teléfono</label>
                    <input 
                      type="tel" 
                      name="phone"
                      required 
                      placeholder="+57 300 123 4567" 
                      className={`input-field ${errors.phone ? 'border-red-500/50' : ''}`} 
                      value={formData.phone}
                      onChange={handleChange}
                    />
                    {errors.phone && <span className="text-xs text-red-400 font-semibold">{errors.phone}</span>}
                  </div>
                  <div className="md:col-span-2 space-y-2 text-left">
                    <label className="text-xs font-bold text-white/40 uppercase">Dirección de Entrega</label>
                    <input 
                      type="text" 
                      name="address"
                      required 
                      placeholder="Calle, Carrera, Apto, Barrio..." 
                      className={`input-field ${errors.address ? 'border-red-500/50' : ''}`} 
                      value={formData.address}
                      onChange={handleChange}
                    />
                    {errors.address && <span className="text-xs text-red-400 font-semibold">{errors.address}</span>}
                  </div>
                </div>
              </section>

              {/* Vista previa de Métodos de Pago */}
              <section className="glass-card p-8 border border-white/10">
                <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                  <ShieldCheck className="text-gold-premium" /> Pasarela de Pago Colombiana
                </h3>
                <p className="text-sm text-white/50 mb-4">Al continuar, podrás elegir entre PSE, Nequi o Botón Bancolombia en nuestra pasarela segura (simulación estilo Wompi).</p>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { name: 'PSE', color: '#005DA4' },
                    { name: 'Nequi', color: '#E6007E' },
                    { name: 'Bancolombia', color: '#FDDA24' },
                  ].map(m => (
                    <span key={m.name} className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-white/10 bg-white/5" style={{ color: m.color }}>
                      {m.name}
                    </span>
                  ))}
                </div>
              </section>

              <button 
                type="submit"
                disabled={cart.length === 0 || !isFormValid}
                className={`w-full py-5 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${!isFormValid ? 'opacity-40 cursor-not-allowed bg-white/10 text-white/30' : 'bg-gold-premium text-background-dark hover:scale-[1.02] shadow-gold-premium/20'}`}
              >
                Continuar al Pago ({formatPrice(totalPrice)})
              </button>
            </form>
          </div>

          {/* Resumen Lateral */}
          <div className="lg:col-span-1">
            <div className="glass-card p-8 sticky top-32 border border-white/10">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                Resumen de <span className="text-gold-premium italic">Pedido</span>
              </h3>
              
              <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5">
                      <FlavorImage flavor={item} className="w-full h-full text-2xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{item.nombre || item.name}</h4>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-white/40">{item.quantity} x {formatPrice(item.precio || item.price)}</span>
                        <span className="text-sm font-bold text-gold-premium">{formatPrice((item.quantity * (item.precio || item.price)))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Subtotal</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Envío</span>
                  <span className="text-green-400 font-bold uppercase text-[10px]">Gratis</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-4 border-t border-white/5">
                  <span>Total</span>
                  <span className="text-gold-premium">{formatPrice(totalPrice)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Pasarela de Pago */}
      <PaymentGateway
        isOpen={isPaymentOpen}
        onClose={handleClosePayment}
        totalPrice={totalPrice}
        cart={cart}
        user={user}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default CheckoutPage;
