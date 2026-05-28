import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Auth.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [sent, setSent] = useState(false);

  const handleKeyDownNoSpaces = (e) => {
    if (e.key === ' ' || e.keyCode === 32) {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPreviewUrl('');

    if (!email) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }

    const forbiddenRegex = /[<>&"'\/]/;
    if (forbiddenRegex.test(email)) {
      setError('No se permiten los caracteres: < > & " \' /');
      return;
    }

    if (/\s/.test(email)) {
      setError('El correo no puede tener espacios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.(com|net|edu)$/i.test(email)) {
      setError('Email inválido (debe terminar en .com, .net o .edu).');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al procesar la solicitud.');
        setLoading(false);
        return;
      }

      setSuccess(data.message);
      setSent(true);

      // In development, show the preview URL if available
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }

      setLoading(false);
    } catch (err) {
      setError('Error de conexión con el servidor.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Full-screen background image */}
      <img
        src="/images/FONDO-LOGIN.png"
        alt="Helado artesanal"
        className="login-page__bg"
      />
      <div className="login-page__overlay"></div>

      {/* Card container */}
      <div className="login-page__container">
        <div className="login-card">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-brand__logo-container">
              <img 
                src="/images/LOGO-GELATTO.png" 
                alt="super gelatto" 
                className="login-brand__logo"
              />
            </div>
            <h2 className="login-brand__welcome">
              {sent ? '¡Revisa tu correo!' : 'Recuperar Cuenta'}
            </h2>
            <p className="login-brand__subtitle">
              {sent
                ? 'Te hemos enviado un enlace de recuperación.'
                : 'Ingresa tu correo para recibir un enlace de restablecimiento.'}
            </p>
          </div>

          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          {!sent ? (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form__field">
                <span className="login-form__field-icon material-symbols-outlined">mail</span>
                <input
                  type="text"
                  inputMode="email"
                  className={`login-form__input ${error && (error.includes('correo') || error.includes('Email')) ? 'input-field-error' : ''}`}
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    if (/\s/.test(val)) {
                      setError('El correo no puede tener espacios.');
                    } else if (val && !/^[^\s@]+@[^\s@]+\.(com|net|edu)$/i.test(val)) {
                      setError('Email inválido (debe terminar en .com, .net o .edu).');
                    } else {
                      setError('');
                    }
                  }}
                  onKeyDown={handleKeyDownNoSpaces}
                  required
                />
              </div>

              <button
                type="submit"
                className={`login-form__submit ${loading ? 'login-form__submit--loading' : ''}`}
                disabled={loading}
              >
                <span className="login-form__submit-shimmer"></span>
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
          ) : (
            <div className="login-footer" style={{ textAlign: 'left', marginTop: '1rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                Si el correo <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.
                Revisa también tu carpeta de spam.
              </p>

              {previewUrl && (
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem', 
                  background: 'rgba(255,255,255,0.05)', 
                  borderRadius: '1rem',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <p style={{ fontSize: '0.8rem', color: '#FFC107', marginBottom: '0.5rem' }}>🧪 Modo Desarrollo:</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="login-footer__link"
                    style={{ fontSize: '0.9rem' }}
                  >
                    📬 Ver correo en Ethereal
                  </a>
                </div>
              )}

              <button
                className="login-form__submit"
                style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                onClick={() => {
                  setSent(false);
                  setSuccess('');
                  setEmail('');
                  setPreviewUrl('');
                }}
              >
                Solicitar otro enlace
              </button>
            </div>
          )}

          <div className="login-footer">
            <p>
              <Link to="/login" className="login-footer__link">
                ← Volver al inicio de sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
