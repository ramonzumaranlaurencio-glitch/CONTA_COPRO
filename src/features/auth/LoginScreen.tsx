import React, { useEffect, useRef, useState } from 'react';
import { PlanSelectorModal } from '../../components/PlanSelectorModal';
import type { PlanSelected } from '../../components/PlanSelectorModal';
import { useTenantStore } from '../../hooks/useTenantStore';
import type { Rubro } from '../../config/itemCatalog';

// ─── Tipos globales Google GSI + OAuth2 ────────────────────────────────────
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: () => void;
          cancel: () => void;
        };
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

// ─── Tipos ─────────────────────────────────────────────────────────────────
type Step =
  | 'LANDING'
  | 'LOGIN'
  | 'REG_TYPE'
  | 'REG_ACCOUNTANT'
  | 'REG_COMPANY'
  | 'PLAN_ACCOUNTANT'
  | 'PLAN_COMPANY'
  | 'RUBRO'
  | 'API_CONFIG'
  | 'CONFIRM'
  | 'ADD_COMPANY';

type AccountType = 'ACCOUNTANT' | 'COMPANY' | null;

type Props = {
  onLogin: (rbacRole: string, displayRole: string, plan: string) => void;
};

// ─── Usuarios del sistema ───────────────────────────────────────────────────
const USERS = [
  { username: 'contapro',  password: 'ContaPro2026!',  role: 'CONTA_PRO SuperAdmin',  rbacRole: 'SUPER_ADMIN', plan: 'CONTA_PRO'  },
  { username: 'admin',     password: 'admin123',        role: 'Administrador',         rbacRole: 'ADMIN',       plan: 'PREMIUM'    },
  { username: 'contador',  password: 'conta2026',       role: 'Contador',              rbacRole: 'ACCOUNTANT',  plan: 'PLUS'       },
  { username: 'gerente',   password: 'gerente2026',     role: 'Gerente',               rbacRole: 'CONTROLLER',  plan: 'PLUS'       },
  { username: 'demo',      password: 'demo',            role: 'Demo',                  rbacRole: 'ACCOUNTANT',  plan: 'BASIC'      },
];

// ─── Paleta 3D ─────────────────────────────────────────────────────────────
const P = {
  bg0:     '#020812',
  bg1:     '#050d1a',
  bg2:     '#0b1a30',
  border:  '#1e3a5f',
  accent:  '#38bdf8',
  blue:    '#0078d4',
  indigo:  '#4f46e5',
  green:   '#22c55e',
  yellow:  '#f59e0b',
  purple:  '#a855f7',
  red:     '#ef4444',
  text:    '#e8f0fe',
  muted:   '#7da3c4',
  dim:     '#4d7a9e',
  glass:   'rgba(11,26,48,0.85)',
  glassB:  'rgba(30,58,95,0.4)',
};

// ─── Rubros disponibles ─────────────────────────────────────────────────────
const RUBROS = [
  { id: 'COMERCIAL',    icon: '🏪', label: 'Comercial',         desc: 'Venta de mercaderías, ferretería, distribuidoras',    color: P.accent  },
  { id: 'SERVICIOS',    icon: '💼', label: 'Servicios',          desc: 'Consultoría, marketing, transporte, mantenimiento',   color: P.green   },
  { id: 'CONSTRUCCION', icon: '🏗️', label: 'Construcción',      desc: 'Obras civiles, contratistas, edificaciones',          color: P.yellow  },
  { id: 'FABRICACION',  icon: '🏭', label: 'Fabricación',        desc: 'Manufactura, textil, metal mecánica, alimentos',      color: P.indigo  },
  { id: 'MINERIA',      icon: '⛏️', label: 'Minería',           desc: 'Artesanal, extractiva, exploración, canteras',        color: P.purple  },
  { id: 'OTRO',         icon: '✨', label: 'Otro rubro',         desc: 'La IA configura tu sistema según tu actividad',       color: P.muted   },
];

// ─── Módulos por rubro ──────────────────────────────────────────────────────
const RUBRO_MODULES: Record<string, string[]> = {
  COMERCIAL:    ['Compras', 'Ventas', 'Inventario', 'Almacén', 'Kardex', 'CXC/CXP', 'Caja y bancos'],
  SERVICIOS:    ['Ventas', 'Compras', 'CXC/CXP', 'Contratos', 'Caja y bancos'],
  CONSTRUCCION: ['Compras', 'Inventario', 'Almacén por obra', 'Centros de costo', 'Planillas', 'Activos fijos'],
  FABRICACION:  ['Compras', 'Inventario', 'Producción', 'Kardex', 'Costos', 'Planillas', 'Activos'],
  MINERIA:      ['Compras', 'Inventario', 'Almacén', 'EPP/Herramientas', 'Centros de costo', 'Planillas', 'Activos'],
  OTRO:         ['Configurado por IA según tu actividad'],
};

// ─── Helpers de estilo ──────────────────────────────────────────────────────
const btn = (color: string, outline = false): React.CSSProperties => ({
  padding: '12px 24px',
  borderRadius: 10,
  border: outline ? `1.5px solid ${color}` : 'none',
  background: outline ? 'transparent' : `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
  color: outline ? color : '#fff',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: "'Segoe UI', Arial, sans-serif",
  boxShadow: outline ? 'none' : `0 4px 20px ${color}55`,
  letterSpacing: '0.02em',
  transition: 'all 0.2s',
  width: '100%',
});

const input = (focused: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '11px 14px',
  borderRadius: 8,
  border: `1.5px solid ${focused ? P.accent : P.border}`,
  background: focused ? 'rgba(56,189,248,0.06)' : 'rgba(5,13,26,0.7)',
  color: P.text,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'Segoe UI', Arial, sans-serif",
  boxShadow: focused ? `0 0 0 3px ${P.accent}22` : 'none',
  transition: 'all 0.15s',
});

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: P.muted,
  marginBottom: 5,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const card: React.CSSProperties = {
  background: P.glass,
  border: `1px solid ${P.border}`,
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
};

// ─── Indicador de pasos ─────────────────────────────────────────────────────
const stepMap: Record<Step, number> = {
  LANDING: 0, LOGIN: 0, REG_TYPE: 1, REG_ACCOUNTANT: 2, REG_COMPANY: 2,
  PLAN_ACCOUNTANT: 3, PLAN_COMPANY: 3, RUBRO: 4, API_CONFIG: 5, CONFIRM: 6, ADD_COMPANY: 7,
};

const StepDots = ({ current }: { current: number }) => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <div key={n} style={{
        width: n === current ? 24 : 8, height: 8, borderRadius: 4,
        background: n === current ? P.accent : n < current ? `${P.accent}66` : P.border,
        transition: 'all 0.3s',
      }} />
    ))}
  </div>
);

// ─── Componente principal ───────────────────────────────────────────────────
export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [step, setStep] = useState<Step>('LANDING');
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedPlanName, setSelectedPlanName] = useState('');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedRubro, setSelectedRubro] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [landingError, setLandingError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const [focus, setFocus] = useState('');
  const [hoverOrb, setHoverOrb] = useState(false);

  // Estados del paso ADD_COMPANY (deben estar en el top — Rules of Hooks)
  const [acNewRuc,    setAcNewRuc]    = useState('');
  const [acNewNombre, setAcNewNombre] = useState('');
  const [acNewRubro,  setAcNewRubro]  = useState('COMERCIAL');
  const [acAddError,  setAcAddError]  = useState('');

  // Estado formulario contador
  const [acctData, setAcctData] = useState({
    nombres: '', apellidos: '', dni: '', telefono: '', email: '', password: '', confirmPass: '',
    colegio: '', colegiatura: '', especialidad: '', anios: '', rucPersonal: '',
  });

  // Estado formulario empresa
  const [compData, setCompData] = useState({
    ruc: '', razonSocial: '', nombreComercial: '', regimen: '', telefono: '', emailEmpresa: '',
    direccion: '', departamento: '',
    adminNombres: '', adminApellidos: '', adminDni: '', adminCargo: '', adminEmail: '', adminPass: '', adminPassC: '',
  });

  const mouseRef = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const welcomePlayedRef = useRef(false);

  // ─── Audio de bienvenida — Web Speech API (Google TTS gratis) ──────────────
  // Se activa UNA sola vez al primer movimiento del mouse
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const TEXT =
      'Bienvenido a CONTA PRO. ' +
      'Tu sistema contable inteligente, potenciado con inteligencia artificial, ' +
      'listo para impulsar el éxito de tu empresa.';

    const speak = () => {
      const voices = window.speechSynthesis.getVoices();

      // Prioridad: Google español > cualquier voz española masculina > primera española
      const voice =
        voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name) && /male|hombre|jorge|pablo|diego/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name)) ||
        voices.find(v => v.lang === 'es-PE') ||
        voices.find(v => v.lang === 'es-ES') ||
        voices.find(v => v.lang.startsWith('es'));

      const utter = new SpeechSynthesisUtterance(TEXT);
      if (voice) utter.voice = voice;
      utter.lang  = 'es-PE';
      utter.rate  = 0.91;   // ritmo natural (1 = normal)
      utter.pitch = 0.88;   // tono masculino (1 = normal)
      utter.volume = 0.85;

      window.speechSynthesis.cancel(); // limpiar cola
      window.speechSynthesis.speak(utter);
    };

    const onFirstMove = () => {
      if (welcomePlayedRef.current) return;
      welcomePlayedRef.current = true;
      window.removeEventListener('mousemove', onFirstMove);

      // Las voces pueden no estar listas aún en algunos navegadores
      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          speak();
        };
      }
    };

    window.addEventListener('mousemove', onFirstMove);
    return () => {
      window.removeEventListener('mousemove', onFirstMove);
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ─── Google OAuth2 popup (más confiable que One Tap) ────────────────────
  useEffect(() => {
    // Marcar como listo cuando el script GSI esté disponible
    const check = () => {
      if (window.google?.accounts?.oauth2) { setGsiReady(true); return; }
      setTimeout(check, 300);
    };
    check();
  }, []);

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setLandingError('Google Sign-In no está configurado. Usa usuario y contraseña.');
      setLoginError('Google Sign-In no está configurado. Usa usuario y contraseña.');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      setLandingError('Cargando Google... espera un segundo e intenta de nuevo.');
      setLoginError('Cargando Google... espera un segundo e intenta de nuevo.');
      return;
    }
    setLandingError('');
    setLoginError('');
    setGoogleLoading(true);

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: async (tokenResponse) => {
        if (tokenResponse.error || !tokenResponse.access_token) {
          const msg = tokenResponse.error === 'popup_closed_by_user'
            ? 'Cerraste la ventana de Google. Intenta de nuevo.'
            : 'Google canceló el acceso. Verifica tu cuenta e intenta de nuevo.';
          setLandingError(msg);
          setLoginError(msg);
          setGoogleLoading(false);
          return;
        }
        try {
          const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          const info = await infoRes.json();
          const given: string  = info.given_name  || '';
          const family: string = info.family_name || '';
          const email: string  = info.email || '';

          // Precargar datos y llevar al wizard de registro
          setAcctData(p => ({ ...p, nombres: given, apellidos: family, email }));
          setCompData(p => ({ ...p, adminNombres: given, adminApellidos: family, adminEmail: email, emailEmpresa: email }));
          setGoogleLoading(false);
          setStep('REG_TYPE');
        } catch {
          const msg = 'No se pudo conectar con Google. Verifica tu conexión.';
          setLandingError(msg);
          setLoginError(msg);
          setGoogleLoading(false);
        }
      },
    });

    client.requestAccessToken();
  };

  // ─── Google OAuth para REGISTRO — precarga nombre y email del formulario ────
  const handleGoogleRegister = (targetType: 'ACCOUNTANT' | 'COMPANY') => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google?.accounts?.oauth2) return;
    setGoogleLoading(true);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: async (tokenResponse) => {
        setGoogleLoading(false);
        if (tokenResponse.error || !tokenResponse.access_token) return;
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          const info = await res.json();
          const given: string = info.given_name || '';
          const family: string = info.family_name || '';
          const email: string = info.email || '';
          setAccountType(targetType);
          if (targetType === 'ACCOUNTANT') {
            setAcctData(p => ({ ...p, nombres: given, apellidos: family, email }));
            setStep('REG_ACCOUNTANT');
          } else {
            setCompData(p => ({ ...p, adminNombres: given, adminApellidos: family, adminEmail: email, emailEmpresa: email }));
            setStep('REG_COMPANY');
          }
        } catch { /* silencioso: el usuario rellena manualmente */ }
      },
    });
    client.requestAccessToken();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        cardRef.current.style.transform = `perspective(1000px) rotateY(${dx * 5}deg) rotateX(${-dy * 5}deg) translateZ(0)`;
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUser.trim() || !loginPass.trim()) { setLoginError('Ingrese usuario y contraseña.'); return; }
    setLoginLoading(true);
    setTimeout(() => {
      const u = USERS.find(u => u.username === loginUser.trim().toLowerCase() && u.password === loginPass);
      if (u) { onLogin(u.rbacRole, u.role, u.plan); }
      else { setLoginError('Usuario o contraseña incorrectos.'); setLoginLoading(false); }
    }, 700);
  };

  const quickLogin = (u: typeof USERS[0]) => {
    setLoginUser(u.username); setLoginPass(u.password); setLoginError('');
  };

  // ─── Fondo 3D ─────────────────────────────────────────────────────────────
  const Background = () => (
    <>
      <div style={{ position: 'fixed', inset: 0, background: `linear-gradient(135deg, ${P.bg0} 0%, #0d1f3d 45%, ${P.bg1} 100%)`, zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px', zIndex: 0, pointerEvents: 'none' }} />
      {/* Orbs 3D flotantes */}
      {[
        { x: '10%', y: '20%', size: 300, color: '#0078d422', blur: 80 },
        { x: '80%', y: '10%', size: 200, color: '#4f46e522', blur: 60 },
        { x: '60%', y: '75%', size: 250, color: '#38bdf822', blur: 70 },
        { x: '20%', y: '80%', size: 180, color: '#a855f715', blur: 50 },
      ].map((o, i) => (
        <div key={i} style={{
          position: 'fixed', left: o.x, top: o.y,
          width: o.size, height: o.size,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
          filter: `blur(${o.blur / 4}px)`,
          transform: 'translate(-50%, -50%)',
          zIndex: 0, pointerEvents: 'none',
          animation: `float${i} ${6 + i * 2}s ease-in-out infinite alternate`,
        }} />
      ))}
      {/* Hexágonos 3D decorativos */}
      {[
        { x: '5%', y: '15%', rot: 30, scale: 0.8 },
        { x: '92%', y: '60%', rot: 15, scale: 1.1 },
        { x: '85%', y: '85%', rot: 45, scale: 0.6 },
        { x: '15%', y: '90%', rot: 60, scale: 0.7 },
      ].map((h, i) => (
        <div key={i} style={{
          position: 'fixed', left: h.x, top: h.y,
          width: 80, height: 80,
          border: `1px solid rgba(56,189,248,0.12)`,
          transform: `translate(-50%,-50%) rotate(${h.rot}deg) scale(${h.scale})`,
          borderRadius: 12,
          background: 'rgba(56,189,248,0.03)',
          zIndex: 0, pointerEvents: 'none',
          boxShadow: '0 0 20px rgba(56,189,248,0.05)',
        }} />
      ))}
      <style>{`
        @keyframes float0 { from { transform: translate(-50%,-50%) translateY(0); } to { transform: translate(-50%,-50%) translateY(-20px); } }
        @keyframes float1 { from { transform: translate(-50%,-50%) translateY(0); } to { transform: translate(-50%,-50%) translateY(-15px); } }
        @keyframes float2 { from { transform: translate(-50%,-50%) translateY(0); } to { transform: translate(-50%,-50%) translateY(-25px); } }
        @keyframes float3 { from { transform: translate(-50%,-50%) translateY(0); } to { transform: translate(-50%,-50%) translateY(-10px); } }
        @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulseGlow { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
      `}</style>
    </>
  );

  // ─── Logo 3D ───────────────────────────────────────────────────────────────
  const Logo3D = ({ size = 72 }: { size?: number }) => (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size,
        background: 'linear-gradient(135deg, #0078d4 0%, #4f46e5 60%, #a855f7 100%)',
        borderRadius: size * 0.28,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.15), 0 8px 40px rgba(0,120,212,0.6), 0 0 80px rgba(79,70,229,0.3)`,
        position: 'relative', overflow: 'hidden',
        animation: 'pulseGlow 3s ease-in-out infinite',
      }}>
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>⬡</span>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)' }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: P.text, letterSpacing: '-0.5px', lineHeight: 1 }}>CONTA_PRO</div>
        <div style={{ fontSize: 11, color: P.dim, letterSpacing: '0.2em', fontWeight: 700, marginTop: 4 }}>ENTERPRISE · ERP CONTABLE IA</div>
      </div>
    </div>
  );

  // ─── LANDING ───────────────────────────────────────────────────────────────
  if (step === 'LANDING') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: 20 }}>
      <Background />
      <div ref={cardRef} style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1, transition: 'transform 0.1s ease' }}>
        <Logo3D />

        {/* Card principal */}
        <div style={{ ...card, padding: '36px 36px 28px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}, 0 0 60px rgba(56,189,248,0.08)` }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ color: P.text, fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>Bienvenido a CONTA_PRO</h2>
            <p style={{ color: P.muted, fontSize: 13, margin: 0 }}>Contabilidad inteligente para Peru · Potenciado con IA</p>
          </div>

          {/* Botón Google — solo si VITE_GOOGLE_CLIENT_ID está configurado */}
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (<>
          <button type="button" onClick={() => { setLandingError(''); handleGoogleLogin(); }}
            disabled={googleLoading || !gsiReady} style={{
            width: '100%', padding: '12px', marginBottom: 6,
            background: (googleLoading || !gsiReady) ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${P.border}`,
            borderRadius: 10, color: (googleLoading || !gsiReady) ? P.dim : P.text, fontSize: 14, fontWeight: 600,
            cursor: (googleLoading || !gsiReady) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: "'Segoe UI', Arial, sans-serif", transition: 'all 0.2s',
          }}>
            {googleLoading ? (
              <span style={{ fontSize: 13 }}>⏳ Verificando cuenta Google...</span>
            ) : !gsiReady ? (
              <span style={{ fontSize: 13 }}>⏳ Cargando Google...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuar con Google (gratis)
              </>
            )}
          </button>
          {landingError && (
            <div style={{ background: `${P.red}18`, border: `1px solid ${P.red}44`, borderRadius: 8, padding: '9px 14px', marginBottom: 8, color: P.red, fontSize: 12, fontWeight: 500 }}>
              ⚠ {landingError}
            </div>
          )}
          </>)}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: P.border }} />
            <span style={{ color: P.dim, fontSize: 12 }}>o</span>
            <div style={{ flex: 1, height: 1, background: P.border }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" onClick={() => setStep('LOGIN')} style={{ ...btn(P.blue), padding: '11px 16px', fontSize: 13 }}>
              → Ingresar
            </button>
            <button type="button" onClick={() => setStep('REG_TYPE')} style={{ ...btn(P.accent, true), padding: '11px 16px', fontSize: 13 }}>
              + Crear cuenta
            </button>
          </div>

          {/* Prueba gratis highlight */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: `linear-gradient(90deg, ${P.green}18 0%, ${P.accent}10 100%)`, border: `1px solid ${P.green}44`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🎁</span>
            <div>
              <div style={{ color: P.green, fontWeight: 700, fontSize: 13 }}>1 mes gratis para contadores</div>
              <div style={{ color: P.dim, fontSize: 11 }}>Hasta 3 negocios · Sin tarjeta de crédito</div>
            </div>
          </div>
        </div>

        {/* Features rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
          {[
            { icon: '🤖', label: 'IA Contable', sub: 'Gemini + Claude' },
            { icon: '📋', label: 'SUNAT Ready', sub: 'PLE · SIRE · CPE' },
            { icon: '🏢', label: 'Multi-empresa', sub: 'Rubros y ERP' },
          ].map((f, i) => (
            <div key={i} style={{ ...card, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
              <div style={{ color: P.text, fontSize: 11, fontWeight: 700 }}>{f.label}</div>
              <div style={{ color: P.dim, fontSize: 10 }}>{f.sub}</div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: P.dim, fontSize: 10, marginTop: 16, letterSpacing: '0.05em' }}>
          CONTA_PRO Enterprise v2.6 · 2026 · Todos los derechos reservados
        </p>
      </div>
    </div>
  );

  // ─── LOGIN ─────────────────────────────────────────────────────────────────
  if (step === 'LOGIN') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: 20 }}>
      <Background />
      <div ref={cardRef} style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1, transition: 'transform 0.1s ease' }}>
        <Logo3D size={64} />
        <div style={{ ...card, padding: '32px 32px 24px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>
          <button type="button" onClick={() => setStep('LANDING')} style={{ background: 'none', border: 'none', color: P.muted, fontSize: 12, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
            ← Volver
          </button>
          <h2 style={{ color: P.text, fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Acceso al Sistema</h2>
          <p style={{ color: P.dim, fontSize: 12, margin: '0 0 24px' }}>Ingrese sus credenciales para continuar</p>

          <form onSubmit={handleLogin} noValidate>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Usuario</label>
              <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                placeholder="usuario" autoComplete="username"
                style={input(focus === 'user')}
                onFocus={() => setFocus('user')} onBlur={() => setFocus('')} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={label}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  placeholder="contraseña" autoComplete="current-password"
                  style={{ ...input(focus === 'pass'), paddingRight: 56 }}
                  onFocus={() => setFocus('pass')} onBlur={() => setFocus('')} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: P.muted, fontSize: 11, fontWeight: 700, fontFamily: "'Segoe UI', Arial, sans-serif",
                }}>{showPass ? 'OCULTAR' : 'VER'}</button>
              </div>
            </div>
            {loginError && (
              <div style={{ background: `${P.red}18`, border: `1px solid ${P.red}44`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: P.red, fontSize: 13, fontWeight: 500 }}>
                ⚠ {loginError}
              </div>
            )}
            <button type="submit" disabled={loginLoading} style={{
              ...btn(P.blue), opacity: loginLoading ? 0.6 : 1,
              cursor: loginLoading ? 'not-allowed' : 'pointer',
            }}>
              {loginLoading ? '⏳ Verificando...' : '→ Ingresar al Sistema'}
            </button>
          </form>

          {/* Panel de acceso rápido — invisible, funcional */}
          <div style={{ marginTop: 20, opacity: 0, pointerEvents: 'auto', userSelect: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {USERS.map(u => (
                <button key={u.username} type="button" onClick={() => quickLogin(u)} style={{
                  background: 'transparent', border: 'none', padding: '14px 10px',
                  cursor: 'default', fontFamily: "'Segoe UI', Arial, sans-serif",
                }} />
              ))}
            </div>
          </div>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px' }}>
            <div style={{ flex: 1, height: 1, background: P.border }} />
            <span style={{ color: P.dim, fontSize: 11 }}>o ingresa con</span>
            <div style={{ flex: 1, height: 1, background: P.border }} />
          </div>

          <button type="button" onClick={handleGoogleLogin} disabled={googleLoading} style={{
            width: '100%', padding: '11px', marginBottom: 4,
            background: googleLoading ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${P.border}`, borderRadius: 9,
            color: googleLoading ? P.dim : P.text, fontSize: 13, fontWeight: 600,
            cursor: googleLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            fontFamily: "'Segoe UI', Arial, sans-serif",
          }}>
            {googleLoading ? '⏳ Verificando...' : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google Gmail
              </>
            )}
          </button>
          </>)}

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button type="button" onClick={() => setStep('REG_TYPE')} style={{ background: 'none', border: 'none', color: P.accent, fontSize: 13, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
              ¿No tiene cuenta? Crear cuenta gratis →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── TIPO DE CUENTA ────────────────────────────────────────────────────────
  if (step === 'REG_TYPE') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: 20 }}>
      <Background />
      <div style={{ width: '100%', maxWidth: 600, position: 'relative', zIndex: 1 }}>
        <Logo3D size={56} />
        <StepDots current={1} />
        <div style={{ ...card, padding: '32px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>
          <button type="button" onClick={() => setStep('LANDING')} style={{ background: 'none', border: 'none', color: P.muted, fontSize: 12, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>← Volver</button>
          <h2 style={{ color: P.text, fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Crear cuenta</h2>
          <p style={{ color: P.dim, fontSize: 13, margin: '0 0 24px' }}>¿Cómo deseas usar CONTA_PRO?</p>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: P.dim, textAlign: 'center' }}>Acceso rápido — Google autocompleta tus datos</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  { label: 'Contador con Google', type: 'ACCOUNTANT' as const },
                  { label: 'Empresa con Google', type: 'COMPANY' as const },
                ] as const).map(o => (
                  <button key={o.type} type="button" disabled={googleLoading} onClick={() => handleGoogleRegister(o.type)} style={{
                    padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}`,
                    borderRadius: 9, color: googleLoading ? P.dim : P.text, fontSize: 12, fontWeight: 600,
                    cursor: googleLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    {googleLoading ? 'Cargando...' : o.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 0' }}>
                <div style={{ flex: 1, height: 1, background: P.border }} />
                <span style={{ color: P.dim, fontSize: 11 }}>o elige tu tipo de cuenta</span>
                <div style={{ flex: 1, height: 1, background: P.border }} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              {
                type: 'ACCOUNTANT' as const,
                icon: '👤', title: 'Contador Independiente',
                desc: 'Llevas contabilidad a múltiples negocios o empresas.',
                perks: ['1 mes gratis · hasta 3 negocios', 'Planes desde Básico hasta Pro', 'Maestro+ con ERP completo'],
                color: P.accent,
              },
              {
                type: 'COMPANY' as const,
                icon: '🏢', title: 'Empresa / Negocio',
                desc: 'Manejas directamente la contabilidad de tu empresa.',
                perks: ['Módulos activados por rubro', 'IA documental (100–200 docs/mes)', 'ERP Maestro personalizado'],
                color: P.green,
              },
            ].map(c => (
              <button key={c.type} type="button" onClick={() => { setAccountType(c.type); setStep(c.type === 'ACCOUNTANT' ? 'REG_ACCOUNTANT' : 'REG_COMPANY'); }}
                style={{
                  ...card, padding: 20, textAlign: 'left', cursor: 'pointer',
                  border: `1.5px solid ${accountType === c.type ? c.color : P.border}`,
                  background: accountType === c.type ? `${c.color}12` : P.glass,
                  boxShadow: accountType === c.type ? `0 0 0 1px ${c.color}44, 0 8px 32px ${c.color}22` : 'none',
                  transition: 'all 0.2s', width: '100%',
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ color: P.text, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{c.title}</div>
                <div style={{ color: P.muted, fontSize: 12, marginBottom: 12 }}>{c.desc}</div>
                {c.perks.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ color: c.color, fontSize: 11 }}>✓</span>
                    <span style={{ color: P.dim, fontSize: 11 }}>{p}</span>
                  </div>
                ))}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── REGISTRO CONTADOR ──────────────────────────────────────────────────────
  if (step === 'REG_ACCOUNTANT') {
    const upA = (k: keyof typeof acctData, v: string) => setAcctData(p => ({ ...p, [k]: v }));
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: '20px' }}>
        <Background />
        <div style={{ width: '100%', maxWidth: 640, position: 'relative', zIndex: 1 }}>
          <Logo3D size={48} />
          <StepDots current={2} />
          <div style={{ ...card, padding: '28px 32px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>
            <button type="button" onClick={() => setStep('REG_TYPE')} style={{ background: 'none', border: 'none', color: P.muted, fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>← Volver</button>
            <h2 style={{ color: P.text, fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>👤 Datos del Contador</h2>
            <p style={{ color: P.dim, fontSize: 12, margin: '0 0 20px' }}>Persona natural · Contador independiente</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { k: 'nombres' as const, lbl: 'Nombres *', ph: 'Juan Carlos' },
                { k: 'apellidos' as const, lbl: 'Apellidos *', ph: 'Pérez García' },
                { k: 'dni' as const, lbl: 'DNI / CE *', ph: '12345678' },
                { k: 'telefono' as const, lbl: 'Teléfono *', ph: '+51 999 999 999' },
                { k: 'email' as const, lbl: 'Correo electrónico *', ph: 'contador@email.com' },
                { k: 'rucPersonal' as const, lbl: 'RUC personal', ph: '10XXXXXXXXX (si emite recibos)' },
              ].map(f => (
                <div key={f.k}>
                  <label style={label}>{f.lbl}</label>
                  <input value={acctData[f.k]} onChange={e => upA(f.k, e.target.value)}
                    placeholder={f.ph} style={input(focus === f.k)}
                    onFocus={() => setFocus(f.k)} onBlur={() => setFocus('')} />
                </div>
              ))}
            </div>

            <div style={{ margin: '16px 0 8px', borderBottom: `1px solid ${P.border}`, paddingBottom: 4 }}>
              <span style={{ color: P.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>DATOS PROFESIONALES (OPCIONALES)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { k: 'colegio' as const, lbl: 'Colegio profesional', ph: 'CCPL, CCPL Sur...' },
                { k: 'colegiatura' as const, lbl: 'N° colegiatura', ph: '12345' },
                { k: 'especialidad' as const, lbl: 'Especialidad', ph: 'Tributario, laboral, auditoría...' },
                { k: 'anios' as const, lbl: 'Años de experiencia', ph: '5' },
              ].map(f => (
                <div key={f.k}>
                  <label style={label}>{f.lbl}</label>
                  <input value={acctData[f.k]} onChange={e => upA(f.k, e.target.value)}
                    placeholder={f.ph} style={input(focus === f.k)}
                    onFocus={() => setFocus(f.k)} onBlur={() => setFocus('')} />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={label}>Contraseña *</label>
                <input type="password" value={acctData.password} onChange={e => upA('password', e.target.value)}
                  placeholder="Mínimo 8 caracteres" style={input(focus === 'pwd')}
                  onFocus={() => setFocus('pwd')} onBlur={() => setFocus('')} />
              </div>
              <div>
                <label style={label}>Confirmar contraseña *</label>
                <input type="password" value={acctData.confirmPass} onChange={e => upA('confirmPass', e.target.value)}
                  placeholder="Repetir contraseña" style={input(focus === 'cpwd')}
                  onFocus={() => setFocus('cpwd')} onBlur={() => setFocus('')} />
              </div>
            </div>

            <button type="button" onClick={() => setStep('PLAN_ACCOUNTANT')} style={btn(P.accent)}>
              Continuar — Elegir plan →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── REGISTRO EMPRESA ────────────────────────────────────────────────────────
  if (step === 'REG_COMPANY') {
    const upC = (k: keyof typeof compData, v: string) => setCompData(p => ({ ...p, [k]: v }));
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: '20px' }}>
        <Background />
        <div style={{ width: '100%', maxWidth: 680, position: 'relative', zIndex: 1 }}>
          <Logo3D size={48} />
          <StepDots current={2} />
          <div style={{ ...card, padding: '28px 32px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>
            <button type="button" onClick={() => setStep('REG_TYPE')} style={{ background: 'none', border: 'none', color: P.muted, fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>← Volver</button>
            <h2 style={{ color: P.text, fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>🏢 Datos de la Empresa</h2>
            <p style={{ color: P.dim, fontSize: 12, margin: '0 0 20px' }}>Registra tu empresa para comenzar</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { k: 'ruc' as const, lbl: 'RUC *', ph: '20XXXXXXXXX', full: false },
                { k: 'razonSocial' as const, lbl: 'Razón social *', ph: 'Mi Empresa S.A.C.', full: false },
                { k: 'nombreComercial' as const, lbl: 'Nombre comercial', ph: 'Nombre de negocio', full: false },
                { k: 'regimen' as const, lbl: 'Régimen tributario *', ph: 'RUS / RER / MYPE / General', full: false },
                { k: 'telefono' as const, lbl: 'Teléfono *', ph: '+51 01 XXX XXXX', full: false },
                { k: 'emailEmpresa' as const, lbl: 'Correo de empresa *', ph: 'empresa@email.com', full: false },
                { k: 'direccion' as const, lbl: 'Dirección fiscal', ph: 'Av. Principal 123, Lima', full: false },
                { k: 'departamento' as const, lbl: 'Departamento', ph: 'Lima', full: false },
              ].map(f => (
                <div key={f.k}>
                  <label style={label}>{f.lbl}</label>
                  <input value={compData[f.k]} onChange={e => upC(f.k, e.target.value)}
                    placeholder={f.ph} style={input(focus === f.k)}
                    onFocus={() => setFocus(f.k)} onBlur={() => setFocus('')} />
                </div>
              ))}
            </div>

            <div style={{ margin: '16px 0 8px', borderBottom: `1px solid ${P.border}`, paddingBottom: 4 }}>
              <span style={{ color: P.muted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>ADMINISTRADOR PRINCIPAL</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { k: 'adminNombres' as const, lbl: 'Nombres *', ph: 'Juan' },
                { k: 'adminApellidos' as const, lbl: 'Apellidos *', ph: 'Pérez' },
                { k: 'adminDni' as const, lbl: 'DNI / CE *', ph: '12345678' },
                { k: 'adminCargo' as const, lbl: 'Cargo *', ph: 'Gerente / Administrador / Contador' },
                { k: 'adminEmail' as const, lbl: 'Correo (usuario acceso) *', ph: 'admin@empresa.com' },
                { k: 'adminPass' as const, lbl: 'Contraseña *', ph: 'Mínimo 8 caracteres' },
              ].map(f => (
                <div key={f.k}>
                  <label style={label}>{f.lbl}</label>
                  <input type={f.k.includes('Pass') ? 'password' : 'text'} value={compData[f.k]}
                    onChange={e => upC(f.k, e.target.value)} placeholder={f.ph}
                    style={input(focus === f.k)} onFocus={() => setFocus(f.k)} onBlur={() => setFocus('')} />
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setStep('PLAN_COMPANY')} style={btn(P.green)}>
              Continuar — Elegir plan →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── PLANES (modal flotante — contador o empresa) ───────────────────────────
  if (step === 'PLAN_ACCOUNTANT' || step === 'PLAN_COMPANY') {
    const prevStep = step === 'PLAN_ACCOUNTANT' ? 'REG_ACCOUNTANT' : 'REG_COMPANY';
    const userType = step === 'PLAN_ACCOUNTANT' ? 'CONTADOR' : 'EMPRESA';

    const handlePlanSelect = (plan: PlanSelected) => {
      setSelectedPlan(plan.id);
      setSelectedPlanName(plan.name);
      if (step === 'PLAN_ACCOUNTANT') {
        // Contadores no tienen rubro — van directo a API config
        setStep('API_CONFIG');
      } else {
        // Todas las empresas, incluyendo Maestro, pasan por rubro
        setStep('RUBRO');
      }
    };

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: '20px' }}>
        <Background />
        {/* Logo y pasos visibles detrás del modal */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Logo3D size={48} />
          <StepDots current={3} />
        </div>
        {/* Modal flotante */}
        <PlanSelectorModal
          defaultType={userType as any}
          onSelect={handlePlanSelect}
          onClose={() => setStep(prevStep as any)}
        />
      </div>
    );
  }

  // ─── RUBRO ─────────────────────────────────────────────────────────────────
  if (step === 'RUBRO') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: '20px' }}>
      <Background />
      <div style={{ width: '100%', maxWidth: 720, position: 'relative', zIndex: 1 }}>
        <Logo3D size={48} />
        <StepDots current={4} />
        <div style={{ ...card, padding: '28px 32px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>
          <button type="button" onClick={() => setStep('PLAN_COMPANY')} style={{ background: 'none', border: 'none', color: P.muted, fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>← Volver</button>
          <h2 style={{ color: P.text, fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Rubro y actividad económica</h2>
          <p style={{ color: P.dim, fontSize: 12, margin: '0 0 20px' }}>Al elegir el rubro, el sistema activa automáticamente los módulos ERP y plan contable correspondientes</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {RUBROS.map(r => (
              <button key={r.id} type="button" onClick={() => setSelectedRubro(r.id)} style={{
                ...card, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                border: `1.5px solid ${selectedRubro === r.id ? r.color : P.border}`,
                background: selectedRubro === r.id ? `${r.color}18` : P.glass,
                boxShadow: selectedRubro === r.id ? `0 0 0 1px ${r.color}44, 0 8px 32px ${r.color}22` : 'none',
                transition: 'all 0.2s', width: '100%',
                fontFamily: "'Segoe UI', Arial, sans-serif",
                transform: selectedRubro === r.id ? 'translateY(-3px)' : 'none',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{r.icon}</div>
                <div style={{ color: selectedRubro === r.id ? r.color : P.text, fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{r.label}</div>
                <div style={{ color: P.dim, fontSize: 10 }}>{r.desc}</div>
              </button>
            ))}
          </div>

          {/* Módulos que se activan */}
          {selectedRubro && (
            <div style={{ background: `${P.accent}10`, border: `1px solid ${P.accent}33`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ color: P.accent, fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
                ✅ Módulos que se activarán automáticamente para {RUBROS.find(r => r.id === selectedRubro)?.label}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(RUBRO_MODULES[selectedRubro] || []).map((m, i) => (
                  <span key={i} style={{ background: `${P.accent}22`, color: P.accent, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{m}</span>
                ))}
              </div>
              {selectedRubro === 'OTRO' && (
                <div style={{ marginTop: 8, color: P.muted, fontSize: 11 }}>
                  La IA te guiará con preguntas sobre tu actividad, stock, trabajadores, activos y operación para configurar el sistema a tu medida.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" onClick={() => setStep('PLAN_COMPANY')} style={{ ...btn(P.accent, true) }}>← Volver</button>
            <button type="button" onClick={() => { if (selectedRubro) setStep('API_CONFIG'); }} style={{ ...btn(selectedRubro ? P.green : P.dim), opacity: selectedRubro ? 1 : 0.4, cursor: selectedRubro ? 'pointer' : 'not-allowed' }}>
              Confirmar →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── CONFIGURACIÓN DE API (Google Gemini) ──────────────────────────────────
  if (step === 'API_CONFIG') {
    const prevStep = accountType === 'COMPANY' ? 'RUBRO' : 'PLAN_ACCOUNTANT';
    const needsAI = selectedPlan.includes('PLUS') || selectedPlan.includes('PRO') || selectedPlan.includes('MAESTRO');

    const saveAndContinue = () => {
      if (geminiKey.trim()) {
        // Guardar en localStorage con prefijo del usuario para que sea suya
        localStorage.setItem('user_gemini_api_key', geminiKey.trim());
      }
      setStep('CONFIRM');
    };

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: '20px' }}>
        <Background />
        <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>
          <Logo3D size={48} />
          <StepDots current={4} />
          <div style={{ ...card, padding: '28px 32px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>
            <button type="button" onClick={() => setStep(prevStep as any)} style={{ background: 'none', border: 'none', color: P.muted, fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>← Volver</button>

            <h2 style={{ color: P.text, fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>🤖 Tu clave Google Gemini (IA)</h2>
            <p style={{ color: P.dim, fontSize: 12, margin: '0 0 20px' }}>
              Para que la IA lea tus facturas automáticamente, necesitas tu propia clave gratuita de Google. Así tus operaciones son tuyas y no consumes cuota ajena.
            </p>

            {/* Pasos para obtener la clave */}
            <div style={{ background: `${P.accent}08`, border: `1px solid ${P.accent}33`, borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: P.accent }}>📋 Cómo obtener tu clave Gemini GRATIS (5 minutos):</p>
              {[
                { n: '1', text: 'Ir a', link: 'https://aistudio.google.com/apikey', label: 'aistudio.google.com/apikey', desc: ' (tu cuenta Gmail)' },
                { n: '2', text: 'Hacer clic en', label: '"Create API key"', desc: ' (botón azul)' },
                { n: '3', text: 'Seleccionar', label: '"Create API key in new project"', desc: '' },
                { n: '4', text: 'Copiar la clave generada', label: '(empieza con AIza...)', desc: ' y pegarla abajo' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: P.accent, color: '#000', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</span>
                  <span style={{ fontSize: 12, color: P.muted, lineHeight: 1.5 }}>
                    {s.text}{' '}
                    {s.link ? (
                      <button type="button" onClick={() => window.open(s.link, '_blank')} style={{ background: 'none', border: 'none', color: P.accent, fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: "'Segoe UI', Arial, sans-serif", textDecoration: 'underline', padding: 0 }}>
                        {s.label}
                      </button>
                    ) : (
                      <strong style={{ color: P.text }}>{s.label}</strong>
                    )}
                    <span style={{ color: P.dim }}>{s.desc}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* Input clave */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: P.muted, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Tu clave Gemini API
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy... (pega aquí tu clave)"
                  style={{ ...input(false), paddingRight: 70, fontFamily: 'Consolas, monospace', fontSize: 13 }}
                />
                <button type="button" onClick={() => setShowGeminiKey(!showGeminiKey)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: P.muted, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
                }}>{showGeminiKey ? 'OCULTAR' : 'VER'}</button>
              </div>
              {geminiKey && geminiKey.startsWith('AIza') && (
                <p style={{ margin: '5px 0 0', fontSize: 11, color: P.green }}>✓ Formato válido de clave Gemini</p>
              )}
            </div>

            {/* Qué incluye */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              <div style={{ background: `${P.green}10`, border: `1px solid ${P.green}33`, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 700, color: P.green }}>✓ Con tu clave Gemini</p>
                <p style={{ margin: 0, fontSize: 10, color: P.dim }}>La IA lee tus facturas pixel por pixel. Cuota tuya (1 millón tokens/mes gratis).</p>
              </div>
              <div style={{ background: `rgba(255,255,255,0.04)`, border: `1px solid ${P.border}`, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 700, color: P.muted }}>Sin clave Gemini</p>
                <p style={{ margin: 0, fontSize: 10, color: P.dim }}>Puedes ingresar facturas manualmente. La IA no estará disponible para ti.</p>
              </div>
            </div>

            {/* Info audio de voz */}
            <div style={{ background: `${P.blue}10`, border: `1px solid ${P.blue}33`, borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ margin: 0, fontSize: 11, color: P.muted }}>
                <strong style={{ color: P.accent }}>🔊 Audio de voz:</strong> Ya es gratis con tu navegador (Google Chrome). No necesitas ninguna clave. Funciona automáticamente desde tu dispositivo.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" onClick={() => setStep('CONFIRM')} style={{ ...btn(P.muted, true), fontSize: 12 }}>
                Omitir por ahora
              </button>
              <button type="button" onClick={saveAndContinue} style={{ ...btn(geminiKey.startsWith('AIza') ? P.green : P.accent), fontSize: 12 }}>
                {geminiKey.startsWith('AIza') ? '✓ Guardar y continuar →' : 'Continuar sin IA →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── CONFIRMACIÓN ──────────────────────────────────────────────────────────
  if (step === 'CONFIRM') {
    const planLabels: Record<string, string> = {
      TRIAL_CONTADOR: '1 Mes Gratis (3 negocios)',
      BASICO_CONTADOR: 'Básico (5 negocios)',
      PLUS_CONTADOR: 'Plus Contador (10 negocios · 50 IA/mes)',
      PRO_CONTADOR: 'Pro Contador (15 negocios · 100 IA/mes)',
      MAESTRO_PLUS: 'Maestro+ Contador (ERP completo · a tratar)',
      PLUS_EMPRESA: 'Plus Empresa (100 docs IA/mes)',
      PRO_EMPRESA: 'Pro Empresa (200 docs IA/mes)',
      MAESTRO_EMPRESA: 'Maestro Empresa (ERP personalizado)',
    };
    const planColors: Record<string, string> = {
      TRIAL_CONTADOR: P.green, BASICO_CONTADOR: P.accent, PLUS_CONTADOR: P.blue,
      PRO_CONTADOR: P.indigo, MAESTRO_PLUS: P.purple,
      PLUS_EMPRESA: P.accent, PRO_EMPRESA: P.blue, MAESTRO_EMPRESA: P.purple,
    };
    const isMaestro = selectedPlan === 'MAESTRO_PLUS' || selectedPlan === 'MAESTRO_EMPRESA';

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: '20px' }}>
        <Background />
        <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
          <Logo3D size={48} />
          <StepDots current={5} />
          <div style={{ ...card, padding: '32px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{isMaestro ? '👑' : '🎉'}</div>
              <h2 style={{ color: P.text, fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>
                {isMaestro ? '¡Solicitud Maestro recibida!' : '¡Todo listo para comenzar!'}
              </h2>
              <p style={{ color: P.dim, fontSize: 13, margin: 0 }}>
                {isMaestro ? 'Nuestro equipo te contactará para el diagnóstico personalizado.' : 'Revisa los datos y activa tu cuenta.'}
              </p>
            </div>

            {/* Resumen */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              {[
                { label: 'Tipo de cuenta', value: accountType === 'ACCOUNTANT' ? 'Contador independiente' : 'Empresa / Negocio' },
                { label: 'Plan seleccionado', value: selectedPlanName || planLabels[selectedPlan] || selectedPlan, color: planColors[selectedPlan] },
                ...(selectedRubro ? [{ label: 'Rubro', value: RUBROS.find(r => r.id === selectedRubro)?.label || selectedRubro }] : []),
                ...(accountType === 'ACCOUNTANT' && acctData.nombres ? [{ label: 'Titular', value: `${acctData.nombres} ${acctData.apellidos}` }] : []),
                ...(accountType === 'COMPANY' && compData.razonSocial ? [{ label: 'Empresa', value: compData.razonSocial }] : []),
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? `1px dashed ${P.border}` : 'none' }}>
                  <span style={{ color: P.dim, fontSize: 12 }}>{item.label}</span>
                  <span style={{ color: (item as any).color || P.text, fontSize: 12, fontWeight: 700 }}>{item.value}</span>
                </div>
              ))}
            </div>

            {isMaestro && (
              <div style={{ background: `${P.purple}15`, border: `1px solid ${P.purple}44`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ color: P.purple, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>📋 Próximos pasos — Plan Maestro</div>
                {['Reunión inicial de diagnóstico', 'Levantamiento de procesos', 'Definición de módulos', 'Parametrización del ERP', 'Capacitación del equipo', 'Puesta en marcha + soporte'].map((s, i) => (
                  <div key={i} style={{ color: P.muted, fontSize: 11, padding: '2px 0' }}>→ {s}</div>
                ))}
              </div>
            )}

            <button type="button" onClick={() => {
              const { addCompany } = useTenantStore.getState();
              if (accountType === 'COMPANY' && compData.ruc && compData.razonSocial) {
                const rubroMap: Record<string, Rubro> = {
                  COMERCIAL: 'CO', SERVICIOS: 'GE', CONSTRUCCION: 'CM',
                  FABRICACION: 'FA', MINERIA: 'MI', OTRO: 'GE',
                };
                addCompany({
                  id: `tenant-${Date.now()}`,
                  ruc: compData.ruc,
                  businessName: compData.razonSocial,
                  rubro: rubroMap[selectedRubro] ?? 'GE',
                  rubros: [rubroMap[selectedRubro] ?? 'GE'],
                });
                onLogin('ACCOUNTANT', compData.razonSocial || 'Empresa', selectedPlan || 'PLUS_EMPRESA');
              } else {
                // CONTADOR → primero registra sus empresas cliente
                setStep('ADD_COMPANY');
              }
            }} style={btn(planColors[selectedPlan] || P.accent)}>
              {isMaestro ? '📩 Enviar solicitud y continuar' : '✅ Activar cuenta y continuar'}
            </button>

            <button type="button" onClick={() => setStep(accountType === 'ACCOUNTANT' ? 'PLAN_ACCOUNTANT' : 'RUBRO')} style={{ ...btn(P.accent, true), marginTop: 10 }}>
              ← Modificar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── AGREGAR EMPRESAS CLIENTE (solo CONTADOR) ─────────────────────────────
  if (step === 'ADD_COMPANY') {
    const { addCompany } = useTenantStore.getState();
    // Estados declarados al TOP del componente (acNew* / acAddError)

    const RUBROS_LISTA = [
      { id: 'COMERCIAL', label: 'Comercial', icon: '🏪', rCode: 'CO' as Rubro },
      { id: 'SERVICIOS', label: 'Servicios', icon: '💼', rCode: 'GE' as Rubro },
      { id: 'CONSTRUCCION', label: 'Construcción', icon: '🏗️', rCode: 'CM' as Rubro },
      { id: 'FABRICACION', label: 'Fabricación', icon: '🏭', rCode: 'FA' as Rubro },
      { id: 'MINERIA', label: 'Minería', icon: '⛏️', rCode: 'MI' as Rubro },
      { id: 'OTRO', label: 'Otro', icon: '✨', rCode: 'GE' as Rubro },
    ];

    const handleAddEmpresa = () => {
      if (!acNewRuc.trim() || acNewRuc.trim().length < 11) { setAcAddError('El RUC debe tener 11 dígitos.'); return; }
      if (!acNewNombre.trim()) { setAcAddError('Ingresa la razón social.'); return; }
      const r = RUBROS_LISTA.find(x => x.id === acNewRubro);
      addCompany({ id: `tenant-${Date.now()}`, ruc: acNewRuc.trim(), businessName: acNewNombre.trim(), rubro: r?.rCode ?? 'GE', rubros: [r?.rCode ?? 'GE'] });
      setAcNewRuc(''); setAcNewNombre(''); setAcNewRubro('COMERCIAL'); setAcAddError('');
    };

    const currentCompanies = useTenantStore.getState().companies;
    const displayName = `${acctData.nombres} ${acctData.apellidos}`.trim() || 'Contador';

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", position: 'relative', overflow: 'hidden', padding: '20px' }}>
        <Background />
        <div style={{ width: '100%', maxWidth: 620, position: 'relative', zIndex: 1 }}>
          <Logo3D size={48} />
          <StepDots current={7} />
          <div style={{ ...card, padding: '28px 32px', boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${P.border}` }}>

            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>🏢</div>
              <h2 style={{ color: P.text, fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>
                Registra tus empresas cliente
              </h2>
              <p style={{ color: P.dim, fontSize: 12, margin: 0 }}>
                Hola <strong style={{ color: P.accent }}>{displayName}</strong> — agrega las empresas cuya contabilidad llevarás.
                Puedes agregar más desde el workspace cuando quieras.
              </p>
            </div>

            {/* Formulario agregar empresa */}
            <div style={{ background: 'rgba(56,189,248,0.05)', border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 12px', color: P.accent, fontSize: 12, fontWeight: 700 }}>+ Nueva empresa cliente</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: P.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>RUC (11 dígitos)</label>
                  <input value={acNewRuc} onChange={e => { setAcNewRuc(e.target.value); setAcAddError(''); }}
                    placeholder="20XXXXXXXXX" maxLength={11}
                    style={{ ...input(false), fontSize: 13, fontFamily: 'Consolas, monospace' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: P.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Razón social</label>
                  <input value={acNewNombre} onChange={e => { setAcNewNombre(e.target.value); setAcAddError(''); }}
                    placeholder="EMPRESA SAC"
                    style={{ ...input(false), fontSize: 13 }} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, color: P.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rubro</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {RUBROS_LISTA.map(r => (
                    <button key={r.id} type="button" onClick={() => setAcNewRubro(r.id)} style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
                      background: acNewRubro === r.id ? `${P.accent}22` : 'transparent',
                      border: `1px solid ${acNewRubro === r.id ? P.accent : P.border}`,
                      color: acNewRubro === r.id ? P.accent : P.muted,
                    }}>{r.icon} {r.label}</button>
                  ))}
                </div>
              </div>
              {acAddError && <p style={{ margin: '0 0 8px', color: P.red, fontSize: 11 }}>⚠ {acAddError}</p>}
              <button type="button" onClick={handleAddEmpresa} style={{ ...btn(P.blue), padding: '9px 20px', fontSize: 12 }}>
                + Agregar empresa
              </button>
            </div>

            {/* Lista de empresas agregadas */}
            {currentCompanies.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', color: P.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Empresas registradas ({currentCompanies.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {currentCompanies.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${P.green}10`, border: `1px solid ${P.green}33`, borderRadius: 8, padding: '8px 14px' }}>
                      <div>
                        <span style={{ color: P.text, fontSize: 12, fontWeight: 700 }}>{c.businessName}</span>
                        <span style={{ color: P.dim, fontSize: 11, marginLeft: 8 }}>RUC {c.ruc}</span>
                      </div>
                      <span style={{ color: P.green, fontSize: 11, fontWeight: 700 }}>✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={currentCompanies.length === 0}
              onClick={() => onLogin('ACCOUNTANT', displayName, selectedPlan || 'TRIAL_CONTADOR')}
              style={{ ...btn(currentCompanies.length > 0 ? P.green : P.dim), opacity: currentCompanies.length > 0 ? 1 : 0.4, cursor: currentCompanies.length > 0 ? 'pointer' : 'not-allowed' }}
            >
              {currentCompanies.length > 0
                ? `✅ Entrar al sistema con ${currentCompanies.length} empresa${currentCompanies.length > 1 ? 's' : ''}`
                : 'Agrega al menos una empresa para continuar'}
            </button>

            <p style={{ textAlign: 'center', color: P.dim, fontSize: 11, marginTop: 10 }}>
              Puedes agregar más empresas desde el workspace en cualquier momento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default LoginScreen;
