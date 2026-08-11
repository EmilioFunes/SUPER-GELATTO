/**
 * PaymentGateway.jsx — Pasarela de Pago Simulada (Mock Wompi)
 * ⚠️ MOCK ACADÉMICO: NO procesa pagos reales.
 * Simula el flujo visual de un checkout colombiano (PSE, Nequi, Botón Bancolombia).
 * Ver docs/PAYMENT_GATEWAY.md para migración a Wompi real.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Smartphone, Shield, ChevronLeft, Loader2, 
  CheckCircle, XCircle, RefreshCw, X, Lock, ChevronDown
} from 'lucide-react';
import { formatPrice } from '../context/CartContext';

const PSE_BANKS = [
  'Bancolombia',
  'Davivienda',
  'BBVA Colombia',
  'Banco de Bogotá',
  'Banco Popular',
  'Banco de Occidente',
  'Scotiabank Colpatria',
  'AV Villas',
  'Banco Agrario',
  'Banco Falabella',
  'Itaú Colombia',
  'Nu Colombia (Cuenta Nu)',
  'RappiPay',
  'Lulo Bank',
  'Banco de Pruebas - Rechazo'  // Banco reservado para forzar rechazo en demos
];

const PERSON_TYPES = [
  { id: 'natural', label: 'Persona Natural' },
  { id: 'juridica', label: 'Persona Jurídica' }
];

const PAYMENT_METHODS = [
  { 
    id: 'PSE', 
    name: 'PSE', 
    subtitle: 'Débito bancario en línea',
    icon: Building2,
    accentColor: '#005DA4',
    bgGradient: 'from-blue-600/20 to-blue-800/10'
  },
  { 
    id: 'NEQUI', 
    name: 'Nequi', 
    subtitle: 'Pago móvil desde tu celular',
    icon: Smartphone,
    accentColor: '#E6007E',
    bgGradient: 'from-pink-500/20 to-fuchsia-700/10'
  },
  { 
    id: 'BANCOLOMBIA', 
    name: 'Botón Bancolombia', 
    subtitle: 'Transferencia directa desde App',
    icon: Shield,
    accentColor: '#FDDA24',
    bgGradient: 'from-yellow-400/20 to-amber-600/10'
  }
];

const PROCESSING_MESSAGES = [
  'Conectando con la entidad financiera...',
  'Verificando datos de la transacción...',
  'Procesando tu pago encriptado...',
  'Confirmando con el banco emisor...'
];

const PaymentGateway = ({ isOpen, onClose, totalPrice, cart, user, onPaymentSuccess }) => {
  const [step, setStep] = useState('method');    // method | details | processing | result
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [pseBank, setPseBank] = useState('');
  const [psePersonType, setPsePersonType] = useState('natural');
  const [nequiPhone, setNequiPhone] = useState('');
  const [nequiError, setNequiError] = useState('');
  const [processingMsg, setProcessingMsg] = useState(0);
  const [result, setResult] = useState(null);

  // Reiniciar estado al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setStep('method');
      setSelectedMethod(null);
      setPseBank('');
      setPsePersonType('natural');
      setNequiPhone('');
      setNequiError('');
      setProcessingMsg(0);
      setResult(null);
    }
  }, [isOpen]);

  // Rotar mensajes de procesamiento mientras dura la simulación
  useEffect(() => {
    if (step !== 'processing') return;
    const interval = setInterval(() => {
      setProcessingMsg(prev => (prev + 1) % PROCESSING_MESSAGES.length);
    }, 700);
    return () => clearInterval(interval);
  }, [step]);

  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    setStep('details');
  };

  const validateNequiPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    setNequiPhone(digits);
    if (digits.length > 0 && digits.length !== 10) {
      setNequiError('El número de celular debe tener exactamente 10 dígitos.');
    } else {
      setNequiError('');
    }
  };

  const isDetailsValid = () => {
    if (!selectedMethod) return false;
    if (selectedMethod.id === 'PSE') return pseBank !== '';
    if (selectedMethod.id === 'NEQUI') return nequiPhone.length === 10;
    return true; // BANCOLOMBIA es válido directo
  };

  const handlePay = async () => {
    setStep('processing');
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const orderRef = `ORD-SG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const response = await fetch(`${API_URL}/api/payments/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: selectedMethod.id,
          bank: selectedMethod.id === 'PSE' ? pseBank : 
                selectedMethod.id === 'BANCOLOMBIA' ? 'Bancolombia' : 'Nequi',
          items: cart.map(item => ({
            id: item.id,
            id_producto: item.id,
            name: item.nombre || item.name,
            quantity: item.quantity,
            price: item.precio || item.price
          })),
          amount: totalPrice,
          reference: orderRef,
          userId: user?.id || user?.id_usuario,
          deliveryDetails: {},
          forceDecline: pseBank.toLowerCase().includes('pruebas')
        })
      });

      const data = await response.json();
      setResult(data);
      setStep('result');
      if (data.ok && onPaymentSuccess) {
        onPaymentSuccess(data.transaction);
      }
    } catch (error) {
      console.error('Error en pasarela de pago simulada:', error);
      setResult({ ok: false, message: 'Error de conexión con la pasarela de pago.', transaction: null });
      setStep('result');
    }
  };

  const handleRetry = () => {
    setStep('method');
    setSelectedMethod(null);
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
        onClick={(e) => e.target === e.currentTarget && step !== 'processing' && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto relative border border-white/15 shadow-2xl"
          id="payment-gateway-modal"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {step === 'details' && (
                <button onClick={() => setStep('method')} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <ChevronLeft size={20} />
                </button>
              )}
              <div>
                <h2 className="text-xl font-playfair font-bold flex items-center gap-2">
                  <Lock size={16} className="text-gold-premium" />
                  Pago <span className="text-gold-premium italic">Seguro</span>
                </h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-0.5">
                  Simulación Académica · Mock Wompi
                </p>
              </div>
            </div>
            {step !== 'processing' && (
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Total Bar */}
          <div className="px-6 py-3.5 bg-gold-premium/5 border-b border-gold-premium/15 flex justify-between items-center">
            <span className="text-xs text-white/60 font-bold uppercase tracking-wider">Total a pagar</span>
            <span className="text-2xl font-bold text-gold-premium">{formatPrice(totalPrice)}</span>
          </div>

          {/* Body Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* ─── STEP 1: Selección de Método de Pago ─── */}
              {step === 'method' && (
                <motion.div key="method" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Selecciona tu método de pago</h3>
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <motion.button
                        key={method.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectMethod(method)}
                        className={`w-full p-5 rounded-2xl border border-white/10 bg-gradient-to-r ${method.bgGradient} hover:border-white/20 transition-all flex items-center gap-4 text-left group`}
                        id={`payment-method-${method.id.toLowerCase()}`}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: method.accentColor + '25' }}>
                          <Icon size={24} style={{ color: method.accentColor }} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-base">{method.name}</div>
                          <div className="text-xs text-white/50">{method.subtitle}</div>
                        </div>
                        <ChevronLeft size={18} className="rotate-180 text-white/20 group-hover:text-white/60 transition-colors" />
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {/* ─── STEP 2: Detalles del Método ─── */}
              {step === 'details' && selectedMethod && (
                <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  {/* Badge del método seleccionado */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                    <selectedMethod.icon size={20} style={{ color: selectedMethod.accentColor }} />
                    <span className="font-bold text-sm">{selectedMethod.name}</span>
                  </div>

                  {/* Campos PSE */}
                  {selectedMethod.id === 'PSE' && (
                    <div className="space-y-4">
                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Selecciona tu Banco</label>
                        <div className="relative">
                          <select
                            value={pseBank}
                            onChange={(e) => setPseBank(e.target.value)}
                            className="input-field appearance-none pr-10 cursor-pointer bg-[#12111a] border-white/15"
                            id="pse-bank-select"
                          >
                            <option value="" disabled>Selecciona un banco de la lista</option>
                            {PSE_BANKS.map(bank => (
                              <option key={bank} value={bank} style={{ backgroundColor: '#1a162e', color: '#fff' }}>{bank}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        </div>
                        {pseBank.includes('Pruebas') && (
                          <p className="text-[11px] text-amber-400/90 font-semibold mt-1">⚠️ Este banco simulará un rechazo para demostración de pruebas.</p>
                        )}
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Tipo de Persona</label>
                        <div className="grid grid-cols-2 gap-3">
                          {PERSON_TYPES.map(pt => (
                            <button
                              key={pt.id}
                              type="button"
                              onClick={() => setPsePersonType(pt.id)}
                              className={`p-3 rounded-xl text-sm font-bold border transition-all ${psePersonType === pt.id ? 'border-gold-premium bg-gold-premium/15 text-gold-premium' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                              {pt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Campos Nequi */}
                  {selectedMethod.id === 'NEQUI' && (
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Número de celular Nequi</label>
                      <div className="flex gap-2">
                        <div className="px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/50 text-sm font-bold flex items-center">+57</div>
                        <input
                          type="tel"
                          value={nequiPhone}
                          onChange={(e) => validateNequiPhone(e.target.value)}
                          placeholder="300 123 4567"
                          maxLength={10}
                          className={`input-field flex-1 ${nequiError ? 'border-red-500/50' : ''}`}
                          id="nequi-phone-input"
                        />
                      </div>
                      {nequiError && <span className="text-xs text-red-400 font-semibold">{nequiError}</span>}
                    </div>
                  )}

                  {/* Información Botón Bancolombia */}
                  {selectedMethod.id === 'BANCOLOMBIA' && (
                    <div className="p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-center space-y-3">
                      <Shield size={36} className="mx-auto text-yellow-400" />
                      <p className="text-sm text-white/80 leading-relaxed">
                        Al hacer clic en <strong className="text-white">Pagar</strong>, simularemos la redirección segura a la app o portal de <strong className="text-yellow-400">Bancolombia</strong> para autorizar la transferencia.
                      </p>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Entorno Seguro · Simulación Académica</p>
                    </div>
                  )}

                  {/* Botón Pagar */}
                  <button
                    onClick={handlePay}
                    disabled={!isDetailsValid()}
                    className={`w-full py-4 rounded-full font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg ${!isDetailsValid() ? 'opacity-40 cursor-not-allowed bg-white/10 text-white/30' : 'bg-gold-premium text-background-dark hover:scale-[1.02] shadow-gold-premium/20 active:scale-95'}`}
                    id="payment-submit-button"
                  >
                    <Lock size={16} /> Pagar {formatPrice(totalPrice)}
                  </button>
                </motion.div>
              )}

              {/* ─── STEP 3: Procesando (Latencia Simulada) ─── */}
              {step === 'processing' && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center text-center space-y-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-gold-premium/20 border-t-gold-premium animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock size={24} className="text-gold-premium/70" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">Procesando tu pago</h3>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={processingMsg}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-sm text-white/50"
                      >
                        {PROCESSING_MESSAGES[processingMsg]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  {/* Barra de progreso */}
                  <div className="w-full max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gold-premium rounded-full"
                      initial={{ width: '10%' }}
                      animate={{ width: '90%' }}
                      transition={{ duration: 1.8, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Por favor no cierres esta ventana</p>
                </motion.div>
              )}

              {/* ─── STEP 4: Resultado del Pago ─── */}
              {step === 'result' && result && (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-6">
                  {result.ok ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                        className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto"
                      >
                        <CheckCircle className="text-green-400" size={42} />
                      </motion.div>
                      <div>
                        <h3 className="text-2xl font-playfair font-bold mb-1 text-white">¡Pago Aprobado!</h3>
                        <p className="text-sm text-white/50">Tu pedido ha sido confirmado exitosamente</p>
                      </div>
                      {result.transaction && (
                        <div className="glass-card p-4.5 text-left space-y-2.5 text-sm border border-white/10">
                          <div className="flex justify-between"><span className="text-white/50">Referencia:</span><span className="font-bold font-mono text-xs text-white">{result.transaction.reference}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Método:</span><span className="font-bold text-white">{result.transaction.method} — {result.transaction.bank}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Autorización:</span><span className="font-bold font-mono text-xs text-green-400">{result.transaction.authCode}</span></div>
                          <div className="flex justify-between border-t border-white/10 pt-2.5 mt-2.5"><span className="text-white/50">Total pagado:</span><span className="font-bold text-gold-premium">{formatPrice(result.transaction.amount)}</span></div>
                        </div>
                      )}
                      <button onClick={onClose} className="w-full py-3.5 rounded-full font-bold text-sm bg-gold-premium text-background-dark hover:scale-[1.02] transition-all shadow-lg shadow-gold-premium/20" id="payment-success-close">
                        Volver al Inicio
                      </button>
                    </>
                  ) : (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                        className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto"
                      >
                        <XCircle className="text-red-400" size={42} />
                      </motion.div>
                      <div>
                        <h3 className="text-2xl font-playfair font-bold mb-1 text-white">Pago Rechazado</h3>
                        <p className="text-sm text-red-300/80">{result.message}</p>
                      </div>
                      {result.transaction && (
                        <div className="glass-card p-4.5 text-left space-y-2.5 text-sm border border-white/10">
                          <div className="flex justify-between"><span className="text-white/50">Referencia:</span><span className="font-bold font-mono text-xs text-white">{result.transaction.reference}</span></div>
                          <div className="flex justify-between"><span className="text-white/50">Estado:</span><span className="font-bold text-red-400">DECLINADO</span></div>
                        </div>
                      )}
                      <button onClick={handleRetry} className="w-full py-3.5 rounded-full font-bold text-sm bg-white/10 border border-white/10 hover:bg-white/15 transition-all flex items-center justify-center gap-2 text-white" id="payment-retry-button">
                        <RefreshCw size={16} /> Reintentar pago
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PaymentGateway;
