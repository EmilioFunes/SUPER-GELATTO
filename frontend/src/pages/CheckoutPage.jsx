import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart, formatPrice } from '../context/CartContext';
import { CreditCard, Wallet, MapPin, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import FlavorImage from '../components/FlavorImage';

const CheckoutPage = ({ user }) => {
  const { cart, totalPrice, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    paymentMethod: 'nequi'
  });
  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    let error = '';
    if (name === 'fullName' && value.trim().length < 3) error = 'Nombre demasiado corto.';
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
    /^\+?[0-9\s-]{7,15}$/.test(formData.phone) && 
    formData.address.trim().length >= 5 &&
    Object.values(errors).every(x => x === '');

  // SI NO ESTÁ REGISTRADO (no tiene ID de base de datos), LO MANDAMOS A REGISTRARSE
  if (!user?.id) {
    return <Navigate to="/register" state={{ from: '/checkout' }} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id, 
          total: totalPrice,
          deliveryDetails: formData,
          items: cart.map(item => ({ 
            name: item.nombre || item.name, 
            quantity: item.quantity, 
            price: item.precio 
          }))
        }),
      });
      if (response.ok) {
        clearCart();
        setIsSuccess(true);
      }
    } catch (error) {
      console.error('Error al crear pedido:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="pt-[80px] pb-24 px-6 min-h-screen flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center max-w-lg"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="text-green-400" size={40} />
          </div>
          <h2 className="text-4xl font-playfair font-bold mb-4">¡Pedido Confirmado!</h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Tu gelato está en camino. Prepárate para una explosión de sabor artesanal en aproximadamente 30 minutos.
          </p>
          <Link to="/" className="premium-button inline-flex items-center">
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
          <Link to="/productos" className="text-white/30 hover:text-gold-premium flex items-center gap-2 mb-4 text-sm font-bold">
            <ArrowLeft size={16} /> Volver a Productos
          </Link>
          <h1 className="text-5xl font-playfair font-bold">Finalizar <span className="text-gold-premium italic">Pedido</span></h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Delivery Section */}
              <section className="glass-card p-8">
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
                      className={`input-field ${errors.fullName ? 'input-field-error' : ''}`} 
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                    {errors.fullName && <span className="field-error-msg">{errors.fullName}</span>}
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-white/40 uppercase">Teléfono</label>
                    <input 
                      type="tel" 
                      name="phone"
                      required 
                      placeholder="+57 300 123 4567" 
                      className={`input-field ${errors.phone ? 'input-field-error' : ''}`} 
                      value={formData.phone}
                      onChange={handleChange}
                    />
                    {errors.phone && <span className="field-error-msg">{errors.phone}</span>}
                  </div>
                  <div className="md:col-span-2 space-y-2 text-left">
                    <label className="text-xs font-bold text-white/40 uppercase">Dirección de Entrega</label>
                    <input 
                      type="text" 
                      name="address"
                      required 
                      placeholder="Calle, Carrera, Apto, Barrio..." 
                      className={`input-field ${errors.address ? 'input-field-error' : ''}`} 
                      value={formData.address}
                      onChange={handleChange}
                    />
                    {errors.address && <span className="field-error-msg">{errors.address}</span>}
                  </div>
                </div>
              </section>

              {/* Payment Section */}
              <section className="glass-card p-8">
                <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                  <CreditCard className="text-gold-premium" /> Método de Pago
                </h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { id: 'nequi', name: 'Nequi', logo: '💳' },
                    { id: 'pse', name: 'PSE / Bancolombia', logo: '🏦' },
                    { id: 'card', name: 'Tarjeta Crédito', logo: '💳' },
                  ].map((method) => (
                    <label key={method.id} className="cursor-pointer group">
                      <input 
                        type="radio" 
                        name="paymentMethod" 
                        value={method.id}
                        className="hidden peer" 
                        checked={formData.paymentMethod === method.id}
                        onChange={handleChange}
                      />
                      <div className="p-6 border border-white/10 rounded-2xl bg-white/5 text-center transition-all peer-checked:border-gold-premium peer-checked:bg-gold-premium/10 group-hover:bg-white/10">
                        <div className="text-2xl mb-2">{method.logo}</div>
                        <div className="text-sm font-bold">{method.name}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              <button 
                type="submit"
                disabled={isProcessing || cart.length === 0 || !isFormValid}
                className={`w-full py-5 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg ${!isFormValid ? 'button-disabled' : 'bg-gold-premium text-background-dark hover:scale-[1.02] shadow-gold-premium/20'}`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" /> Procesando...
                  </>
                ) : (
                  <>Confirmar Pedido ({formatPrice(totalPrice)})</>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-1">
            <div className="glass-card p-8 sticky top-32">
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
    </div>
  );
};

export default CheckoutPage;
