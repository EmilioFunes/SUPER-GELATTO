import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import '../styles/Auth.css';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/reset-password/${token}`);
        const data = await res.json();

        if (data.valid) {
          setTokenValid(true);
        } else {
          setError(data.message || 'Enlace inválido o expirado.');
          setTokenValid(false);
        }
      } catch (err) {
        setError('Error de conexión con el servidor.');
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleKeyDownNoSpaces = (e) => {
    if (e.key === ' ' || e.keyCode === 32) {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };
    setFormData(updatedForm);
    
    // Real-time validation
    let err = '';
    const forbiddenRegex = /[<>&"'\/]/;
    
    if (forbiddenRegex.test(updatedForm.password) || forbiddenRegex.test(updatedForm.confirmPassword)) {
      err = 'No se permiten los caracteres: < > & " \' /';
    } else if (updatedForm.password) {
      if (/\s/.test(updatedForm.password)) {
        err = 'La contraseña no puede tener espacios.';
      } else if (updatedForm.password.length < 8) {
        err = 'La contraseña debe tener al menos 8 caracteres.';
      } else if (!/[A-Z]/.test(updatedForm.password)) {
        err = 'La contraseña debe incluir al menos una letra mayúscula.';
      } else if (!/[a-z]/.test(updatedForm.password)) {
        err = 'La contraseña debe incluir al menos una letra minúscula.';
      } else if (!/[0-9]/.test(updatedForm.password)) {
        err = 'La contraseña debe incluir al menos un número.';
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(updatedForm.password)) {
        err = 'La contraseña debe incluir al menos un carácter especial.';
      }
    }
    
    if (!err && updatedForm.confirmPassword) {
      if (/\s/.test(updatedForm.confirmPassword)) {
        err = 'La contraseña no puede tener espacios.';
      } else if (updatedForm.password !== updatedForm.confirmPassword) {
        err = 'Las contraseñas no coinciden.';
      }
    }
    
    setError(err);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.password || !formData.confirmPassword) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    const forbiddenRegex = /[<>&"'\/]/;
    if (forbiddenRegex.test(formData.password) || forbiddenRegex.test(formData.confirmPassword)) {
      setError('No se permiten los caracteres: < > & " \' /');
      return;
    }

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setError('La contraseña debe incluir al menos una letra mayúscula.');
      return;
    }

    if (!/[a-z]/.test(formData.password)) {
      setError('La contraseña debe incluir al menos una letra minúscula.');
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError('La contraseña debe incluir al menos un número.');
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      setError('La contraseña debe incluir al menos un carácter especial.');
      return;
    }

    if (/\s/.test(formData.password)) {
      setError('La contraseña no puede tener espacios.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al restablecer la contraseña.');
        setLoading(false);
        return;
      }

      setSuccess(data.message);
      setLoading(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError('Error de conexión con el servidor.');
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (validating) {
    return (
      <div className="login-page">
        <img
          src="/images/FONDO-LOGIN.png"
          alt="Helado artesanal"
          className="login-page__bg"
        />
        <div className="login-page__overlay"></div>
        <div className="login-page__container">
          <div className="login-card">
            <div className="login-brand">
              <div className="login-brand__logo-container">
                <img 
                  src="/images/LOGO-GELATTO.png" 
                  alt="super gelatto" 
                  className="login-brand__logo"
                />
              </div>
              <h2 className="login-brand__welcome">Validando...</h2>
              <p className="login-brand__subtitle">Verificando tu enlace de recuperación.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid && !success) {
    return (
      <div className="login-page">
        <img
          src="/images/FONDO-LOGIN.png"
          alt="Helado artesanal"
          className="login-page__bg"
        />
        <div className="login-page__overlay"></div>
        <div className="login-page__container">
          <div className="login-card">
            <div className="login-brand">
              <div className="login-brand__logo-container">
                <img 
                  src="/images/LOGO-GELATTO.png" 
                  alt="super gelatto" 
                  className="login-brand__logo"
                />
              </div>
              <h2 className="login-brand__welcome">Enlace Inválido</h2>
              <p className="login-brand__subtitle">
                {error || 'Este enlace ha expirado o ya fue utilizado.'}
              </p>
            </div>

            <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
              <button className="login-form__submit">
                Solicitar nuevo enlace
              </button>
            </Link>

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

  // Valid token — show reset form
  return (
    <div className="login-page">
      <img
        src="/images/FONDO-LOGIN.png"
        alt="Helado artesanal"
        className="login-page__bg"
      />
      <div className="login-page__overlay"></div>

      <div className="login-page__container">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand__logo-container">
              <img 
                src="/images/LOGO-GELATTO.png" 
                alt="super gelatto" 
                className="login-brand__logo"
              />
            </div>
            <h1 className="hidden">super gelatto</h1>
            <h2 className="login-brand__welcome">
              {success ? '¡Completado!' : 'Nueva Contraseña'}
            </h2>
            <p className="login-brand__subtitle">
              {success
                ? 'Tu contraseña ha sido actualizada con éxito.'
                : 'Ingresa tu nueva clave de acceso.'}
            </p>
          </div>

          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          {!success && (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form__field">
                <span className="login-form__field-icon material-symbols-outlined">lock</span>
                <input
                  type="password"
                  name="password"
                  className={`login-form__input ${error && (error.includes('La contraseña') || error.includes('caracteres')) ? 'input-field-error' : ''}`}
                  placeholder="Nueva contraseña"
                  value={formData.password}
                  onChange={handleChange}
                  onKeyDown={handleKeyDownNoSpaces}
                  required
                />
              </div>

              <div className="login-form__field">
                <span className="login-form__field-icon material-symbols-outlined">lock</span>
                <input
                  type="password"
                  name="confirmPassword"
                  className={`login-form__input ${error && (error.includes('coinciden') || error.includes('espacios')) ? 'input-field-error' : ''}`}
                  placeholder="Confirmar contraseña"
                  value={formData.confirmPassword}
                  onChange={handleChange}
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
                {loading ? 'Procesando...' : 'Cambiar contraseña'}
              </button>
            </form>
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

export default ResetPassword;
