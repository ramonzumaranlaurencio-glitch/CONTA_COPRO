// =============================================================================
//  src/features/billing/PlanComparisonPage.tsx
//  Archivo NUEVO
//
//  Pantalla de selección de planes con checkout Culqi
//  Paleta: Midnight Pro (dark cian — igual que el dashboard)
//
//  Instalar Culqi script en index.html:
//    <script src="https://checkout.culqi.com/js/v4"></script>
// =============================================================================

import React, { useState } from 'react';

type Plan = 'BASIC' | 'PLUS' | 'PREMIUM';
type Billing = 'monthly' | 'annual';

interface PlanConfig {
  id: Plan;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  desc: string;
  popular: boolean;
  features: { label: string; included: boolean }[];
  btnClass: string;
}

const PLANS: PlanConfig[] = [
  {
    id: 'BASIC',
    name: 'Básico',
    monthlyPrice: 99,
    annualPrice: 79,
    desc: 'Contabilidad y operaciones esenciales',
    popular: false,
    btnClass: 'btn-basic',
    features: [
      { label: 'Contabilidad completa',  included: true  },
      { label: 'Ventas y compras',        included: true  },
      { label: 'Libro diario / mayor',    included: true  },
      { label: 'Dashboard básico',        included: true  },
      { label: 'Reportes básicos',        included: true  },
      { label: 'Inventario / Kardex',     included: false },
      { label: 'Planillas',               included: false },
      { label: 'IA / Copilot',            included: false },
    ],
  },
  {
    id: 'PLUS',
    name: 'Plus',
    monthlyPrice: 199,
    annualPrice: 159,
    desc: 'Operación avanzada con inventario y BI',
    popular: true,
    btnClass: 'btn-plus',
    features: [
      { label: 'Todo plan Básico',        included: true  },
      { label: 'Inventario / Kardex',     included: true  },
      { label: 'Planillas básicas',       included: true  },
      { label: 'OCR documentos',          included: true  },
      { label: 'BI avanzado',             included: true  },
      { label: 'IA limitada',             included: true  },
      { label: 'Herramientas token',      included: false },
      { label: 'DIAN avanzado',           included: false },
    ],
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    monthlyPrice: 349,
    annualPrice: 279,
    desc: 'IA, DIAN, herramientas y auditoría',
    popular: false,
    btnClass: 'btn-premium',
    features: [
      { label: 'Todo plan Plus',          included: true },
      { label: 'IA avanzada / Copilot',   included: true },
      { label: 'Herramientas por token',  included: true },
      { label: 'DIAN avanzado',           included: true },
      { label: 'Auditoría forense',       included: true },
      { label: 'Integraciones API',       included: true },
      { label: 'Multiempresa avanzada',   included: true },
      { label: 'Soporte prioritario',     included: true },
    ],
  },
];

interface CheckoutForm {
  ruc: string;
  razonSocial: string;
  email: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

const API_BASE = '/api/v1';

export default function PlanComparisonPage() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CheckoutForm>({
    ruc: '', razonSocial: '', email: '',
    cardNumber: '', expiry: '', cvv: '',
  });

  const price = (plan: PlanConfig) =>
    billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;

  const handleField = (field: keyof CheckoutForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const formatCard = (value: string) =>
    value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  const handlePay = async () => {
    if (!selectedPlan) return;
    setError('');

    // Validaciones básicas
    if (!form.ruc || form.ruc.length !== 11) {
      setError('Ingresa un RUC válido de 11 dígitos'); return;
    }
    if (!form.razonSocial.trim()) {
      setError('Ingresa la razón social'); return;
    }
    if (!form.email.includes('@')) {
      setError('Ingresa un email válido'); return;
    }

    setLoading(true);
    try {
      // Culqi tokeniza la tarjeta en el frontend
      // Documentación: https://docs.culqi.com/#/pagos/tokens
      const culqi = (window as any).Culqi;
      if (!culqi) throw new Error('Culqi no está cargado');

      culqi.publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY || 'pk_test_tu_llave_publica';
      culqi.settings({
        title:   'ApexLogix Core',
        currency: 'PEN',
        description: `Plan ${selectedPlan.name}`,
        amount:  price(selectedPlan) * 100, // en centavos
      });

      // Culqi abre su propio modal de pago seguro
      // Cuando el usuario completa, llama culqi.token (ver abajo)
      culqi.open();

      // El token llega vía callback global window.culqi()
      // Ver función culqiCallback más abajo

    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago');
      setLoading(false);
    }
  };

  // Culqi llama esta función global cuando el usuario completa el pago
  // Agrégala en main.tsx o App.tsx:
  //
  //   window.culqi = async () => {
  //     const token = (window as any).Culqi.token;
  //     if (token) {
  //       await fetch('/api/v1/billing/subscribe', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ culqi_token: token.id, plan: selectedPlan }),
  //       });
  //     }
  //   };

  return (
    <div style={styles.page}>
      {/* ── Topbar ── */}
      <div style={styles.topbar}>
        <div style={styles.brand}>
          <span style={{ fontSize: 20, color: '#00d4ff' }}>◈</span>
          ApexLogix Core
        </div>
        <button
          style={styles.loginLink}
          onClick={() => window.location.href = '/login'}
        >
          Ya tengo cuenta — ingresar
        </button>
      </div>

      {!selectedPlan ? (
        <>
          {/* ── Hero ── */}
          <div style={styles.hero}>
            <h1 style={styles.heroTitle}>Elige el plan para tu empresa</h1>
            <p style={styles.heroSub}>
              Contabilidad completa en todos los planes · Sin permanencia
            </p>
          </div>

          {/* ── Toggle mensual / anual ── */}
          <div style={styles.toggleWrap}>
            <span style={styles.toggleLabel}>Mensual</span>
            <div
              style={{ ...styles.toggleTrack, background: billing === 'annual' ? '#534AB7' : '#141c35' }}
              onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
              role="switch"
              aria-checked={billing === 'annual'}
              tabIndex={0}
            >
              <div style={{
                ...styles.toggleThumb,
                left: billing === 'annual' ? 21 : 3,
                background: billing === 'annual' ? '#fff' : '#475569',
              }} />
            </div>
            <span style={styles.toggleLabel}>Anual</span>
            <span style={styles.saveBadge}>Ahorra 20%</span>
          </div>

          {/* ── Cards de planes ── */}
          <div style={styles.plansGrid}>
            {PLANS.map(plan => (
              <div
                key={plan.id}
                style={{
                  ...styles.planCard,
                  border: plan.popular
                    ? '2px solid #534AB7'
                    : '0.5px solid #1e293b',
                }}
              >
                {plan.popular
                  ? <div style={styles.popularBadge}>Más popular</div>
                  : <div style={{ height: 22 }} />
                }
                <div style={styles.planBody}>
                  <div style={styles.planName}>{plan.name}</div>
                  <div style={styles.planDesc}>{plan.desc}</div>
                  <div style={styles.planPrice}>
                    S/ {price(plan)}
                    <span style={styles.planPriceSub}>
                      {' '}/ {billing === 'annual' ? 'mes · anual' : 'mes'}
                    </span>
                  </div>
                  <hr style={styles.divider} />
                  <div style={styles.featList}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={styles.featItem}>
                        <span style={{ color: f.included ? '#10b981' : '#334155', fontSize: 13 }}>
                          {f.included ? '✓' : '✕'}
                        </span>
                        <span style={{ color: f.included ? '#94a3b8' : '#334155', fontSize: 11 }}>
                          {f.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    style={{
                      ...styles.planBtn,
                      background: plan.id === 'PLUS'
                        ? '#534AB7'
                        : plan.id === 'PREMIUM'
                        ? '#f59e0b'
                        : '#1e293b',
                      color: plan.id === 'BASIC' ? '#94a3b8' : '#fff',
                    }}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    Contratar {plan.name}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <div style={styles.culqiNote}>
            🔒 Pagos seguros procesados por Culqi · Visa · Mastercard · Amex
          </div>
        </>
      ) : (
        /* ── Checkout ── */
        <div style={styles.checkoutWrap}>
          <div style={styles.checkoutCard}>
            <h2 style={styles.checkoutTitle}>
              Plan {selectedPlan.name} — S/ {price(selectedPlan)}/mes
            </h2>
            <p style={styles.checkoutSub}>
              Datos de empresa y tarjeta para activar
            </p>

            {error && (
              <div style={styles.errorBox}>{error}</div>
            )}

            <label style={styles.label}>RUC de la empresa</label>
            <input
              style={styles.input}
              placeholder="20123456789"
              maxLength={11}
              value={form.ruc}
              onChange={e => handleField('ruc', e.target.value.replace(/\D/g, ''))}
            />

            <label style={styles.label}>Razón social</label>
            <input
              style={styles.input}
              placeholder="Mi Empresa SAC"
              value={form.razonSocial}
              onChange={e => handleField('razonSocial', e.target.value)}
            />

            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="admin@miempresa.com"
              value={form.email}
              onChange={e => handleField('email', e.target.value)}
            />

            <label style={styles.label}>Número de tarjeta</label>
            <input
              style={styles.input}
              placeholder="4111 1111 1111 1111"
              value={form.cardNumber}
              onChange={e => handleField('cardNumber', formatCard(e.target.value))}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={styles.label}>Vencimiento</label>
                <input
                  style={styles.input}
                  placeholder="MM/AA"
                  value={form.expiry}
                  onChange={e => handleField('expiry', formatExpiry(e.target.value))}
                />
              </div>
              <div>
                <label style={styles.label}>CVV</label>
                <input
                  style={styles.input}
                  placeholder="123"
                  maxLength={4}
                  value={form.cvv}
                  onChange={e => handleField('cvv', e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <button
              style={{ ...styles.payBtn, opacity: loading ? 0.7 : 1 }}
              onClick={handlePay}
              disabled={loading}
            >
              {loading ? 'Procesando...' : `Pagar con Culqi — activar plan`}
            </button>

            <div
              style={styles.backLink}
              onClick={() => { setSelectedPlan(null); setError(''); }}
            >
              ← Volver a planes
            </div>

            <div style={styles.secureRow}>
              🔒 Conexión cifrada · Powered by Culqi
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
//  Estilos inline — paleta Midnight Pro
// =============================================================================
const styles: Record<string, React.CSSProperties> = {
  page:         { background: '#0a0e1a', minHeight: '100vh', padding: '32px 24px', fontFamily: 'Inter, system-ui, sans-serif' },
  topbar:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  brand:        { display: 'flex', alignItems: 'center', gap: 8, color: '#00d4ff', fontSize: 14, fontWeight: 500 },
  loginLink:    { fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '5px 12px', border: '0.5px solid #334155', borderRadius: 20, background: 'transparent' },
  hero:         { textAlign: 'center', marginBottom: 28 },
  heroTitle:    { fontSize: 22, fontWeight: 500, color: '#e2e8f0', marginBottom: 6 },
  heroSub:      { fontSize: 13, color: '#64748b' },
  toggleWrap:   { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 },
  toggleLabel:  { fontSize: 12, color: '#64748b' },
  toggleTrack:  { width: 40, height: 22, borderRadius: 11, cursor: 'pointer', position: 'relative', border: '0.5px solid #334155', transition: 'background .2s' },
  toggleThumb:  { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', transition: 'left .2s' },
  saveBadge:    { fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '0.5px solid rgba(16,185,129,0.3)' },
  plansGrid:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
  planCard:     { borderRadius: 10, background: '#0f1629', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .2s' },
  popularBadge: { background: '#534AB7', color: '#CECBF6', fontSize: 10, padding: '4px 0', textAlign: 'center', fontWeight: 500 },
  planBody:     { padding: 16 },
  planName:     { fontSize: 13, fontWeight: 500, color: '#e2e8f0', marginBottom: 2 },
  planDesc:     { fontSize: 11, color: '#475569', marginBottom: 12 },
  planPrice:    { fontSize: 26, fontWeight: 500, color: '#e2e8f0', lineHeight: '1' },
  planPriceSub: { fontSize: 12, color: '#64748b', fontWeight: 400 },
  divider:      { border: 'none', borderTop: '0.5px solid #1e293b', margin: '12px 0' },
  featList:     { display: 'flex', flexDirection: 'column', gap: 6 },
  featItem:     { display: 'flex', alignItems: 'center', gap: 7 },
  planBtn:      { width: '100%', marginTop: 14, padding: '9px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  culqiNote:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: '#475569' },
  checkoutWrap: { display: 'flex', justifyContent: 'center', padding: '20px 0' },
  checkoutCard: { background: '#0f1629', border: '0.5px solid #1e293b', borderRadius: 12, padding: 24, width: '100%', maxWidth: 380 },
  checkoutTitle:{ fontSize: 15, fontWeight: 500, color: '#e2e8f0', marginBottom: 4 },
  checkoutSub:  { fontSize: 11, color: '#475569', marginBottom: 16 },
  errorBox:     { background: 'rgba(239,68,68,0.1)', border: '0.5px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 },
  label:        { fontSize: 11, color: '#64748b', marginBottom: 4, display: 'block', marginTop: 10 },
  input:        { width: '100%', background: '#141c35', border: '0.5px solid #1e293b', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' },
  payBtn:       { width: '100%', padding: 10, background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', marginTop: 14 },
  backLink:     { fontSize: 11, color: '#475569', cursor: 'pointer', textAlign: 'center', marginTop: 10 },
  secureRow:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10, color: '#334155', marginTop: 8 },
};
