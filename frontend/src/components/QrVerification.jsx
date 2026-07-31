import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ShieldCheck, ShieldAlert, QrCode } from 'lucide-react';

export default function QrVerification({ userId, isEnrolled, onSuccess, onCancel }) {
  const [qrToken, setQrToken] = useState('');
  const [status, setStatus] = useState(isEnrolled ? 'scanning' : 'generating');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Para enrolamiento
  useEffect(() => {
    if (!isEnrolled && !qrToken) {
      // Generamos un token pseudoaleatorio (UUID rudimentario)
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      setQrToken(token);
      setStatus('waiting_enroll');
    }
  }, [isEnrolled, qrToken]);

  // Para escaneo
  useEffect(() => {
    let scanner = null;
    
    if (isEnrolled && status === 'scanning') {
      scanner = new Html5QrcodeScanner(
        "qr-reader", 
        { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1.0 }, 
        false
      );
      
      const onScanSuccess = async (decodedText) => {
        scanner.pause();
        setStatus('verifying');
        setErrorMessage('');
        
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/verificar-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, qrToken: decodedText })
          });
          
          const data = await res.json();
          if (res.ok && data.success) {
            setStatus('success');
            scanner.clear();
            setTimeout(() => onSuccess(), 1500);
          } else {
            setErrorMessage('Código incorrecto. Acceso denegado.');
            setStatus('scanning');
            scanner.resume();
          }
        } catch (err) {
          setErrorMessage('Error de conexión.');
          setStatus('scanning');
          scanner.resume();
        }
      };

      scanner.render(onScanSuccess, (err) => {
        // Errores de escaneo ignorados (no encontró QR)
      });
    }
    
    return () => {
      if (scanner) {
        scanner.clear().catch(e => console.error("Fallo al limpiar scanner:", e));
      }
    };
  }, [isEnrolled, status, userId, onSuccess]);

  const handleEnroll = async () => {
    setStatus('enrolling');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/enrolar-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, qrToken })
      });
      if (res.ok) {
        setStatus('success');
        setTimeout(() => onSuccess(), 1500);
      } else {
        setErrorMessage('Error al enrolar.');
        setStatus('waiting_enroll');
      }
    } catch (err) {
      setErrorMessage('Error de conexión.');
      setStatus('waiting_enroll');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="bg-black/40 border border-white/10 rounded-3xl p-8 w-full max-w-md flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-gold-premium to-transparent opacity-50"></div>
        
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(212,175,55,0.15)]">
          {status === 'success' ? (
            <ShieldCheck className="text-emerald-400 w-8 h-8" />
          ) : (
            <QrCode className="text-gold-premium w-8 h-8" />
          )}
        </div>

        <h2 className="text-2xl font-serif text-gold-premium mb-2">
          {isEnrolled ? 'Verificación de Seguridad' : 'Registro de Seguridad'}
        </h2>
        
        <p className="text-white/60 text-sm mb-8 px-4 font-light leading-relaxed">
          {isEnrolled 
            ? 'Coloca tu código QR de acceso frente a la cámara para autenticarte.'
            : 'Toma una foto de este código QR único. Será requerido como llave para ingresar en el futuro.'}
        </p>

        {/* MODO ENROLAR */}
        {!isEnrolled && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="p-4 bg-white rounded-xl shadow-[0_0_40px_rgba(212,175,55,0.2)]">
              <QRCodeSVG value={qrToken} size={200} />
            </div>
            
            <button 
              onClick={handleEnroll}
              disabled={status === 'enrolling'}
              className="w-full py-4 rounded-xl font-bold tracking-widest text-xs uppercase bg-gradient-to-r from-gold-premium to-yellow-600 text-black hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
            >
              {status === 'enrolling' ? 'Guardando...' : 'He guardado este QR, Continuar'}
            </button>
          </div>
        )}

        {/* MODO ESCANEAR */}
        {isEnrolled && (
          <div className="w-full flex flex-col items-center">
            {status === 'success' ? (
              <div className="w-48 h-48 rounded-2xl border-2 border-emerald-500/50 flex items-center justify-center bg-emerald-500/10">
                <ShieldCheck className="w-20 h-20 text-emerald-400" />
              </div>
            ) : (
              <div className="w-full max-w-[300px] overflow-hidden rounded-2xl border-2 border-gold-premium/50 bg-black" id="qr-reader">
                {/* Contenedor para el escáner de html5-qrcode */}
              </div>
            )}
            
            {status === 'verifying' && (
              <p className="text-gold-premium mt-4 text-sm animate-pulse">Verificando credencial...</p>
            )}
          </div>
        )}

        {/* MENSAJES DE ERROR */}
        {errorMessage && (
          <div className="mt-6 flex items-center justify-center gap-2 text-red-400 bg-red-400/10 px-4 py-3 rounded-xl text-sm border border-red-400/20">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span className="text-left">{errorMessage}</span>
          </div>
        )}

        {/* BOTÓN CANCELAR */}
        <button 
          onClick={onCancel}
          className="mt-8 text-white/40 hover:text-white text-xs uppercase tracking-widest transition-colors font-semibold"
        >
          Cancelar y Volver
        </button>
      </div>
    </div>
  );
}
