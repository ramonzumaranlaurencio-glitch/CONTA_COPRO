module.exports = {
  content: [
    './index.html',
    './frontend/src/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      boxShadow: {
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'enterprise-flat': '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
        'enterprise-elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'inner-dark': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        enterprise: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'ent-card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'ent-elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'ent-inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.08)',
      },
      colors: {
        'cobalto-dark': '#0F172A',
        'pizarra-bg': '#F8FAF0',
        'ent-blue': '#0F172A',
        'ent-slate': '#64748B',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};