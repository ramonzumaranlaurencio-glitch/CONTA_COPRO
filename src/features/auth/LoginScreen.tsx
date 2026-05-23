import React, { useState } from 'react';
import { BuildingBank24Regular, LockClosed24Regular, Person24Regular } from '@fluentui/react-icons';

type Props = {
  onLogin: (username: string, role: string) => void;
};

const USERS = [
  { username: 'admin', password: 'admin123', role: 'Administrador' },
  { username: 'contador', password: 'conta2026', role: 'Contador' },
  { username: 'gerente', password: 'gerente2026', role: 'Gerente' },
  { username: 'demo', password: 'demo', role: 'Demo' },
];

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'user' | 'pass' | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Ingrese usuario y contraseña.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const user = USERS.find(
        (u) => u.username === username.trim().toLowerCase() && u.password === password
      );
      if (user) {
        onLogin(user.username, user.role);
      } else {
        setError('Usuario o contraseña incorrectos.');
        setLoading(false);
      }
    }, 700);
  };

  const fieldStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '11px 12px 11px 42px',
    border: `1.5px solid ${focused ? '#0078d4' : '#d1d5db'}`,
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    background: focused ? '#fff' : '#f9fafb',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: focused ? '0 0 0 3px rgba(0,120,212,0.12)' : 'none',
    transition: 'all 0.15s',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #0c1f3d 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Fondo decorativo */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background:
            'radial-gradient(ellipse at 15% 50%, rgba(0,120,212,0.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(79,70,229,0.12) 0%, transparent 55%), radial-gradient(ellipse at 50% 90%, rgba(16,185,129,0.08) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />
      {/* Grilla decorativa */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Logo y nombre */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              background: 'linear-gradient(135deg, #0078d4 0%, #4f46e5 100%)',
              borderRadius: 20,
              marginBottom: 18,
              boxShadow: '0 8px 32px rgba(0,120,212,0.45), 0 0 0 1px rgba(255,255,255,0.1)',
            }}
          >
            <BuildingBank24Regular
              style={{ color: 'white', width: 36, height: 36, fontSize: 36 }}
            />
          </div>
          <h1
            style={{
              color: 'white',
              fontSize: 30,
              fontWeight: 800,
              margin: '0 0 4px',
              letterSpacing: '-0.5px',
            }}
          >
            CONTA_PRO
          </h1>
          <p
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 12,
              margin: 0,
              letterSpacing: '0.18em',
              fontWeight: 600,
            }}
          >
            ENTERPRISE · ERP CONTABLE
          </p>
        </div>

        {/* Tarjeta de login */}
        <div
          style={{
            background: 'rgba(255,255,255,0.98)',
            borderRadius: 20,
            padding: '36px 36px 28px',
            boxShadow: '0 32px 72px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          <h2
            style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#111827' }}
          >
            Acceso al Sistema
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>
            Ingrese sus credenciales para continuar
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Campo usuario */}
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6,
                }}
              >
                Usuario
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 13,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: focusedField === 'user' ? '#0078d4' : '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    transition: 'color 0.15s',
                  }}
                >
                  <Person24Regular style={{ width: 18, height: 18 }} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: admin, contador, gerente"
                  autoComplete="username"
                  style={fieldStyle(focusedField === 'user')}
                  onFocus={() => setFocusedField('user')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Campo contraseña */}
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6,
                }}
              >
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 13,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: focusedField === 'pass' ? '#0078d4' : '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    transition: 'color 0.15s',
                  }}
                >
                  <LockClosed24Regular style={{ width: 18, height: 18 }} />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                  style={{ ...fieldStyle(focusedField === 'pass'), paddingRight: 44 }}
                  onFocus={() => setFocusedField('pass')}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '2px 4px',
                  }}
                >
                  {showPass ? 'OCULTAR' : 'VER'}
                </button>
              </div>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  color: '#dc2626',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                ⚠ {error}
              </div>
            )}

            {/* Botón de acceso */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading
                  ? '#bfdbfe'
                  : 'linear-gradient(135deg, #0078d4 0%, #4f46e5 100%)',
                color: loading ? '#93c5fd' : 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(0,120,212,0.45)',
                letterSpacing: '0.02em',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              {loading ? '⏳ Verificando credenciales...' : '→ Ingresar al Sistema'}
            </button>
          </form>

          {/* Credenciales de demo */}
          <div
            style={{
              marginTop: 24,
              padding: '14px 16px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 10,
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: 12,
                fontWeight: 700,
                color: '#0369a1',
                letterSpacing: '0.05em',
              }}
            >
              CREDENCIALES DE ACCESO
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
              {[
                { label: 'Administrador', user: 'admin', pass: 'admin123' },
                { label: 'Contador', user: 'contador', pass: 'conta2026' },
                { label: 'Gerente', user: 'gerente', pass: 'gerente2026' },
                { label: 'Demo', user: 'demo', pass: 'demo' },
              ].map((c) => (
                <button
                  key={c.user}
                  type="button"
                  onClick={() => {
                    setUsername(c.user);
                    setPassword(c.pass);
                    setError('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.7)',
                    border: '1px solid #bae6fd',
                    borderRadius: 6,
                    padding: '6px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: '#0c4a6e',
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 12, color: '#0369a1' }}>
                    {c.label}
                  </strong>
                  {c.user} / {c.pass}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.25)',
            fontSize: 11,
            marginTop: 20,
            letterSpacing: '0.05em',
          }}
        >
          CONTA_PRO Enterprise v2.6 · Todos los derechos reservados · 2026
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
