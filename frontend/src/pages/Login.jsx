import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import '../styles/Auth.css';

function Login({ onLogin }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
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
        } else if (!/^[^\s@]+@[^\s@]+\.(com|net|edu)$/i.test(value)) {
          error = 'Email inválido (debe terminar en .com, .net o .edu).';
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
                     /^[^\s@]+@[^\s@]+\.(com|net|edu)$/i.test(formData.email) &&
                     !/\s/.test(formData.email) &&
                     !/\s/.test(formData.password) &&
                     !/[<>&"'\/]/.test(formData.email) &&
                     !/[<>&"'\/]/.test(formData.password) &&
                     Object.values(errors).every(x => x === '');

  const handleGoogleSuccess = async (credentialResponse) => {
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

      // Usar el nuevo endpoint dedicado de Google Login
      const loginRes = await fetch('/api/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      const data = await loginRes.json();

      if (loginRes.ok) {
        onLogin({ ...data.user, picture });
        navigate('/');
      } else {
        setErrors({ server: data.message || 'Error al vincular tu cuenta de Google.' });
        setLoading(false);
      }
    } catch (e) {
      console.error('Error in Google Auth flow', e);
      setErrors({ server: 'Error de conexión al procesar Google login.' });
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrors({ server: 'Error al iniciar sesión con Google.' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrors({ server: data.message || 'Error al iniciar sesión.' });
        setLoading(false);
        return;
      }

      onLogin(data.user);
      navigate('/');
    } catch (err) {
      setErrors({ server: 'Error de conexión con el servidor.' });
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

          {errors.server && <div className="login-error">{errors.server}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form__field">
              <span className="login-form__field-icon material-symbols-outlined">mail</span>
              <input
                type="text"
                inputMode="email"
                name="email"
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
    </div>
  );
}

export default Login;
