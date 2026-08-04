import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function CapturaFacial({ onCapture, onClose, title = "Reconocimiento Facial (AWS)", subtitle = "Posiciónate frente a la cámara con buena iluminación." }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setErrorMsg('');
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setErrorMsg('No se pudo acceder a la cámara. Por favor verifica que tu dispositivo tenga cámara y que hayas otorgado permisos en tu navegador.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    // Mirror horizontally so the picture matches the mirrored webcam view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Data = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(base64Data);
    setCapturing(false);
  };

  const handleConfirmPhoto = () => {
    if (capturedImage && onCapture) {
      stopCamera();
      onCapture(capturedImage);
    }
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#0b0c10] border border-gold-premium/30 rounded-3xl w-full max-w-lg p-6 relative shadow-2xl overflow-hidden flex flex-col items-center">
        {/* Glow accent background */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-gold-premium/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            stopCamera();
            if (onClose) onClose();
          }}
          className="absolute top-4 right-4 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer z-10"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gold-premium/10 border border-gold-premium/20 flex items-center justify-center text-gold-premium shadow-md">
            <Camera size={22} />
          </div>
          <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
          <p className="text-xs text-white/50 font-light mt-1 max-w-xs mx-auto">{subtitle}</p>
        </div>

        {/* Camera Feed / Captured Preview Container */}
        <div className="w-full h-72 bg-black border border-white/10 rounded-2xl overflow-hidden relative flex items-center justify-center shadow-inner">
          {errorMsg ? (
            <div className="p-6 text-center text-red-400 space-y-3">
              <AlertCircle size={36} className="mx-auto text-red-400/80" />
              <p className="text-xs font-light leading-relaxed">{errorMsg}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium cursor-pointer transition-all inline-flex items-center gap-1.5"
              >
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Captura facial"
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              {/* Oval Face Guide Overlay */}
              <div className="absolute inset-0 border-2 border-gold-premium/40 rounded-full w-48 h-60 m-auto pointer-events-none border-dashed animate-pulse"></div>
            </>
          )}
        </div>

        {/* Hidden Canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action Controls */}
        <div className="w-full mt-6 flex gap-3">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetakePhoto}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Repetir Foto
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="flex-1 py-3 px-4 bg-gold-premium hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-gold-premium/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Usar Esta Foto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleTakeSnapshot}
              disabled={!cameraActive || capturing}
              className="w-full py-3.5 px-4 bg-gold-premium hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg hover:shadow-gold-premium/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Camera size={16} /> Capturar Foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
