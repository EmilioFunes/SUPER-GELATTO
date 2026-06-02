import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
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
      if (name === 'name') {
        if (!value.trim()) {
          error = 'El nombre es obligatorio.';
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
      
      if (name === 'password') {
        if (/\s/.test(value)) {
          error = 'La contraseña no puede tener espacios.';
        } else if (value.length < 8) {
          error = 'Mínimo 8 caracteres.';
        } else if (!/[A-Z]/.test(value)) {
          error = 'Falta una mayúscula.';
        } else if (!/[a-z]/.test(value)) {
          error = 'Falta una minúscula.';
        } else if (!/[0-9]/.test(value)) {
          error = 'Falta un número.';
        } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
          error = 'Falta un carácter especial.';
        }
      }
      
      if (name === 'confirmPassword') {
        if (/\s/.test(value)) {
          error = 'La contraseña no puede tener espacios.';
        } else if (value !== formData.password) {
          error = 'No coincide.';
        }
      }
    }
    
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
    setSuccess('');
  };

  const isFormValid = 
    formData.name && 
    formData.name === formData.name.trim() &&
    !/\s{2,}/.test(formData.name) &&
    formData.email && 
    /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.(com|net|edu)$/i.test(formData.email) &&
    !/\s/.test(formData.email) &&
    !/[<>&"'\/]/.test(formData.email) &&
    !/[<>&"'\/]/.test(formData.name) &&
    !/[<>&"'\/]/.test(formData.password) &&
    formData.password.length >= 8 && 
    /[A-Z]/.test(formData.password) &&
    /[a-z]/.test(formData.password) &&
    /[0-9]/.test(formData.password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) &&
    !/\s/.test(formData.password) &&
    formData.password === formData.confirmPassword &&
    Object.values(errors).every(x => x === '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ server: data.message || 'Error al registrarse.' });
        setLoading(false);
        return;
      }

      setSuccess('¡Registro exitoso! Redirigiendo al login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
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

      {/* Register card */}
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
            <h2 className="login-brand__welcome">¡Únete!</h2>
            <p className="login-brand__subtitle">Crea tu cuenta y disfruta del sabor.</p>
          </div>

          {errors.server && <div className="login-error">{errors.server}</div>}

          {success && (
            <div className="login-success">{success}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form__field">
              <span className="login-form__field-icon material-symbols-outlined">person</span>
              <input
                type="text"
                name="name"
                placeholder="Nombre completo"
                className={`login-form__input ${errors.name ? 'input-field-error' : ''}`}
                required
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && <span className="field-error-msg">{errors.name}</span>}
            </div>

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
                placeholder="Contraseña (mín. 8)"
                className={`login-form__input ${errors.password ? 'input-field-error' : ''}`}
                required
                minLength="8"
                value={formData.password}
                onChange={handleChange}
                onKeyDown={handleKeyDownNoSpaces}
              />
              {errors.password && <span className="field-error-msg">{errors.password}</span>}
            </div>

            <div className="login-form__field">
              <span className="login-form__field-icon material-symbols-outlined">lock</span>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirmar contraseña"
                className={`login-form__input ${errors.confirmPassword ? 'input-field-error' : ''}`}
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                onKeyDown={handleKeyDownNoSpaces}
              />
              {errors.confirmPassword && <span className="field-error-msg">{errors.confirmPassword}</span>}
            </div>

            <button
              type="submit"
              className={`login-form__submit ${loading ? 'login-form__submit--loading' : ''} ${!isFormValid ? 'button-disabled' : ''}`}
              disabled={loading || !isFormValid}
            >
              <span className="login-form__submit-shimmer"></span>
              {loading ? 'Registrando...' : 'Registrarse'}
            </button>
          </form>

          {/* Footer */}
          <div className="login-footer">
            <p>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="login-footer__link">Inicia sesión aquí</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
