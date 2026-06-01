/**
 * ApiConfigPanel — Configuración de claves API propias del usuario
 * Cada usuario gestiona sus propias claves: Gemini (IA facturas) y Google OAuth
 * Las claves se guardan en localStorage (solo en el navegador del usuario)
 */
import React, { useEffect, useState } from 'react';

const C = {
  bg: '#020812', bgCard: '#080f1f', bgRow: '#0b1525',
  border: '#1a3050', text: '#e2eaf8', muted: '#6e93b8',
  dim: '#3d6080', accent: '#38bdf8', blue: '#0078d4',
  green: '#22c55e', yellow: '#f59e0b', red: '#ef4444', purple: '#a855f7',
};

const inp = (focused: boolean): React.CSSProperties => ({
  width: '100%', padding: '10px 14px',
  background: focused ? 'rgba(56,189,248,0.06)' : 'rgba(5,13,26,0.7)',
  border: `1.5px solid ${focused ? C.accent : C.border}`,
  borderRadius: 8, color: C.text, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Consolas, monospace',
  transition: 'all 0.15s',
});

const Section = ({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) => (
  <div style={{ background: C.bgCard, border: `1px solid ${color}33`, borderTop: `3px solid ${color}`, borderRadius: 12, padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{title}</h3>
    </div>
    {children}
  </div>
);

export const ApiConfigPanel: React.FC = () => {
  const [gemini, setGemini] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [focusGemini, setFocusGemini] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setGemini(localStorage.getItem('user_gemini_api_key') || '');
  }, []);

  const saveKeys = () => {
    if (gemini.trim()) localStorage.setItem('user_gemini_api_key', gemini.trim());
    else localStorage.removeItem('user_gemini_api_key');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const testGemini = async () => {
    const key = gemini.trim();
    if (!key) { setTestResult('❌ Ingresa una clave primero.'); return; }
    setTesting(true); setTestResult('Probando conexión con Gemini...');
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      );
      if (res.ok) {
        setTestResult('✅ Clave válida. Gemini responde correctamente. La IA de facturas funcionará con tu cuenta.');
      } else {
        const err = await res.json().catch(() => ({}));
        setTestResult(`❌ Error: ${err?.error?.message || `HTTP ${res.status} — clave inválida o sin permisos.`}`);
      }
    } catch {
      setTestResult('❌ No se pudo conectar. Verifica tu conexión a internet.');
    } finally { setTesting(false); }
  };

  const clearKey = () => {
    setGemini('');
    localStorage.removeItem('user_gemini_api_key');
    setTestResult('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const geminiValid = gemini.startsWith('AIza') && gemini.length > 20;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.bg, color: C.text, fontFamily: "'Segoe UI', Arial, sans-serif", padding: '18px 20px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 900, color: C.text }}>⚙️ Configuración de tus claves API</h1>
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
          Cada usuario tiene sus propias claves. Así tus operaciones de IA son independientes y no consumes cuota del sistema.
          Las claves se guardan solo en <strong style={{ color: C.accent }}>tu navegador</strong> (localStorage).
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ─── GEMINI ─── */}
        <Section title="Google Gemini API — IA para leer facturas" icon="🤖" color={C.blue}>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            Gemini es la IA de Google que lee tus facturas pixel por pixel, extrae todos los datos y los clasifica
            contablemente. Con tu propia clave, tienes <strong style={{ color: C.green }}>1 millón de tokens gratis por mes</strong>.
          </p>

          {/* Cómo obtener la clave */}
          <div style={{ background: `${C.accent}08`, border: `1px solid ${C.accent}22`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.accent }}>📋 Obtener tu clave Gemini GRATIS (5 minutos):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { n: 1, text: 'Abre', url: 'https://aistudio.google.com/apikey', label: 'aistudio.google.com/apikey', suf: ' con tu cuenta Gmail' },
                { n: 2, text: 'Clic en', url: '', label: '"Create API key"', suf: ' → "Create API key in new project"' },
                { n: 3, text: 'Copia la clave generada', url: '', label: ' (comienza con AIzaSy...)', suf: '' },
                { n: 4, text: 'Pégala en el campo de abajo', url: '', label: ' y haz clic en Guardar', suf: '' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: C.blue, color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {s.text}{' '}
                    {s.url
                      ? <button type="button" onClick={() => window.open(s.url, '_blank')} style={{ background: 'none', border: 'none', color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0, fontFamily: "'Segoe UI', Arial, sans-serif" }}>{s.label}</button>
                      : <strong style={{ color: C.text }}>{s.label}</strong>
                    }
                    <span style={{ color: C.dim }}>{s.suf}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tu clave Gemini API Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showGemini ? 'text' : 'password'}
                value={gemini}
                onChange={e => { setGemini(e.target.value); setTestResult(''); }}
                placeholder="AIzaSy... (pega tu clave aquí)"
                style={{ ...inp(focusGemini), paddingRight: 70 }}
                onFocus={() => setFocusGemini(true)}
                onBlur={() => setFocusGemini(false)}
              />
              <button type="button" onClick={() => setShowGemini(!showGemini)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: C.muted, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>{showGemini ? 'OCULTAR' : 'VER'}</button>
            </div>
            {gemini && (
              <p style={{ margin: '5px 0 0', fontSize: 11, color: geminiValid ? C.green : C.yellow }}>
                {geminiValid ? '✓ Formato válido (AIzaSy...)' : '⚠ La clave debe comenzar con AIzaSy...'}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button type="button" onClick={saveKeys} style={{
              padding: '9px 20px', background: saved ? `${C.green}22` : `linear-gradient(135deg, ${C.blue}, ${C.accent})`,
              border: saved ? `1px solid ${C.green}` : 'none', borderRadius: 8, color: saved ? C.green : '#fff',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
            }}>
              {saved ? '✓ Guardado' : '💾 Guardar clave'}
            </button>
            <button type="button" onClick={testGemini} disabled={!geminiValid || testing} style={{
              padding: '9px 20px', background: `${C.purple}18`, border: `1px solid ${C.purple}44`,
              borderRadius: 8, color: testing ? C.dim : C.purple, fontWeight: 700, fontSize: 12,
              cursor: geminiValid && !testing ? 'pointer' : 'not-allowed', fontFamily: "'Segoe UI', Arial, sans-serif",
              opacity: geminiValid ? 1 : 0.4,
            }}>
              {testing ? '⏳ Probando...' : '🧪 Probar conexión'}
            </button>
            {gemini && (
              <button type="button" onClick={clearKey} style={{
                padding: '9px 16px', background: `${C.red}18`, border: `1px solid ${C.red}33`,
                borderRadius: 8, color: C.red, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>
                🗑 Eliminar clave
              </button>
            )}
          </div>

          {testResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: testResult.startsWith('✅') ? `${C.green}12` : testResult.startsWith('❌') ? `${C.red}12` : `${C.accent}10`,
              border: `1px solid ${testResult.startsWith('✅') ? C.green : testResult.startsWith('❌') ? C.red : C.accent}33`,
              color: testResult.startsWith('✅') ? C.green : testResult.startsWith('❌') ? C.red : C.accent,
            }}>
              {testResult}
            </div>
          )}
        </Section>

        {/* ─── AUDIO DE VOZ ─── */}
        <Section title="Audio de voz — Web Speech API" icon="🔊" color={C.green}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                El audio de bienvenida y las explicaciones de planes usan la <strong style={{ color: C.green }}>Web Speech API del navegador</strong>.
                Es completamente gratuita, no necesita clave API y funciona con las voces de Google instaladas en tu dispositivo.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { icon: '✓', text: '100% gratis, sin límites', color: C.green },
                  { icon: '✓', text: 'Sin API key ni cuenta Google', color: C.green },
                  { icon: '✓', text: 'Funciona offline (voz del sistema)', color: C.green },
                  { icon: '✓', text: 'Voz Google disponible en Chrome/Edge', color: C.green },
                ].map((i, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: C.muted }}>
                    <span style={{ color: i.color, fontWeight: 700 }}>{i.icon}</span> {i.text}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: C.bgRow, borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.text }}>🎯 Probar audio ahora</p>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: C.dim }}>Haz clic para escuchar la voz que usará el sistema contigo.</p>
              <button type="button" onClick={() => {
                const synth = window.speechSynthesis;
                if (!synth) return;
                synth.cancel();
                const voices = synth.getVoices();
                const voice = voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name)) || voices.find(v => v.lang.startsWith('es'));
                const u = new SpeechSynthesisUtterance('Hola, esta es tu voz de CONTA PRO. El audio funciona correctamente en tu dispositivo.');
                if (voice) u.voice = voice;
                u.lang = 'es-PE'; u.rate = 0.91; u.pitch = 0.88;
                synth.speak(u);
              }} style={{
                width: '100%', padding: '9px', background: `${C.green}18`,
                border: `1px solid ${C.green}44`, borderRadius: 8,
                color: C.green, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>
                🔊 Probar voz
              </button>
              <button type="button" onClick={() => window.speechSynthesis?.cancel()} style={{
                width: '100%', marginTop: 6, padding: '7px',
                background: `${C.red}12`, border: `1px solid ${C.red}33`,
                borderRadius: 8, color: C.red, fontWeight: 700, fontSize: 11, cursor: 'pointer',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>
                ⏹ Detener audio
              </button>
            </div>
          </div>
        </Section>

        {/* ─── ESTADO ACTUAL ─── */}
        <Section title="Estado de tu configuración" icon="📊" color={C.accent}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              {
                label: 'Gemini IA (facturas)',
                status: localStorage.getItem('user_gemini_api_key') ? 'CONFIGURADO' : 'SIN CONFIGURAR',
                color: localStorage.getItem('user_gemini_api_key') ? C.green : C.yellow,
                desc: localStorage.getItem('user_gemini_api_key') ? 'Tu clave está activa. La IA usará tu quota.' : 'Sin clave. Ingresa facturas manualmente.',
              },
              {
                label: 'Audio de voz',
                status: 'speechSynthesis' in window ? 'ACTIVO' : 'NO DISPONIBLE',
                color: 'speechSynthesis' in window ? C.green : C.red,
                desc: 'speechSynthesis' in window ? 'Web Speech API disponible en tu navegador.' : 'Tu navegador no soporta audio de voz.',
              },
            ].map((s, i) => (
              <div key={i} style={{ background: C.bgRow, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{s.label}</span>
                  <span style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44`, padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800 }}>{s.status}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: C.dim }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
};

export default ApiConfigPanel;
