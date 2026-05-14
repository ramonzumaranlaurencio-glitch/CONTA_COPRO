# Layout Components Guide

## Componentes de Layout Disponibles

### 1. **PageLayout**
Wrapper principal para todas as páginas com header e conteúdo organizado.

```tsx
import { PageLayout } from '@/components/layout';

<PageLayout 
  title="Dashboard Enterprise" 
  subtitle="Gestión integral de operaciones"
  action={<button>Acciones</button>}
>
  {/* Conteúdo aqui */}
</PageLayout>
```

---

### 2. **PanelsGrid**
Grid responsivo para organizar painéis em colunas.

**Props:**
- `columns`: 1 | 2 | 3 | 4 (default: 2)
- `gap`: 'sm' | 'md' | 'lg' (default: 'md')

```tsx
import { PanelsGrid } from '@/components/layout';

<PanelsGrid columns={3} gap="md">
  <PanelSection>Painel 1</PanelSection>
  <PanelSection>Painel 2</PanelSection>
  <PanelSection>Painel 3</PanelSection>
</PanelsGrid>
```

---

### 3. **PanelSection**
Componente individual de painel com header customizável.

**Props:**
- `title`: string (obrigatório)
- `subtitle`: string (opcional)
- `children`: React.ReactNode (obrigatório)
- `action`: React.ReactNode (opcional - botão ou ação)
- `icon`: React.ReactNode (opcional - ícone no header)
- `variant`: 'default' | 'warning' | 'error' | 'success' (default: 'default')

```tsx
import { PanelSection } from '@/components/layout';
import { DocumentText24Regular } from '@fluentui/react-icons';

<PanelSection
  title="Libros Electronicos"
  subtitle="Periodo: Mayo 2026"
  icon={<DocumentText24Regular />}
  action={<button className="btn-fluent-secondary">Generar</button>}
  variant="success"
>
  <p>Contenido del painel...</p>
</PanelSection>
```

---

## Estilos CSS Disponibles

### Utility Classes

#### Panel Cards
- `.panel-card` - Card base con gradiente
- `.panel-header` - Header del panel con fondo azul oscuro
- `.panel-body` - Body del panel
- `.panel-footer` - Footer del panel

#### Detail Grids
- `.detail-grid` - Grid responsivo para detalles
- `.detail-item` - Item individual
- `.detail-label` - Label del detalle
- `.detail-value` - Valor del detalle
- `.detail-value.numeric` - Valor numérico (monoespaciado)

#### Alerts
```tsx
// Classes disponibles
.alert.alert-info
.alert.alert-warning
.alert.alert-danger
.alert.alert-success

// Exemplo:
<div className="alert alert-warning">
  <div className="alert-icon">⚠️</div>
  <div className="alert-text">
    <h4>Titulo del alerta</h4>
    <p>Descripción</p>
  </div>
</div>
```

#### Stats Row
```tsx
<div className="stats-row">
  <div className="stat-item">
    <span className="stat-value">18,880.00</span>
    <span className="stat-label">Debe</span>
  </div>
</div>
```

---

## Ejemplo Completo

```tsx
import { PageLayout, PanelsGrid, PanelSection } from '@/components/layout';
import { DocumentText24Regular } from '@fluentui/react-icons';

export const MyDashboard = () => {
  return (
    <PageLayout 
      title="Mi Dashboard"
      subtitle="Resumen de operaciones"
    >
      {/* Fila 1: Metricas 4 columnas */}
      <PanelsGrid columns={4} gap="md">
        {metrics.map(metric => (
          <div key={metric.id} className="panel-card">
            <div className="panel-body text-center">
              <p className="detail-label">{metric.label}</p>
              <p className="text-xl font-bold mt-2">{metric.value}</p>
            </div>
          </div>
        ))}
      </PanelsGrid>

      {/* Fila 2: Painels principales 2 columnas */}
      <PanelsGrid columns={2} gap="md">
        <PanelSection
          title="Libros Electronicos"
          icon={<DocumentText24Regular />}
          action={<button className="btn-fluent-primary">Generar</button>}
        >
          {/* Contenido... */}
        </PanelSection>

        <PanelSection
          title="Auditoria IA"
          variant="warning"
        >
          {/* Contenido... */}
        </PanelSection>
      </PanelsGrid>

      {/* Full Width */}
      <PanelSection title="Ultimas Operaciones">
        {/* Tabla o contenido grande... */}
      </PanelSection>
    </PageLayout>
  );
};
```

---

## Botones Disponibles

```tsx
// Primary
<button className="btn-fluent-primary">Acción Principal</button>

// Secondary
<button className="btn-fluent-secondary">Acción Secundaria</button>

// Ghost (Transparente)
<button className="btn-fluent-ghost">Acción Fantasma</button>
```

---

## Status Badges

```tsx
// Status OK
<span className="status-ok">OK</span>

// Status Critical
<span className="status-critical">CRÍTICO</span>
```

---

## Notas Importantes

1. **Responsive Design**: Los grids se adaptan automáticamente a diferentes tamaños de pantalla
2. **Animaciones**: Los panels tienen transiciones suaves en hover
3. **Temas**: Variantes de colores (default, warning, error, success) aplicadas automáticamente
4. **Glassmorphism**: Diseño moderno con backdrop blur y transparencias
5. **Sombras Profundas**: Sombras elevadas para dar profundidad visual

---

## Colores Disponibles

- **Primary Blue**: #3b82f6 / #2563eb
- **Primary Indigo**: #4f46e5
- **Success Green**: #84fab0
- **Warning Orange**: #fa709a / #fee140
- **Error Red**: #ef4444
- **Neutral Slate**: #64748b - #1e293b
- **Dark Blue**: #1e3a5f - #2d5a7b
