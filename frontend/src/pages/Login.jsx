import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { setToken } from '../utils/api';
import CapturaFacial from '../components/CapturaFacial';
import '../styles/Auth.css';

function Login({ onLogin }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginRole, setLoginRole] = useState('cliente');
  const [showCapturaFacialModal, setShowCapturaFacialModal] = useState(false);
  const [facialLoading, setFacialLoading] = useState(false);
  const navigate = useNavigate();

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
      if (name === 'email') {
        if (/\s/.test(value)) {
          error = 'El correo no puede tener espacios.';
        } else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i.test(value)) {
          error = 'Email inválido (sin caracteres especiales y debe terminar en .com, .net o .edu).';
        }
      }
      if (name === 'password') {
        if (/\s/.test(value)) {
          error = 'La contraseña no puede tener espacios.';
        } else if (!value) {
          error = 'La contraseña es obligatoria.';
        }
      }
    }
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
  };

  const isFormValid = formData.email && 
                     formData.password && 
                     /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i.test(formData.email) &&
                     !/\s/.test(formData.email) &&
                     !/\s/.test(formData.password) &&
                     !/[<>&"'\/]/.test(formData.email) &&
                     !/[<>&"'\/]/.test(formData.password) &&
                     Object.values(errors).every(x => x === '');

  const handleGoogleSuccess = React.useCallback(async (credentialResponse) => {
    setLoading(true);
    try {
      const base64Url = credentialResponse.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const payload = JSON.parse(jsonPayload);
      const email = payload.email;
      const name = payload.name || payload.given_name || 'Usuario de Google';
      const picture = payload.picture;

      const loginRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      const data = await loginRes.json();

      if (loginRes.ok) {
        if (data.token) setToken(data.token);
        onLogin({ ...data.user, picture });
        navigate(data.user?.rol === 'admin' ? '/admin' : '/');
      } else {
        setErrors({ server: data.message || 'Error al vincular tu cuenta de Google.' });
        setLoading(false);
      }
    } catch (e) {
      console.error('Error in Google Auth flow', e);
      setErrors({ server: 'Error de conexión al procesar Google login.' });
      setLoading(false);
    }
  }, [navigate, onLogin]);

  const handleGoogleError = React.useCallback(() => {
    setErrors({ server: 'Error al iniciar sesión con Google.' });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setErrors({ server: data.message || 'Error al iniciar sesión.' });
        setLoading(false);
        return;
      }

      if (data.token) setToken(data.token);
      onLogin(data.user);
      navigate(data.user.rol === 'admin' ? '/admin' : '/');
    } catch (err) {
      setErrors({ server: 'Error de conexión con el servidor.' });
      setLoading(false);
    }
  };

  const handleRekognitionLogin = async (base64Image) => {
    setShowCapturaFacialModal(false);
    setFacialLoading(true);
    setErrors({});

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/faceid/rekognition-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Reconocimiento facial no reconocido o acceso denegado.');
      }

      if (data.token) {
        setToken(data.token);
        sessionStorage.setItem('superGelatto_token', data.token);
        localStorage.setItem('superGelatto_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('superGelatto_user', JSON.stringify(data.user));
        sessionStorage.setItem('superGelatto_user', JSON.stringify(data.user));
        onLogin(data.user);
        navigate(data.user.rol === 'admin' ? '/admin' : '/');
      }
    } catch (err) {
      console.error('Error en reconocimiento facial:', err);
      setErrors({ server: err.message || 'Reconocimiento facial no reconocido o acceso denegado.' });
    } finally {
      setFacialLoading(false);
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

      {/* Login card container */}
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
            <h2 className="login-brand__welcome">¡Hola de nuevo!</h2>
            <p className="login-brand__subtitle">Ingresa a tu taller del sabor.</p>
          </div>

          {/* Selector de Rol */}
          <div className="flex bg-white/5 p-1.5 rounded-2xl mb-6 border border-white/5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setLoginRole('cliente');
                setFormData({ email: '', password: '' });
                setErrors({});
              }}
              className={`flex-grow flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                loginRole === 'cliente'
                  ? 'bg-white/10 text-white shadow-[0_2px_10px_rgba(255,255,255,0.05)]'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <span className="material-symbols-outlined !text-sm">person</span>
              Cliente
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginRole('admin');
                setFormData({ email: '', password: '' });
                setErrors({});
              }}
              className={`flex-grow flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                loginRole === 'admin'
                  ? 'bg-gold-premium/15 text-gold-premium border border-gold-premium/20 shadow-[0_2px_15px_rgba(212,175,55,0.15)] font-bold'
                  : 'text-white/40 hover:text-gold-premium/80'
              }`}
            >
              <span className="material-symbols-outlined !text-sm">shield</span>
              Administrador
            </button>
          </div>

          {loginRole === 'admin' && (
            <div className="mb-6 animate-in fade-in duration-300">
              <button
                type="button"
                onClick={() => setShowCapturaFacialModal(true)}
                disabled={facialLoading || loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900/90 border border-gold-premium/40 hover:border-gold-premium text-gold-premium font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] cursor-pointer transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined !text-xl">center_focus_strong</span>
                {facialLoading ? 'Analizando rostro en AWS...' : 'Entrar con Reconocimiento Facial (AWS)'}
              </button>
            </div>
          )}

          {errors.server && <div className="login-error">{errors.server}</div>}

          <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
            <div className="login-form__field">
              <span className="login-form__field-icon material-symbols-outlined">mail</span>
              <input
                type="email"
                name="email"
                autoComplete="off"
                placeholder="Correo electrónico"
                className={`login-form__input ${errors.email ? 'input-field-error' : ''}`}
                required
                value={formData.email}
                onChange={handleChange}
                onKeyDown={handleKeyDownNoSpaces}
              />
              {errors.email && <span className="field-error-msg">{errors.email}</span>}
            </div>

            <div className="login-form__field">
              <span className="login-form__field-icon material-symbols-outlined">lock</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Contraseña"
                className={`login-form__input ${errors.password ? 'input-field-error' : ''}`}
                required
                value={formData.password}
                onChange={handleChange}
                onKeyDown={handleKeyDownNoSpaces}
              />
              {errors.password && <span className="field-error-msg">{errors.password}</span>}
            </div>

            <div className="login-form__forgot">
              <Link to="/forgot-password" className="login-form__forgot-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              className={`login-form__submit ${loading ? 'login-form__submit--loading' : ''} ${!isFormValid ? 'button-disabled' : ''}`}
              disabled={loading || !isFormValid}
            >
              <span className="login-form__submit-shimmer"></span>
              {loading ? 'Cargando...' : 'Entrar'}
            </button>
          </form>

          {/* Divider */}
          <div className="login-divider">
            <div className="login-divider__line"></div>
            <span className="login-divider__text">O continúa con</span>
            <div className="login-divider__line"></div>
          </div>

          {/* Google */}
          <div className="login-google">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              shape="pill"
              width={300}
              text="signin_with"
            />
          </div>

          {/* Register */}
          <div className="login-footer">
            <p>
              ¿Aún no tienes cuenta?{' '}
              <Link to="/register" className="login-footer__link">Regístrate aquí</Link>
            </p>
          </div>
        </div>
      </div>

      {showCapturaFacialModal && (
        <CapturaFacial
          title="Autenticación Facial (AWS)"
          subtitle="Toma una foto de tu rostro para verificar tu acceso de administrador."
          onCapture={handleRekognitionLogin}
          onClose={() => setShowCapturaFacialModal(false)}
        />
      )}
    </div>
  );
}

export default Login;
