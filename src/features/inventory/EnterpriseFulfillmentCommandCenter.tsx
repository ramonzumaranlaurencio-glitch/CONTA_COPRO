
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  ApexLogix Core — Enterprise WMS / ERP / EAM  v4.0
 *  React + Recharts + Gemini AI Integration
 *  Dominios: WMS · Inventario · Herramientas · Tokens · EAM · Costing
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  DEPENDENCIAS:
 *    npm install recharts lucide-react
 *
 *  GEMINI API KEY (gratuita):
 *    → https://aistudio.google.com → Get API Key
 *    → Ingresar en el panel "IA Gemini" del dashboard
 *
 *  BACKEND (FastAPI):
 *    Ver: apexlogix_api.py  /  apexlogix_models.py
 *    apexlogix_costing.py  /  apexlogix_token_engine.py
 * ═══════════════════════════════════════════════════════════════════════
 */
 
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";
import {
  Warehouse, Package, Wrench, ShieldCheck, TrendingUp, AlertTriangle,
  RefreshCw, Download, Plus, Search, Filter, ChevronDown, ChevronRight,
  QrCode, Zap, Activity, Map as MapIcon, BarChart3, Settings, Bell, User,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle,
  Truck, Box, Layers, Database, Brain, Lock, Eye, Send,
  FileText, AlertCircle, CheckSquare, RotateCcw, Cpu,
  Building2, Globe, Star, Hash, Calendar, DollarSign,
  ArrowLeftRight, ClipboardList, Tool, HardDrive
} from "lucide-react";

type InventoryPanelProps = {
  apiBase?: string;
  token?: string;
  tenantId?: string;
  onStatus?: (message: string) => void;
  onJournalPosted?: () => void | Promise<void>;
};

type LedgerAccount = {
  code: string;
  name: string;
  statement?: string;
  nature?: string;
  accepts_cost_center?: boolean;
};

const FALLBACK_LEDGER_ACCOUNTS: LedgerAccount[] = [
  { code: "2011", name: "Inventarios", statement: "BALANCE", nature: "DEBIT" },
  { code: "6911", name: "Costo de ventas", statement: "INCOME", nature: "DEBIT", accepts_cost_center: true },
  { code: "7599", name: "Ajuste positivo de inventario", statement: "INCOME", nature: "CREDIT" },
];

const normalizeApiNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const isBackendId = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const movementToLedgerType = (type: unknown) => {
  const upper = String(type || "").toUpperCase();
  if (upper.includes("RECEIPT") || upper.includes("RETURN") || upper.includes("GAIN")) return "ENTRY";
  return "EXIT";
};
 
// ─── GEMINI MASTER PROMPT ─────────────────────────────────────────────────────
const MASTER_PROMPT = `Eres el motor IA de ApexLogix Core, una plataforma enterprise de WMS/ERP/EAM.
Analiza el contexto del inventario y herramientas proporcionado. Responde en español.
Detecta: rotación ABC, stock crítico, tokens vencidos, herramientas sin retorno, riesgo SUNAT,
anomalías de consumo, necesidad de mantenimiento preventivo y oportunidades de optimización.
Sé conciso, ejecutivo y accionable. Usa bullets. Max 300 palabras.`;
 
// ─── PALETA ENTERPRISE ────────────────────────────────────────────────────────
const C = {
  bg:        "#0a0e1a",
  surface:   "#0f1629",
  card:      "#131d35",
  cardHover: "#172040",
  border:    "#1e2d50",
  accent:    "#00d4ff",
  accent2:   "#7c3aed",
  accent3:   "#10b981",
  warn:      "#f59e0b",
  danger:    "#ef4444",
  text:      "#e2e8f0",
  textMute:  "#64748b",
  textDim:   "#94a3b8",
  grad1:     "linear-gradient(135deg,#00d4ff22,#7c3aed22)",
};
 
// ─── ESTILOS DEL PANEL ────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
 
  .apex-shell,.apex-shell *{box-sizing:border-box;}
  .apex-shell{display:flex;height:100%;min-height:720px;overflow:hidden;background:${C.bg};color:${C.text};font-family:'Space Grotesk',sans-serif;font-size:14px;}
  .apex-shell *{margin:0;padding:0;}
  .apex-shell ::-webkit-scrollbar{width:4px;height:4px;}
  .apex-shell ::-webkit-scrollbar-track{background:${C.surface};}
  .apex-shell ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
  .apex-shell input,.apex-shell select,.apex-shell textarea{background:${C.surface};border:1px solid ${C.border};color:${C.text};
    border-radius:6px;padding:6px 10px;font-family:inherit;font-size:13px;outline:none;}
  .apex-shell input:focus,.apex-shell select:focus,.apex-shell textarea:focus{border-color:${C.accent};}
  .apex-shell button{cursor:pointer;font-family:inherit;}
 
  .apex-rail{width:56px;background:${C.surface};border-right:1px solid ${C.border};
    display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:4px;
    transition:width .2s;flex-shrink:0;}
  .apex-rail.expanded{width:200px;}
  .apex-rail.expanded .rail-label{display:block;}
  .rail-label{display:none;font-size:12px;margin-left:10px;white-space:nowrap;}
  .rail-item{width:40px;height:40px;border-radius:8px;border:none;background:transparent;
    color:${C.textMute};display:flex;align-items:center;justify-content:center;gap:0;
    transition:all .15s;position:relative;}
  .apex-rail.expanded .rail-item{width:184px;justify-content:flex-start;padding:0 12px;}
  .apex-rail.expanded .rail-item{gap:10px;}
  .rail-item:hover{background:${C.card};color:${C.text};}
  .rail-item.active{background:${C.accent}18;color:${C.accent};}
  .rail-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);
    width:3px;height:20px;background:${C.accent};border-radius:0 2px 2px 0;}
 
  .apex-main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
  .apex-topbar{height:52px;background:${C.surface};border-bottom:1px solid ${C.border};
    display:flex;align-items:center;padding:0 16px;gap:12px;flex-shrink:0;}
  .apex-content{flex:1;overflow-y:auto;padding:16px;}
 
  .apex-shell .card{background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;}
  .apex-shell .card-sm{background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:12px;}
  .apex-shell .card:hover{border-color:#2a3a5e;}
 
  .apex-shell .metric-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px;}
  .apex-shell .metric-card{background:${C.card};border:1px solid ${C.border};border-radius:12px;
    padding:14px;position:relative;overflow:hidden;}
  .apex-shell .metric-card::before{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;
    border-radius:50%;opacity:.06;}
  .apex-shell .metric-val{font-size:22px;font-weight:700;line-height:1.2;margin-top:4px;}
  .apex-shell .metric-label{font-size:11px;color:${C.textMute};text-transform:uppercase;letter-spacing:.5px;}
  .apex-shell .metric-delta{font-size:11px;display:flex;align-items:center;gap:3px;margin-top:4px;}
  .apex-shell .delta-up{color:${C.accent3};}
  .apex-shell .delta-dn{color:${C.danger};}
 
  .apex-shell .btn{border:none;border-radius:7px;padding:7px 14px;font-size:13px;font-weight:500;
    display:inline-flex;align-items:center;gap:6px;transition:all .15s;}
  .apex-shell .btn-primary{background:${C.accent};color:#000;}
  .apex-shell .btn-primary:hover{background:#00bfe8;}
  .apex-shell .btn-ghost{background:transparent;color:${C.textDim};border:1px solid ${C.border};}
  .apex-shell .btn-ghost:hover{background:${C.cardHover};color:${C.text};}
  .apex-shell .btn-danger{background:${C.danger}22;color:${C.danger};border:1px solid ${C.danger}44;}
  .apex-shell .btn-warn{background:${C.warn}22;color:${C.warn};border:1px solid ${C.warn}44;}
  .apex-shell .btn-success{background:${C.accent3}22;color:${C.accent3};border:1px solid ${C.accent3}44;}
  .apex-shell .btn-xs{padding:4px 9px;font-size:11px;border-radius:5px;}
 
  .apex-shell .badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;
    font-size:11px;font-weight:600;letter-spacing:.3px;}
  .apex-shell .badge-ok{background:${C.accent3}22;color:${C.accent3};}
  .apex-shell .badge-warn{background:${C.warn}22;color:${C.warn};}
  .apex-shell .badge-danger{background:${C.danger}22;color:${C.danger};}
  .apex-shell .badge-info{background:${C.accent}22;color:${C.accent};}
  .apex-shell .badge-purple{background:${C.accent2}22;color:#a78bfa;}
  .apex-shell .badge-gray{background:#1e293b;color:${C.textDim};}
 
  .apex-shell .tbl{width:100%;border-collapse:collapse;}
  .apex-shell .tbl th{text-align:left;padding:8px 10px;font-size:11px;font-weight:600;
    color:${C.textMute};text-transform:uppercase;letter-spacing:.4px;
    border-bottom:1px solid ${C.border};}
  .apex-shell .tbl td{padding:9px 10px;border-bottom:1px solid #0f172a;font-size:13px;}
  .apex-shell .tbl tr:hover td{background:${C.cardHover};}
  .apex-shell .tbl tr:last-child td{border-bottom:none;}
 
  .apex-shell .mono{font-family:'JetBrains Mono',monospace;font-size:12px;}
  .apex-shell .section-title{font-size:13px;font-weight:600;color:${C.textDim};
    text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;
    display:flex;align-items:center;gap:8px;}
  .apex-shell .divider{height:1px;background:${C.border};margin:16px 0;}
 
  .apex-shell .token-card{background:${C.card};border:1px solid ${C.border};border-radius:10px;
    padding:12px;display:flex;flex-direction:column;gap:8px;}
  .apex-shell .token-card.overdue{border-color:${C.danger}55;background:#1a0a0a;}
  .apex-shell .token-card.due-soon{border-color:${C.warn}55;background:#1a1200;}
  .apex-shell .token-card.active{border-color:${C.accent3}33;}
 
  .apex-shell .progress-bar{height:4px;border-radius:2px;background:#1e293b;overflow:hidden;}
  .apex-shell .progress-fill{height:100%;border-radius:2px;transition:width .3s;}
 
  .apex-shell .ai-panel{background:linear-gradient(135deg,#0f1629,#131d35);
    border:1px solid ${C.accent}33;border-radius:12px;padding:16px;}
  .apex-shell .ai-msg{background:#0a0e1a;border:1px solid ${C.border};border-radius:8px;
    padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap;
    max-height:280px;overflow-y:auto;}
 
  .apex-shell .heatmap-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;}
  .apex-shell .heatmap-cell{aspect-ratio:1;border-radius:3px;cursor:pointer;transition:transform .1s;}
  .apex-shell .heatmap-cell:hover{transform:scale(1.15);}
 
  .apex-shell .tab-bar{display:flex;gap:4px;border-bottom:1px solid ${C.border};margin-bottom:16px;}
  .apex-shell .tab{padding:8px 16px;border:none;background:transparent;color:${C.textMute};
    font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;
    transition:all .15s;}
  .apex-shell .tab.active{color:${C.accent};border-bottom-color:${C.accent};}
  .apex-shell .tab:hover{color:${C.text};}
 
  .apex-shell .alert-strip{background:${C.danger}18;border:1px solid ${C.danger}44;
    border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px;
    font-size:13px;color:${C.danger};}
  .apex-shell .warn-strip{background:${C.warn}18;border:1px solid ${C.warn}44;
    border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px;
    font-size:13px;color:${C.warn};}
 
  .apex-shell .status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;}
  .apex-shell .dot-ok{background:${C.accent3};}
  .apex-shell .dot-warn{background:${C.warn};}
  .apex-shell .dot-danger{background:${C.danger};}
  .apex-shell .dot-info{background:${C.accent};}
 
  .apex-shell .form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;}
  .apex-shell .form-field{display:flex;flex-direction:column;gap:4px;}
  .apex-shell .form-label{font-size:11px;font-weight:600;color:${C.textMute};text-transform:uppercase;letter-spacing:.4px;}
  .apex-shell .form-field input,.apex-shell .form-field select{width:100%;}
 
  @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.4}}
  .apex-shell .pulse{animation:pulse-dot 1.6s infinite;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .apex-shell .fadein{animation:fadeIn .3s ease forwards;}
`;
 
// ─── DATOS DEMO ───────────────────────────────────────────────────────────────
const WAREHOUSES = [
  { id: "WH-LIM-01", name: "Almacén Lima Central", site: "Lima", cap: 92, occ: 74, type: "Principal" },
  { id: "WH-LIM-02", name: "Almacén Materiales Sur", site: "Lima", cap: 60, occ: 88, type: "Materiales" },
  { id: "WH-CAL-01", name: "Almacén Callao Puerto", site: "Callao", cap: 120, occ: 45, type: "Importaciones" },
  { id: "WH-MAN-01", name: "Almacén Mantto. Equipos", site: "Lima", cap: 40, occ: 61, type: "Mantenimiento" },
  { id: "WH-OBR-05", name: "Sub-almacén Obra #5", site: "Ica", cap: 20, occ: 95, type: "Proyecto" },
];
 
const INVENTORY = [
  { id:"SKU-0001", sku:"CABLE-THW-12", desc:"Cable THW-12 AWG x m", cat:"Consumible", wh:"WH-LIM-01", stock:4820, reorder:1000, unit:"m",  cost:2.35, abc:"A", status:"OK",     loc:"A-01-R03-L2" },
  { id:"SKU-0002", sku:"DISCO-CORTE-4", desc:"Disco corte 4.5\" metal", cat:"Consumible", wh:"WH-LIM-01", stock:148,  reorder:200,  unit:"und",cost:3.80, abc:"B", status:"BAJO",  loc:"B-02-R01-L1" },
  { id:"SKU-0003", sku:"EPP-CASCO-A",  desc:"Casco seguridad clase A", cat:"EPP",       wh:"WH-LIM-02", stock:312,  reorder:100,  unit:"und",cost:18.5, abc:"B", status:"OK",     loc:"C-01-R02-L3" },
  { id:"SKU-0004", sku:"ACEITE-HYD-46",desc:"Aceite hidráulico ISO 46", cat:"Repuesto",  wh:"WH-MAN-01", stock:85,   reorder:120,  unit:"lt", cost:12.0, abc:"A", status:"BAJO",  loc:"D-03-R01-L2" },
  { id:"SKU-0005", sku:"MOTOR-BOMBA-3", desc:"Motor bomba centrif. 3HP",cat:"Repuesto",  wh:"WH-MAN-01", stock:2,    reorder:3,    unit:"und",cost:1850, abc:"A", status:"CRÍTICO",loc:"D-01-R01-L1" },
  { id:"SKU-0006", sku:"TUBO-SCH40-2",  desc:"Tubo SCH40 2\" x 6m",    cat:"Material",  wh:"WH-LIM-02", stock:930,  reorder:200,  unit:"und",cost:45.0, abc:"A", status:"OK",     loc:"E-02-R04-L1" },
  { id:"SKU-0007", sku:"GUANTE-SOLDR",  desc:"Guante soldadura cuero",  cat:"EPP",       wh:"WH-OBR-05", stock:24,   reorder:30,   unit:"par",cost:8.50, abc:"C", status:"BAJO",  loc:"F-01-R01-L1" },
  { id:"SKU-0008", sku:"SOLDADORA-SYN", desc:"Soldadora Synergic 350A", cat:"Herramienta",wh:"WH-LIM-01",stock:4,   reorder:1,    unit:"und",cost:4200, abc:"A", status:"OK",     loc:"A-02-R01-L1" },
  { id:"SKU-0009", sku:"AMOLADORA-7",   desc:"Amoladora angular 7\"",   cat:"Herramienta",wh:"WH-LIM-01",stock:8,   reorder:2,    unit:"und",cost:380,  abc:"B", status:"OK",     loc:"A-02-R01-L2" },
  { id:"SKU-0010", sku:"GRUA-HIDRAUL",  desc:"Grúa hidráulica 2T",      cat:"Activo",    wh:"WH-MAN-01", stock:1,   reorder:1,    unit:"und",cost:18500,abc:"A", status:"MANT",   loc:"PATIO-01" },
];
 
const TOOL_TOKENS = [
  { id:"TKN-2026-0041", sku:"AMOLADORA-7",   tool:"Amoladora 7\" #SN-0041", worker:"Carlos Ramos",   cc:"CC-OBRAS-ICA", issued:"2026-05-12", due:"2026-05-19", status:"OVERDUE",    hours:52, maxHours:80 },
  { id:"TKN-2026-0038", sku:"SOLDADORA-SYN", tool:"Soldadora 350A #SN-0022",worker:"Pedro Llanos",   cc:"CC-MANTTO",    issued:"2026-05-15", due:"2026-05-22", status:"DUE_SOON",   hours:38, maxHours:80 },
  { id:"TKN-2026-0039", sku:"AMOLADORA-7",   tool:"Amoladora 7\" #SN-0039", worker:"Rosa Quispe",    cc:"CC-OBRAS-ICA", issued:"2026-05-16", due:"2026-05-23", status:"IN_CUSTODY",  hours:21, maxHours:80 },
  { id:"TKN-2026-0040", sku:"TALADRO-32",    tool:"Taladro percutor 32mm",   worker:"Luis Torres",   cc:"CC-ELECTRO",   issued:"2026-05-17", due:"2026-05-24", status:"IN_CUSTODY",  hours:9,  maxHours:60 },
  { id:"TKN-2026-0042", sku:"GRUA-HIDRAUL",  tool:"Grúa hidráulica 2T",      worker:"Almacén",       cc:"-",            issued:"2026-05-10", due:"—",          status:"MAINTENANCE", hours:200,maxHours:200 },
];

const INVENTARIO_TOOLS = [
  { id:1,  code:"T00001", name:"Rotomartillo SDS Plus",     cat:"Perforación",     brand:"Bosch",        model:"GBH 2-26",   location:"Almacén central",         horas:52,  maxHoras:200 },
  { id:2,  code:"T00002", name:"Rotomartillo SDS Max",      cat:"Perforación",     brand:"Makita",       model:"HR4002",     location:"Almacén central",         horas:38,  maxHoras:200 },
  { id:3,  code:"T00004", name:'Esmeril angular 4½"',       cat:"Corte y desbaste",brand:"DeWalt",       model:"DWE4010",    location:"Almacén metalmecánica",   horas:21,  maxHoras:80  },
  { id:4,  code:"T00005", name:'Esmeril angular 7"',        cat:"Corte y desbaste",brand:"Makita",       model:"GA9020",     location:"Almacén metalmecánica",   horas:9,   maxHoras:80  },
  { id:5,  code:"T00009", name:'Sierra circular 7¼"',       cat:"Corte madera",    brand:"Bosch",        model:"GKS 190",    location:"Carpintería",             horas:64,  maxHoras:150 },
  { id:6,  code:"T00015", name:"Vibrador de concreto",      cat:"Concreto",        brand:"Total",        model:"TP630-1",    location:"Área de concreto",        horas:18,  maxHoras:100 },
  { id:7,  code:"T00023", name:"Generador 6500W",           cat:"Energía",         brand:"Hyundai",      model:"HY6500",     location:"Patio de equipos",        horas:200, maxHoras:500 },
  { id:8,  code:"T00026", name:"Compactador canguro",       cat:"Compactación",    brand:"Wacker Neuson",model:"BS60-4",     location:"Patio de equipos",        horas:88,  maxHoras:300 },
  { id:9,  code:"T00028", name:"Soldadora inversora",       cat:"Soldadura",       brand:"Truper",       model:"SOIN-200",   location:"Almacén metalmecánica",   horas:44,  maxHoras:200 },
  { id:10, code:"T00036", name:"Escalera telescópica",      cat:"Acceso",          brand:"Werner",       model:"XTEND",      location:"Almacén general",         horas:12,  maxHoras:150 },
  { id:11, code:"T00037", name:"Escalera multiposiciones",  cat:"Acceso",          brand:"Truper",       model:"EST-24",     location:"Almacén general",         horas:7,   maxHoras:150 },
  { id:12, code:"T00044", name:'Pulidora angular 4½"',      cat:"Corte y desbaste",brand:"Stanley",      model:"STGS7115",   location:"Almacén metalmecánica",   horas:31,  maxHoras:80  },
];

const ASIGNACIONES_ACTIVAS = [
  { id:1, token:"TKN-2826-9841", code:"T00041", name:'Amoladora 7" #SN-0041',   worker:"Carlos Ramos", obra:"Edificio Torre Norte",  seccion:"Sótano",   fechaEntrega:"2026-05-11", vence:"2026-05-19", fotoSalida:true,  devMovil:false, status:"overdue" },
  { id:2, token:"TKN-2826-9838", code:"T00022", name:"Soldadora 350A #SN-0022", worker:"Pedro Llanos", obra:"Planta Industrial Sur",  seccion:"Mecánica", fechaEntrega:"2026-05-14", vence:"2026-05-22", fotoSalida:false, devMovil:false, status:"pending" },
  { id:3, token:"TKN-2826-9839", code:"T00039", name:'Amoladora 7" #SN-0039',   worker:"Rosa Quispe",  obra:"Edificio Torre Norte",  seccion:"Acabados", fechaEntrega:"2026-05-15", vence:"2026-05-23", fotoSalida:true,  devMovil:true,  status:"active"  },
  { id:4, token:"TKN-2826-9840", code:"T00018", name:"Taladro percutor 32mm",   worker:"Luis Torres",  obra:"Planta Industrial Sur",  seccion:"Eléctrica",fechaEntrega:"2026-05-16", vence:"2026-05-24", fotoSalida:false, devMovil:false, status:"active"  },
  { id:5, token:"TKN-2826-9842", code:"T00042", name:"Grúa hidráulica 2T",      worker:"Carlos Ramos", obra:"Planta Industrial Sur",  seccion:"Montaje",  fechaEntrega:"2026-05-09", vence:"2026-05-24", fotoSalida:true,  devMovil:false, status:"active"  },
  { id:6, token:"T00041-260521", code:"T00041", name:"Andamio tubular",          worker:"Juan Rojas",   obra:"Edificio Torre Norte",  seccion:"Acabados", fechaEntrega:"2026-05-21", vence:"2026-05-22", fotoSalida:false, devMovil:false, status:"pending" },
  { id:7, token:"T00018-260424", code:"T00018", name:"Soldadora inversora",      worker:"Luis Gómez",   obra:"Edificio Torre Norte",  seccion:"Acabados", fechaEntrega:"2026-04-24", vence:"2026-04-24", fotoSalida:false, devMovil:false, status:"overdue" },
  { id:8, token:"T00036-260423", code:"T00036", name:"Escalera telescópica",     worker:"Juan Rojas",   obra:"Edificio Torre Norte",  seccion:"Nivel 1",  fechaEntrega:"2026-04-23", vence:"2026-04-23", fotoSalida:true,  devMovil:false, status:"overdue" },
];

const MOVEMENTS = [
  { id:"MOV-001", date:"2026-05-18", type:"261_GOODS_ISSUE_WORK_ORDER", sku:"CABLE-THW-12", qty:250, wh:"WH-LIM-01→WH-OBR-05", cc:"CC-OBRAS-ICA", user:"almacenero1", cost:587.50 },
  { id:"MOV-002", date:"2026-05-18", type:"901_TOOL_CHECKOUT",          sku:"AMOLADORA-7",  qty:1,   wh:"WH-LIM-01",            cc:"CC-ELECTRO",   user:"almacenero2", cost:380.00 },
  { id:"MOV-003", date:"2026-05-17", type:"101_GOODS_RECEIPT_PO",       sku:"TUBO-SCH40-2", qty:180, wh:"WH-LIM-02",            cc:"-",            user:"jefe.almacen", cost:8100.00 },
  { id:"MOV-004", date:"2026-05-17", type:"902_TOOL_RETURN",            sku:"TALADRO-32",   qty:1,   wh:"WH-LIM-01",            cc:"CC-ELECTRO",   user:"almacenero1", cost:0 },
  { id:"MOV-005", date:"2026-05-16", type:"201_GOODS_ISSUE_COST_CENTER",sku:"ACEITE-HYD-46",qty:15,  wh:"WH-MAN-01",            cc:"CC-MANTTO",    user:"tecnico.mant", cost:180.00 },
  { id:"MOV-006", date:"2026-05-16", type:"701_PHYSICAL_COUNT_GAIN",    sku:"EPP-CASCO-A",  qty:5,   wh:"WH-LIM-02",            cc:"-",            user:"auditor",     cost:92.50 },
  { id:"MOV-007", date:"2026-05-15", type:"903_TOOL_DAMAGE",            sku:"AMOLADORA-7",  qty:1,   wh:"WH-LIM-01",            cc:"CC-MANTTO",    user:"tecnico.mant", cost:-380.0 },
];
 
const WORK_ORDERS = [
  { id:"WO-2026-0081", asset:"Bomba Centrif. BC-03", type:"PREVENTIVO", status:"EN_EJECUCION", tech:"Juan Pérez",   cc:"CC-MANTTO", priority:"ALTA",   parts:3, est:4.0,  real:2.5 },
  { id:"WO-2026-0080", asset:"Grúa Hidráulica GH-01",type:"CORRECTIVO", status:"ABIERTA",      tech:"Pendiente",    cc:"CC-MANTTO", priority:"CRÍTICA", parts:5, est:8.0,  real:0 },
  { id:"WO-2026-0079", asset:"Amoladora AN-0041",    type:"INSPECCION", status:"CERRADA",       tech:"Luis Torres",  cc:"CC-OBRAS",  priority:"MEDIA",   parts:0, est:0.5,  real:0.5 },
  { id:"WO-2026-0078", asset:"Compresor CP-12",      type:"PREVENTIVO", status:"PROGRAMADA",   tech:"Juan Pérez",   cc:"CC-MANTTO", priority:"NORMAL",  parts:2, est:2.0,  real:0 },
];
 
const CHART_STOCK = [
  { mes:"Nov", entradas:142, salidas:98 },
  { mes:"Dic", entradas:189, salidas:145 },
  { mes:"Ene", entradas:96,  salidas:88 },
  { mes:"Feb", entradas:134, salidas:107 },
  { mes:"Mar", entradas:215, salidas:180 },
  { mes:"Abr", entradas:178, salidas:162 },
  { mes:"May", entradas:93,  salidas:77 },
];
 
const CHART_ABC = [
  { name:"A - Críticos",   value:18,  fill:"#ef4444" },
  { name:"B - Importantes",value:32,  fill:"#f59e0b" },
  { name:"C - Rutinarios", value:50,  fill:"#10b981" },
];
 
const CHART_COST = [
  { mes:"Nov", valor:184200 },
  { mes:"Dic", valor:221400 },
  { mes:"Ene", valor:168900 },
  { mes:"Feb", valor:195300 },
  { mes:"Mar", valor:248100 },
  { mes:"Abr", valor:231600 },
  { mes:"May", valor:112400 },
];
 
const PENDING_APPROVALS = [
  { id:"APR-081", type:"Orden Compra",    desc:"500 und Disco Corte 4.5\"", amount:1900, level:"L2", requestor:"Almacén Lima" },
  { id:"APR-082", type:"Baja de Activo",  desc:"Amoladora AN-0041 dañada",  amount:380,  level:"L3", requestor:"Mantto" },
  { id:"APR-083", type:"Transferencia",   desc:"200m Cable THW WH-LIM→ICA", amount:470,  level:"L1", requestor:"Obras Ica" },
];

const FULFILLMENT_REQUESTS = [
  {
    id:"WRQ-20260518-8A1D", type:"Abastecimiento obra", workerId:"TR-0441", worker:"Carlos Ramos",
    area:"CC-OBRAS-ICA", warehouse:"WH-LIM-01", priority:"CRÍTICA", status:"PENDING_APPROVAL",
    needAt:"2026-05-19 09:30", lines:4, requested:32, approved:0, checklist:1/4,
    notes:"Frente eléctrico nivel 2. Requiere cable, EPP y discos de corte."
  },
  {
    id:"WRQ-20260518-3F92", type:"Herramientas + EPP", workerId:"TR-0188", worker:"Rosa Quispe",
    area:"CC-OBRAS-ICA", warehouse:"WH-LIM-01", priority:"ALTA", status:"READY",
    needAt:"2026-05-19 10:00", lines:3, requested:6, approved:6, checklist:4/4,
    notes:"Entrega programada antes del arranque de cuadrilla metalmecánica."
  },
  {
    id:"WRQ-20260517-6C21", type:"Mantenimiento", workerId:"TR-0098", worker:"Pedro Llanos",
    area:"CC-MANTTO", warehouse:"WH-MAN-01", priority:"NORMAL", status:"PICKING",
    needAt:"2026-05-19 11:30", lines:5, requested:12, approved:12, checklist:2/4,
    notes:"Repuestos para WO-2026-0081 y aceite hidráulico."
  },
];

const DISPATCH_WAVES = [
  {
    id:"DSP-20260518-1A9F", requestId:"WRQ-20260518-3F92", worker:"Rosa Quispe", route:"Z-A > R01 > L2",
    status:"STAGED", preparedBy:"almacenero2", picked:6, total:6, evidence:2, dock:"Counter 02"
  },
  {
    id:"DSP-20260518-7B11", requestId:"WRQ-20260517-6C21", worker:"Pedro Llanos", route:"Z-D > R03 > L1",
    status:"PICKING", preparedBy:"almacenero1", picked:8, total:12, evidence:1, dock:"Stage Mantenimiento"
  },
  {
    id:"DSP-20260518-9C44", requestId:"WRQ-20260518-8A1D", worker:"Carlos Ramos", route:"Z-A > R02 > L1",
    status:"ALLOCATED", preparedBy:"sistema", picked:0, total:32, evidence:0, dock:"Pendiente"
  },
];

const EVIDENCE_FEED = [
  {
    id:"EVD-2201", entity:"DSP-20260518-1A9F", event:"DELIVERY", worker:"Rosa Quispe",
    channel:"MOBILE", file:"entrega_rosa_quispe_01.jpg", notes:"Recepción con foto frontal + EPP completo", time:"2026-05-18 08:42"
  },
  {
    id:"EVD-2202", entity:"WRQ-20260517-6C21", event:"PICKING", worker:"Pedro Llanos",
    channel:"WEB", file:"picking_repuestos_wo81.png", notes:"Checklist picking firmado por almacenero", time:"2026-05-18 08:15"
  },
  {
    id:"EVD-2203", entity:"TKN-2026-0041", event:"INCIDENT", worker:"Carlos Ramos",
    channel:"MOBILE", file:"incidencia_amoladora_0041.jpg", notes:"Herramienta vencida sin devolución oportuna", time:"2026-05-18 07:58"
  },
];

const WORKER_OPERATION_CARDS = [
  {
    id:"TR-0441", name:"Carlos Ramos", role:"Operario electricista", openDocs:2, pendingReturns:1,
    evidence:4, status:"RIESGO", lastEvent:"Solicitud crítica pendiente de aprobación"
  },
  {
    id:"TR-0188", name:"Rosa Quispe", role:"Capataz metalmecánica", openDocs:1, pendingReturns:0,
    evidence:7, status:"OK", lastEvent:"Entrega preparada y lista en counter"
  },
  {
    id:"TR-0098", name:"Pedro Llanos", role:"Técnico mantenimiento", openDocs:1, pendingReturns:0,
    evidence:3, status:"PICKING", lastEvent:"Despacho parcial de WO-2026-0081"
  },
];

const OPERATIONAL_PROMPTS = [
  "Prioriza solicitudes por criticidad, ATP, fecha requerida y bloqueo del trabajador.",
  "Detecta entregas con evidencia incompleta o checklist incumplido antes de autorizar salida.",
  "Secuencia el picking por zona, rack y nivel minimizando recorrido y respetando FIFO.",
  "Resume riesgos operativos del turno: faltantes, incidentes, vencidos y sobreocupación."
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtMoney = (n) => `$ ${Number(n).toLocaleString("es-CO",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const fmtDate  = (s) => s ? new Date(s).toLocaleDateString("es-CO") : "—";
const tokenStatusBadge = (s) => {
  if(s==="OVERDUE")    return <span className="badge badge-danger">VENCIDO</span>;
  if(s==="DUE_SOON")   return <span className="badge badge-warn">POR VENCER</span>;
  if(s==="IN_CUSTODY") return <span className="badge badge-info">EN CUSTODIA</span>;
  if(s==="MAINTENANCE")return <span className="badge badge-purple">MANTENIMIENTO</span>;
  if(s==="RETURNED")   return <span className="badge badge-ok">DEVUELTO</span>;
  return <span className="badge badge-gray">{s}</span>;
};
const stockBadge = (s) => {
  if(s==="CRÍTICO") return <span className="badge badge-danger">CRÍTICO</span>;
  if(s==="BAJO")    return <span className="badge badge-warn">BAJO</span>;
  if(s==="MANT")    return <span className="badge badge-purple">EN MANT.</span>;
  return <span className="badge badge-ok">OK</span>;
};
const movTypeColor = (t) => {
  if(t.includes("ISSUE"))   return C.warn;
  if(t.includes("RECEIPT")) return C.accent3;
  if(t.includes("DAMAGE")||t.includes("LOST")) return C.danger;
  if(t.includes("TOOL"))    return C.accent;
  return C.textDim;
};
const requestBadge = (s) => {
  if(s==="PENDING_APPROVAL") return <span className="badge badge-warn">POR APROBAR</span>;
  if(s==="PICKING")          return <span className="badge badge-info">PICKING</span>;
  if(s==="READY")            return <span className="badge badge-ok">LISTO</span>;
  if(s==="DELIVERED")        return <span className="badge badge-ok">ENTREGADO</span>;
  if(s==="CANCELLED")        return <span className="badge badge-danger">CANCELADO</span>;
  return <span className="badge badge-gray">{s}</span>;
};
const dispatchBadge = (s) => {
  if(s==="ALLOCATED") return <span className="badge badge-gray">ASIGNADO</span>;
  if(s==="PICKING")   return <span className="badge badge-info">PICKING</span>;
  if(s==="STAGED")    return <span className="badge badge-warn">EN MESA</span>;
  if(s==="READY")     return <span className="badge badge-ok">LISTO</span>;
  if(s==="DELIVERED") return <span className="badge badge-ok">ENTREGADO</span>;
  return <span className="badge badge-gray">{s}</span>;
};
 
// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function ApexLogixCore({
  apiBase = "/api/v1",
  token = "",
  tenantId = "",
  onStatus,
  onJournalPosted,
}: InventoryPanelProps = {}) {
  const [activeView,  setActiveView]  = useState("dashboard");
  const [railExp,     setRailExp]     = useState(false);
  const [geminiKey,   setGeminiKey]   = useState("");
  const [aiResponse,  setAiResponse]  = useState("Motor IA en espera. Ingresa tu API Key de Gemini y pulsa Analizar.");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiQuestion,  setAiQuestion]  = useState("Detecta riesgos críticos de stock, tokens vencidos y recomendaciones de mantenimiento para mayo 2026.");
  const [search,      setSearch]      = useState("");
  const [filterCat,   setFilterCat]   = useState("Todos");
  const [filterWH,    setFilterWH]    = useState("Todos");
  const [selectedTab, setSelectedTab] = useState(0);
  const [showNewMovement, setShowNewMovement] = useState(false);
  const [showNewToken,    setShowNewToken]    = useState(false);
  const [newMov, setNewMov] = useState({
    sku:"",
    qty:"",
    type:"261_GOODS_ISSUE_WORK_ORDER",
    cc:"",
    wh:"WH-LIM-01",
    inventoryAccount:"2011",
    cogsAccount:"6911",
    adjustmentAccount:"7599",
  });
  const [newToken, setNewToken] = useState({ tool:"", worker:"", cc:"", days:"7" });
  const [apiBaseUrl, setApiBaseUrl] = useState(apiBase);
  const [movements, setMovements] = useState(MOVEMENTS);
  const [inventory,  setInventory]  = useState(INVENTORY);
  const [warehouses, setWarehouses] = useState(WAREHOUSES);
  const [chartAccounts, setChartAccounts] = useState<LedgerAccount[]>(FALLBACK_LEDGER_ACCOUNTS);
  const [tokens,     setTokens]     = useState(TOOL_TOKENS);
  const [workOrders, setWorkOrders] = useState(WORK_ORDERS);
  const [requests,   setRequests]   = useState(FULFILLMENT_REQUESTS);
  const [dispatches, setDispatches] = useState(DISPATCH_WAVES);
  const [evidences,  setEvidences]  = useState(EVIDENCE_FEED);
  const [workerOps,  setWorkerOps]  = useState(WORKER_OPERATION_CARDS);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showEntregaDialog,    setShowEntregaDialog]    = useState(false);
  const [showDevolucionDialog, setShowDevolucionDialog] = useState(false);
  const [selEntregaIds,  setSelEntregaIds]  = useState<Set<number>>(new Set());
  const [selDevIds,      setSelDevIds]      = useState<Set<number>>(new Set());
  const [entWorker, setEntWorker] = useState("");
  const [entObra,   setEntObra]   = useState("");
  const [entSec,    setEntSec]    = useState("");
  const [entCat,    setEntCat]    = useState("");
  const [entSearch, setEntSearch] = useState("");
  const [devWorker, setDevWorker] = useState("");
  const [devObra,   setDevObra]   = useState("");
  const [devSearch, setDevSearch] = useState("");
  const [devSoloVenc, setDevSoloVenc] = useState(false);
  const [devSoloFoto, setDevSoloFoto] = useState(false);
  const [entLastId,  setEntLastId]  = useState<number|null>(null);
  const [devLastId,  setDevLastId]  = useState<number|null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState("");
  const [evidenceFileBlob, setEvidenceFileBlob] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(PENDING_APPROVALS);
  const [requestForm, setRequestForm] = useState({
    type:"Abastecimiento obra", worker:"", workerId:"", area:"", warehouse:"WH-LIM-01",
    priority:"NORMAL", needAt:"2026-05-19 09:00", notes:"",
    lines:[{ sku:"", description:"", qty:"", uom:"UND" }]
  });
  const [evidenceForm, setEvidenceForm] = useState({
    entity:"", event:"DELIVERY", worker:"", channel:"WEB", file:"", notes:"", checklist:"Evidencia completa"
  });
  const [alerts,     setAlerts]     = useState([
    { id:1, type:"DANGER", msg:"Amoladora TKN-2026-0041 vencida — Carlos Ramos no ha devuelto desde 2026-05-19" },
    { id:2, type:"WARN",   msg:"Stock BAJO: Disco corte 4.5\" — 148 und (mín 200). Generar OC." },
    { id:3, type:"WARN",   msg:"Aceite HYD-46 bajo punto de reorden — 85 lt (mín 120)" },
    { id:4, type:"DANGER", msg:"Motor Bomba 3HP stock CRÍTICO — solo 2 und disponibles" },
  ]);

  const requestHeaders = useMemo(() => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  }), [tenantId, token]);

  const jsonHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    ...requestHeaders,
  }), [requestHeaders]);

  const ledgerAccountOptions = useMemo(() => {
    const merged = new Map(FALLBACK_LEDGER_ACCOUNTS.map(account => [account.code, account]));
    chartAccounts.forEach(account => {
      if (account?.code) merged.set(account.code, account);
    });
    return Array.from(merged.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [chartAccounts]);

  const apiJson = async (url: string, options: RequestInit = {}) => {
    const { headers, ...restOptions } = options;
    const res = await fetch(url, {
      ...restOptions,
      headers: { ...jsonHeaders, ...(headers as Record<string, string> | undefined || {}) },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  };
 
  // Inyectar CSS global
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    setApiBaseUrl(apiBase || "/api/v1");
  }, [apiBase]);

  useEffect(() => {
    let cancelled = false;
    const loadOperationalData = async () => {
      if (!token || !tenantId) return;
      try {
        const [productsRes, warehousesRes, accountsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/inventory/products?limit=300`, { headers: requestHeaders }),
          fetch(`${apiBaseUrl}/inventory/warehouses?limit=100`, { headers: requestHeaders }),
          fetch(`${apiBaseUrl}/master/chart-accounts?limit=500`, { headers: requestHeaders }),
        ]);
        if (cancelled) return;

        let normalizedWarehouses = warehouses;
        if (warehousesRes.ok) {
          const data = await warehousesRes.json();
          if (Array.isArray(data) && data.length) {
            normalizedWarehouses = data.map((row, index) => ({
              id:row.code || row.id,
              backendId:row.id,
              name:row.name || row.code || `Almacén ${index + 1}`,
              site:"Backend",
              cap:100,
              occ:0,
              type:"Productivo",
            }));
            setWarehouses(normalizedWarehouses);
          }
        }

        if (productsRes.ok) {
          const data = await productsRes.json();
          if (Array.isArray(data) && data.length) {
            const fallbackWarehouse = normalizedWarehouses[0]?.id || "WH-LIM-01";
            setInventory(prev => {
              const merged = new Map(prev.map(item => [item.sku, item]));
              data.forEach((row, index) => {
                const current = merged.get(row.sku) || {};
                merged.set(row.sku, {
                  id:current.id || row.id || `API-${index + 1}`,
                  backendId:row.id,
                  sku:row.sku,
                  desc:row.name || current.desc || row.sku,
                  cat:current.cat || "Producto",
                  wh:current.wh || fallbackWarehouse,
                  stock:current.stock ?? 0,
                  reorder:current.reorder ?? 0,
                  unit:row.unit_of_measure || current.unit || "NIU",
                  cost:normalizeApiNumber(row.default_cost ?? current.cost),
                  abc:current.abc || "C",
                  status:current.status || "OK",
                  loc:current.loc || "API",
                });
              });
              return Array.from(merged.values());
            });
          }
        }

        if (accountsRes.ok) {
          const data = await accountsRes.json();
          if (Array.isArray(data) && data.length) {
            setChartAccounts(data.map(row => ({
              code:String(row.code || ""),
              name:String(row.name || row.code || "Cuenta"),
              statement:row.statement,
              nature:row.nature,
              accepts_cost_center:row.accepts_cost_center,
            })).filter(account => account.code));
          }
        }

        onStatus?.("Inventario conectado a productos, almacenes y plan contable.");
      } catch (error) {
        onStatus?.(`Inventario en modo local: ${error instanceof Error ? error.message : "backend no disponible"}`);
      }
    };
    loadOperationalData();
    return () => { cancelled = true; };
  }, [apiBaseUrl, requestHeaders, tenantId, token]);

  // ─── GEMINI AI ─────────────────────────────────────────────────────────────
  const runGemini = useCallback(async () => {
    if (!geminiKey.trim()) { setAiResponse("⚠ Ingresa tu API Key de Gemini en el campo superior."); return; }
    setAiLoading(true);
    const context = {
      inventario: inventory.map(i=>({sku:i.sku,stock:i.stock,reorder:i.reorder,status:i.status,abc:i.abc})),
      tokens: tokens.map(t=>({id:t.id,tool:t.tool,worker:t.worker,status:t.status,due:t.due})),
      workOrders: workOrders.map(w=>({id:w.id,asset:w.asset,type:w.type,status:w.status,priority:w.priority})),
      requests: requests.map(r=>({id:r.id,worker:r.worker,priority:r.priority,status:r.status,needAt:r.needAt,lines:r.lines})),
      dispatches: dispatches.map(d=>({id:d.id,requestId:d.requestId,status:d.status,picked:d.picked,total:d.total,dock:d.dock})),
      evidences: evidences.slice(0,8).map(e=>({entity:e.entity,event:e.event,worker:e.worker,channel:e.channel})),
      pendingApprovals: pendingApprovals,
    };
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ contents:[{ parts:[
            { text: MASTER_PROMPT + "\n\nContexto actual:\n" + JSON.stringify(context,null,2) + "\n\nPregunta del operador: " + aiQuestion }
          ]}]})
        }
      );
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
      setAiResponse(text);
    } catch(e) {
      setAiResponse("Error conectando con Gemini: " + e.message);
    } finally { setAiLoading(false); }
  }, [geminiKey, aiQuestion, inventory, tokens, workOrders, requests, dispatches, evidences]);
 
  const ensureProductBackendId = async (item) => {
    if (isBackendId(item?.backendId)) return item.backendId;
    if (!tenantId) throw new Error("tenant_id no disponible");

    const created = await apiJson(`${apiBaseUrl}/inventory/products`, {
      method:"POST",
      body:JSON.stringify({
        tenant_id:tenantId,
        sku:item.sku,
        name:item.desc || item.sku,
        unit_of_measure:item.unit || "NIU",
        default_cost:item.cost || 0,
        default_cost_account:newMov.inventoryAccount,
      }),
    });

    setInventory(prev => prev.map(product => product.sku === item.sku ? { ...product, backendId:created.id } : product));
    return created.id;
  };

  const ensureWarehouseBackendId = async (warehouse) => {
    if (isBackendId(warehouse?.backendId)) return warehouse.backendId;
    if (!tenantId) throw new Error("tenant_id no disponible");

    const created = await apiJson(`${apiBaseUrl}/inventory/warehouses`, {
      method:"POST",
      body:JSON.stringify({
        tenant_id:tenantId,
        code:warehouse.id,
        name:warehouse.name || warehouse.id,
      }),
    });

    setWarehouses(prev => prev.map(item => item.id === warehouse.id ? { ...item, backendId:created.id } : item));
    return created.id;
  };

  // ─── REGISTRAR MOVIMIENTO ──────────────────────────────────────────────────
  const saveMovement = async () => {
    if(!newMov.sku||!newMov.qty) return;
    const id = `MOV-${String(movements.length+1).padStart(3,"0")}`;
    const item = inventory.find(i=>i.sku===newMov.sku);
    const warehouse = warehouses.find(w=>w.id===newMov.wh) || warehouses[0];
    const quantity = Number(newMov.qty);
    const cost = item ? item.cost * quantity : 0;
    const movementType = movementToLedgerType(newMov.type);
    const today = new Date();
    let postedEntryId = "";

    try {
      if (token && tenantId && item && warehouse) {
        const productId = await ensureProductBackendId(item);
        const warehouseId = await ensureWarehouseBackendId(warehouse);
        const payload = await apiJson(`${apiBaseUrl}/inventory/movements`, {
          method:"POST",
          body:JSON.stringify({
            tenant_id:tenantId,
            product_id:productId,
            warehouse_id:warehouseId,
            movement_type:movementType,
            qty:quantity,
            unit_cost:item.cost || 0,
            movement_reference:id,
            source_document:newMov.type,
            post_cost_entry:true,
            year:today.getFullYear(),
            month:today.getMonth()+1,
            cogs_account:newMov.cogsAccount,
            inventory_account:newMov.inventoryAccount,
            adjustment_account:newMov.adjustmentAccount,
            cost_center:newMov.cc || "INV-OPS",
          }),
        });
        postedEntryId = payload?.cost_entry?.entry_id || "";
        if (postedEntryId) await onJournalPosted?.();
      }
    } catch (error) {
      onStatus?.(`Movimiento local registrado; Libro Diario pendiente: ${error instanceof Error ? error.message.slice(0, 160) : "error backend"}`);
    }

    setMovements(prev=>[{ id, date:today.toISOString().slice(0,10), ...newMov, qty:quantity, user:"operador", cost, journalEntryId:postedEntryId },  ...prev]);
    if(newMov.type.includes("ISSUE")||newMov.type.includes("CHECKOUT")){
      setInventory(prev=>prev.map(i=>i.sku===newMov.sku?{...i,stock:Math.max(0,i.stock-quantity)}:i));
    }
    setShowNewMovement(false);
    setNewMov({
      sku:"",
      qty:"",
      type:"261_GOODS_ISSUE_WORK_ORDER",
      cc:"",
      wh:"WH-LIM-01",
      inventoryAccount:"2011",
      cogsAccount:"6911",
      adjustmentAccount:"7599",
    });
    if (postedEntryId) {
      onStatus?.(`Movimiento ${id} posteado al Libro Diario con asiento ${postedEntryId.slice(0,8)}.`);
    }
  };
 
  // ─── EMITIR TOKEN ──────────────────────────────────────────────────────────
  const saveToken = () => {
    if(!newToken.tool||!newToken.worker) return;
    const seq = String(tokens.length+43).padStart(4,"0");
    const id = `TKN-2026-${seq}`;
    const issued = "2026-05-18";
    const dueDate = new Date("2026-05-18");
    dueDate.setDate(dueDate.getDate()+Number(newToken.days));
    const due = dueDate.toISOString().slice(0,10);
    setTokens(prev=>[{ id, sku:"HERRAMIENTA", tool:newToken.tool, worker:newToken.worker,
      cc:newToken.cc, issued, due, status:"IN_CUSTODY", hours:0, maxHours:80 }, ...prev]);
    setShowNewToken(false);
    setNewToken({ tool:"",worker:"",cc:"",days:"7" });
  };

  const updateRequestLine = (idx, field, value) => {
    setRequestForm(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i===idx ? { ...line, [field]: value } : line)
    }));
  };
  const addRequestLine = () => {
    setRequestForm(prev => ({
      ...prev,
      lines: [...prev.lines, { sku:"", description:"", qty:"", uom:"UND" }]
    }));
  };
  const saveWarehouseRequest = async () => {
    const filledLines = requestForm.lines.filter(l => l.sku && l.description && Number(l.qty) > 0);
    if(!requestForm.worker || !requestForm.area || filledLines.length===0) return;
    try {
      const payload = {
        legal_entity_id: "11111111-1111-1111-1111-111111111111",
        warehouse_id: requestForm.warehouse,
        request_type: requestForm.type,
        requester_type: "WORKER",
        requester_id: requestForm.workerId || undefined,
        requester_name: requestForm.worker,
        worker_id: requestForm.workerId || undefined,
        worker_name: requestForm.worker,
        cost_center_id: requestForm.area,
        priority: requestForm.priority,
        needed_at: requestForm.needAt.replace(" ", "T"),
        notes: requestForm.notes,
        lines: filledLines.map(l => ({
          sku_id: l.sku,
          description: l.description,
          requested_qty: Number(l.qty),
          uom_code: l.uom || "UND",
        })),
      };
      const created = await apiJson(`${apiBaseUrl}/warehouse/requests`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setRequests(prev => [{
        id: created.request_number || created.request_id,
        type:requestForm.type,
        workerId:requestForm.workerId || `TR-${String(prev.length+451).padStart(4,"0")}`,
        worker:requestForm.worker,
        area:requestForm.area,
        warehouse:requestForm.warehouse,
        priority:requestForm.priority,
        status:created.status || "PENDING_APPROVAL",
        needAt:requestForm.needAt,
        lines:filledLines.length,
        requested:filledLines.reduce((acc,l)=>acc+Number(l.qty),0),
        approved:0,
        checklist:0,
        notes:requestForm.notes
      }, ...prev]);
    } catch {
      const id = `WRQ-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.random().toString(16).slice(2,6).toUpperCase()}`;
      setRequests(prev => [{
        id,
        type:requestForm.type,
        workerId:requestForm.workerId || `TR-${String(prev.length+451).padStart(4,"0")}`,
        worker:requestForm.worker,
        area:requestForm.area,
        warehouse:requestForm.warehouse,
        priority:requestForm.priority,
        status:"PENDING_APPROVAL",
        needAt:requestForm.needAt,
        lines:filledLines.length,
        requested:filledLines.reduce((acc,l)=>acc+Number(l.qty),0),
        approved:0,
        checklist:0,
        notes:requestForm.notes
      }, ...prev]);
    }
    setShowRequestModal(false);
    setRequestForm({
      type:"Abastecimiento obra", worker:"", workerId:"", area:"", warehouse:"WH-LIM-01",
      priority:"NORMAL", needAt:"2026-05-19 09:00", notes:"",
      lines:[{ sku:"", description:"", qty:"", uom:"UND" }]
    });
  };
  const approveRequest = async (id) => {
    try {
      await apiJson(`${apiBaseUrl}/warehouse/requests/${id}/approval`, {
        method: "POST",
        body: JSON.stringify({ status:"APPROVED", approver_id:"director.ops", approver_name:"Director Operaciones" }),
      });
    } catch {}
    setRequests(prev => prev.map(r => r.id===id ? { ...r, status:"APPROVED", approved:r.requested, checklist:1 } : r));
  };
  const createDispatch = async (reqId) => {
    const req = requests.find(r=>r.id===reqId);
    if(!req) return;
    try {
      const created = await apiJson(`${apiBaseUrl}/warehouse/dispatches`, {
        method: "POST",
        body: JSON.stringify({
          request_id: req.id,
          legal_entity_id: "11111111-1111-1111-1111-111111111111",
          warehouse_id: req.warehouse,
          prepared_by: "planner.wms",
          delivered_to_id: req.workerId,
          delivered_to_name: req.worker,
          delivery_mode: "COUNTER",
        }),
      });
      setDispatches(prev => [{
        id:created.dispatch_number || created.dispatch_id, requestId:req.id, worker:req.worker, route:"Z-A > R01 > L1", status:created.status || "ALLOCATED",
        preparedBy:"planner.wms", picked:0, total:req.requested, evidence:0, dock:"Mesa 01"
      }, ...prev]);
    } catch {
      const newId = `DSP-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.random().toString(16).slice(2,6).toUpperCase()}`;
      setDispatches(prev => [{
        id:newId, requestId:req.id, worker:req.worker, route:"Z-A > R01 > L1", status:"ALLOCATED",
        preparedBy:"planner.wms", picked:0, total:req.requested, evidence:0, dock:"Mesa 01"
      }, ...prev]);
    }
    setRequests(prev => prev.map(r => r.id===reqId ? { ...r, status:"PICKING", checklist:2 } : r));
  };
  const stageDispatch = async (dispatchId) => {
    const dispatch = dispatches.find(d => d.id === dispatchId);
    try {
      if (dispatch) {
        const detail = await apiJson(`${apiBaseUrl}/warehouse/dispatches/${dispatchId}`);
        const lines = (detail.lines || []).map(line => ({
          dispatch_line_id: line.id,
          picked_qty: line.delivered_qty || line.picked_qty || 1,
          bin_id: line.bin_id || null,
          lot_number: line.lot_number || null,
          serial_number: line.serial_number || null,
          notes: "Picking confirmado desde ApexLogix UI",
        }));
        if (lines.length) {
          await apiJson(`${apiBaseUrl}/warehouse/dispatches/${dispatchId}/pick`, {
            method: "POST",
            body: JSON.stringify({ picked_by:"almacenero.web", checklist:[{label:"Picking validado",completed:true}], lines }),
          });
        }
      }
    } catch {}
    setDispatches(prev => prev.map(d => d.id===dispatchId ? { ...d, status:"STAGED", picked:d.total, evidence:d.evidence+1 } : d));
  };
  const deliverDispatch = async (dispatchId) => {
    const dispatch = dispatches.find(d => d.id === dispatchId);
    try {
      if (dispatch) {
        const detail = await apiJson(`${apiBaseUrl}/warehouse/dispatches/${dispatchId}`);
        const lines = (detail.lines || []).map(line => ({
          dispatch_line_id: line.id,
          delivered_qty: line.picked_qty || line.delivered_qty || 1,
          notes: "Entrega confirmada desde ApexLogix UI",
        }));
        if (lines.length) {
          await apiJson(`${apiBaseUrl}/warehouse/dispatches/${dispatchId}/deliver`, {
            method: "POST",
            body: JSON.stringify({
              delivered_by:"almacenero.web",
              received_by_id: dispatch.requestId,
              received_by_name: dispatch.worker,
              signature_ref: `SIG-${dispatchId}`,
              checklist:[{label:"Entrega confirmada",completed:true}],
              lines,
            }),
          });
        }
      }
    } catch {}
    setDispatches(prev => prev.map(d => d.id===dispatchId ? { ...d, status:"DELIVERED", picked:d.total, evidence:d.evidence+1 } : d));
    const reqRef = dispatch?.requestId;
    if(reqRef){
      setRequests(prev => prev.map(r => r.id===reqRef ? { ...r, status:"DELIVERED", checklist:4 } : r));
    }
  };
  const saveEvidence = async () => {
    if(!evidenceForm.entity || !evidenceForm.worker || !evidenceFileName) return;
    try {
      let uploaded = null;
      if (evidenceFileBlob) {
        const form = new FormData();
        form.append("file", evidenceFileBlob);
        const res = await fetch(`${apiBaseUrl}/evidence/upload`, { method:"POST", body: form });
        if (res.ok) uploaded = await res.json();
      }
      const created = await apiJson(`${apiBaseUrl}/evidence/attachments`, {
        method: "POST",
        body: JSON.stringify({
          legal_entity_id: "11111111-1111-1111-1111-111111111111",
          entity_type: "DISPATCH",
          entity_id: evidenceForm.entity,
          event_type: evidenceForm.event,
          file_name: uploaded?.file_name || evidenceFileName,
          file_url: uploaded?.file_url || evidenceFileName,
          mime_type: uploaded?.mime_type || "image/jpeg",
          worker_name: evidenceForm.worker,
          source_channel: evidenceForm.channel,
          checklist_data: { summary: evidenceForm.checklist },
          notes: evidenceForm.notes || evidenceForm.checklist,
          created_by: "apexlogix.ui",
        }),
      });
      setEvidences(prev => [{
        id:created.evidence_id || `EVD-${String(prev.length+2204).padStart(4,"0")}`,
        entity:evidenceForm.entity, event:evidenceForm.event, worker:evidenceForm.worker,
        channel:evidenceForm.channel, file:uploaded?.file_name || evidenceFileName,
        notes:evidenceForm.notes || evidenceForm.checklist,
        time:new Date().toISOString().slice(0,16).replace("T"," ")
      }, ...prev]);
    } catch {
      const id = `EVD-${String(evidences.length+2204).padStart(4,"0")}`;
      setEvidences(prev => [{
        id, entity:evidenceForm.entity, event:evidenceForm.event, worker:evidenceForm.worker,
        channel:evidenceForm.channel, file:evidenceFileName, notes:evidenceForm.notes || evidenceForm.checklist,
        time:new Date().toISOString().slice(0,16).replace("T"," ")
      }, ...prev]);
    }
    setShowEvidenceModal(false);
    setEvidenceFileName("");
    setEvidenceFileBlob(null);
    setEvidenceForm({ entity:"", event:"DELIVERY", worker:"", channel:"WEB", file:"", notes:"", checklist:"Evidencia completa" });
  };

  // ─── FILTROS DE INVENTARIO ─────────────────────────────────────────────────
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchSearch = !search || item.desc.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCat==="Todos" || item.cat===filterCat;
      const matchWH  = filterWH==="Todos"  || item.wh===filterWH;
      return matchSearch && matchCat && matchWH;
    });
  }, [inventory, search, filterCat, filterWH]);
 
  // ─── MÉTRICAS ─────────────────────────────────────────────────────────────
  const metrics = useMemo(() => ({
    totalSkus:       inventory.length,
    stockCritico:    inventory.filter(i=>i.status==="CRÍTICO").length,
    stockBajo:       inventory.filter(i=>i.status==="BAJO").length,
    tokensVencidos:  tokens.filter(t=>t.status==="OVERDUE").length,
    tokensPorVencer: tokens.filter(t=>t.status==="DUE_SOON").length,
    tokensActivos:   tokens.filter(t=>t.status==="IN_CUSTODY").length,
    woAbiertas:      workOrders.filter(w=>w.status!=="CERRADA").length,
    valorInventario: inventory.reduce((a,i)=>a+i.stock*i.cost,0),
    reqPendientes:   requests.filter(r=>["PENDING_APPROVAL","APPROVED","PICKING","READY"].includes(r.status)).length,
    despachosActivos:dispatches.filter(d=>["ALLOCATED","PICKING","STAGED","READY"].includes(d.status)).length,
    evidenciasHoy:   evidences.length,
    aprobaciones:    pendingApprovals.length,
  }), [inventory, tokens, workOrders, requests, dispatches, evidences, pendingApprovals]);
 
  // ─── HEATMAP OCUPACIÓN ────────────────────────────────────────────────────
  const heatmapCells = useMemo(() => {
    return Array.from({length:60},(_,i)=>({
      id:i, occ: Math.floor(Math.random()*100),
      color: i%7===0?"#ef444455":i%11===0?"#f59e0b55":i%3===0?"#10b98133":"#00d4ff22"
    }));
  }, []);
 
  // ─── NAVEGACIÓN ───────────────────────────────────────────────────────────
  const railItems = [
    { id:"dashboard", label:"Dashboard",    icon:BarChart3 },
    { id:"inventory", label:"Inventario",   icon:Package },
    { id:"fulfillment",label:"Operación",   icon:Truck },
    { id:"evidence",  label:"Evidencias",   icon:Eye },
    { id:"tokens",    label:"Tokens Tools", icon:QrCode },
    { id:"movements", label:"Movimientos",  icon:ArrowLeftRight },
    { id:"eam",       label:"EAM / WO",     icon:Wrench },
    { id:"warehouses",label:"Almacenes",    icon:Warehouse },
    { id:"approvals", label:"Aprobaciones", icon:CheckSquare },
    { id:"ai",        label:"IA Gemini",    icon:Brain },
    { id:"reports",   label:"Reportes",     icon:FileText },
    { id:"settings",  label:"Config",       icon:Settings },
  ];
 
  // ═══════════════════════ RENDERS DE SECCIÓN ════════════════════════════════
 
  const renderDashboard = () => (
    <div className="fadein">
      {/* Alertas críticas */}
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
        {alerts.map(a=>(
          <div key={a.id} className={a.type==="DANGER"?"alert-strip":"warn-strip"}>
            <AlertTriangle size={14}/> {a.msg}
            <button className="btn btn-xs btn-ghost" style={{marginLeft:"auto"}} onClick={()=>setAlerts(p=>p.filter(x=>x.id!==a.id))}>✕</button>
          </div>
        ))}
      </div>
 
      {/* Métricas */}
      <div className="metric-grid">
        {[
          { label:"SKUs Totales",     val:metrics.totalSkus,       icon:Package,    color:C.accent,  delta:"+2 este mes" },
          { label:"Stock Crítico",    val:metrics.stockCritico,    icon:AlertCircle,color:C.danger,  delta:"requiere acción" },
          { label:"Stock Bajo",       val:metrics.stockBajo,       icon:AlertTriangle,color:C.warn,  delta:"3 órdenes pend." },
          { label:"Tokens Activos",   val:metrics.tokensActivos,   icon:QrCode,     color:C.accent3, delta:"en campo" },
          { label:"Tokens Vencidos",  val:metrics.tokensVencidos,  icon:Clock,      color:C.danger,  delta:"⚠ sin retorno" },
          { label:"WO Abiertas",      val:metrics.woAbiertas,      icon:Wrench,     color:C.accent2, delta:"1 crítica" },
          { label:"Req. Operativos",  val:metrics.reqPendientes,   icon:ClipboardList,color:C.warn,  delta:"flujo almacén" },
          { label:"Despachos",        val:metrics.despachosActivos,icon:Truck,      color:C.accent,  delta:"picking / entrega" },
          { label:"Aprobaciones",     val:metrics.aprobaciones,    icon:CheckCircle2,color:C.warn,   delta:"pendientes" },
          { label:"Valor Inventario", val:fmtMoney(metrics.valorInventario),icon:DollarSign,color:C.accent,delta:"valoriz. PPP" },
          { label:"Evidencias",       val:metrics.evidenciasHoy,   icon:Eye,        color:C.accent3, delta:"capturas activas" },
        ].map(m=>(
          <div className="metric-card" key={m.label} style={{borderLeft:`3px solid ${m.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <span className="metric-label">{m.label}</span>
              <m.icon size={14} style={{color:m.color,opacity:.7}}/>
            </div>
            <div className="metric-val" style={{color:m.color}}>{m.val}</div>
            <div className="metric-delta" style={{color:m.color,opacity:.7}}>
              <ArrowUpRight size={11}/>{m.delta}
            </div>
          </div>
        ))}
      </div>
 
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        {/* Entradas vs Salidas */}
        <div className="card">
          <div className="section-title"><Activity size={13}/>Entradas vs Salidas</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={CHART_STOCK} barSize={10}>
              <XAxis dataKey="mes" tick={{fill:C.textMute,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.textMute,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
              <Bar dataKey="entradas" fill={C.accent3} radius={[3,3,0,0]}/>
              <Bar dataKey="salidas"  fill={C.accent}  radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
 
        {/* Clasificación ABC */}
        <div className="card">
          <div className="section-title"><Layers size={13}/>Clasificación ABC</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={CHART_ABC} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                {CHART_ABC.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Pie>
              <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}/>
              <Legend iconSize={8} wrapperStyle={{fontSize:11}}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
 
        {/* Valor inventario */}
        <div className="card">
          <div className="section-title"><DollarSign size={13}/>Valorización Inventario</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={CHART_COST}>
              <defs>
                <linearGradient id="gradVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.accent} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{fill:C.textMute,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.textMute,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}}
                formatter={v=>[fmtMoney(v),"Valor"]}/>
              <Area type="monotone" dataKey="valor" stroke={C.accent} fill="url(#gradVal)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
 
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
        {/* Últimos movimientos */}
        <div className="card">
          <div className="section-title"><ArrowLeftRight size={13}/>Últimos movimientos</div>
          <table className="tbl">
            <thead><tr><th>Tipo</th><th>SKU</th><th>Cant.</th><th>CC</th><th>Costo</th></tr></thead>
            <tbody>
              {movements.slice(0,5).map(m=>(
                <tr key={m.id}>
                  <td><span className="mono" style={{fontSize:10,color:movTypeColor(m.type)}}>{m.type.split("_").slice(0,2).join("_")}</span></td>
                  <td><span className="mono">{m.sku}</span></td>
                  <td>{m.qty}</td>
                  <td style={{color:C.textMute,fontSize:11}}>{m.cc}</td>
                  <td style={{color:m.cost<0?C.danger:C.accent3}}>{m.cost!==0?fmtMoney(Math.abs(m.cost)):"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
 
        {/* Tokens críticos */}
        <div className="card">
          <div className="section-title"><QrCode size={13}/>Tokens en seguimiento</div>
          {tokens.slice(0,4).map(t=>(
            <div key={t.id} className={`token-card ${t.status==="OVERDUE"?"overdue":t.status==="DUE_SOON"?"due-soon":"active"}`} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:600}}>{t.tool}</span>
                {tokenStatusBadge(t.status)}
              </div>
              <div style={{display:"flex",gap:12,fontSize:11,color:C.textMute}}>
                <span>👤 {t.worker}</span>
                <span>📅 vence {t.due}</span>
                <span>⚡ {t.hours}h/{t.maxHours}h</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width:`${Math.min(100,(t.hours/t.maxHours)*100)}%`,
                  background:t.hours/t.maxHours>0.9?C.danger:t.hours/t.maxHours>0.7?C.warn:C.accent3
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
 
  const renderInventory = () => (
    <div className="fadein">
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:200}}>
          <Search size={13} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.textMute}}/>
          <input style={{paddingLeft:28,width:"100%"}} placeholder="Buscar SKU o descripción..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{width:130}}>
          {["Todos","Consumible","Herramienta","Repuesto","EPP","Material","Activo"].map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={filterWH} onChange={e=>setFilterWH(e.target.value)} style={{width:160}}>
          <option value="Todos">Todos los almacenes</option>
          {warehouses.map(w=><option key={w.id} value={w.id}>{w.name.slice(0,22)}</option>)}
        </select>
        <button className="btn btn-primary" onClick={()=>setShowNewMovement(true)}><Plus size={13}/>Nuevo Movimiento</button>
      </div>
 
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <table className="tbl">
          <thead>
            <tr>
              <th>SKU</th><th>Descripción</th><th>Categoría</th><th>Almacén</th>
              <th>Stock</th><th>Reorden</th><th>Ubic.</th><th>Costo unit.</th>
              <th>Valor total</th><th>ABC</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(item=>(
              <tr key={item.id}>
                <td><span className="mono" style={{color:C.accent}}>{item.sku}</span></td>
                <td style={{maxWidth:200}}>{item.desc}</td>
                <td><span className="badge badge-gray">{item.cat}</span></td>
                <td style={{fontSize:11,color:C.textMute}}>{item.wh}</td>
                <td style={{fontWeight:600,color:item.stock<=item.reorder?C.danger:C.text}}>{item.stock.toLocaleString()}</td>
                <td style={{color:C.textMute}}>{item.reorder}</td>
                <td><span className="mono" style={{fontSize:11,color:C.textDim}}>{item.loc}</span></td>
                <td style={{textAlign:"right"}}>{fmtMoney(item.cost)}</td>
                <td style={{textAlign:"right",fontWeight:600}}>{fmtMoney(item.stock*item.cost)}</td>
                <td><span className={`badge ${item.abc==="A"?"badge-danger":item.abc==="B"?"badge-warn":"badge-ok"}`}>{item.abc}</span></td>
                <td>{stockBadge(item.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
 
      {/* Modal nuevo movimiento */}
      {showNewMovement && (
        <div style={{position:"fixed",inset:0,background:"#000a",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div className="card fadein" style={{width:480,background:C.card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:15,fontWeight:600}}>Registrar Movimiento</h3>
              <button className="btn btn-ghost btn-xs" onClick={()=>setShowNewMovement(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">Tipo de movimiento</label>
                <select value={newMov.type} onChange={e=>setNewMov(p=>({...p,type:e.target.value}))}>
                  {["261_GOODS_ISSUE_WORK_ORDER","201_GOODS_ISSUE_COST_CENTER","101_GOODS_RECEIPT_PO",
                    "301_STOCK_TRANSFER_INTER_BIN","901_TOOL_CHECKOUT","902_TOOL_RETURN","551_SCRAP",
                    "701_PHYSICAL_COUNT_GAIN","702_PHYSICAL_COUNT_LOSS"].map(t=>(
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">SKU</label>
                <select value={newMov.sku} onChange={e=>setNewMov(p=>({...p,sku:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {inventory.map(i=><option key={i.sku} value={i.sku}>{i.sku}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Almacén</label>
                <select value={newMov.wh} onChange={e=>setNewMov(p=>({...p,wh:e.target.value}))}>
                  {warehouses.map(w=><option key={w.id} value={w.id}>{w.id}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Cantidad</label>
                <input type="number" value={newMov.qty} onChange={e=>setNewMov(p=>({...p,qty:e.target.value}))} placeholder="0"/>
              </div>
              <div className="form-field">
                <label className="form-label">Centro de costo</label>
                <input value={newMov.cc} onChange={e=>setNewMov(p=>({...p,cc:e.target.value}))} placeholder="CC-OBRAS-ICA"/>
              </div>
              <div className="form-field">
                <label className="form-label">Cuenta inventario</label>
                <select value={newMov.inventoryAccount} onChange={e=>setNewMov(p=>({...p,inventoryAccount:e.target.value}))}>
                  {ledgerAccountOptions.map(account=><option key={account.code} value={account.code}>{account.code} - {account.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Cuenta costo</label>
                <select value={newMov.cogsAccount} onChange={e=>setNewMov(p=>({...p,cogsAccount:e.target.value}))}>
                  {ledgerAccountOptions.map(account=><option key={account.code} value={account.code}>{account.code} - {account.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Cuenta ajuste</label>
                <select value={newMov.adjustmentAccount} onChange={e=>setNewMov(p=>({...p,adjustmentAccount:e.target.value}))}>
                  {ledgerAccountOptions.map(account=><option key={account.code} value={account.code}>{account.code} - {account.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setShowNewMovement(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveMovement}><Send size={13}/>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFulfillment = () => {
    const openRequests = requests.filter(r => r.status !== "DELIVERED" && r.status !== "CANCELLED");
    const activeDispatches = dispatches.filter(d => d.status !== "DELIVERED");
    const activeWorker = workerOps[0];
    return (
      <div className="fadein">
        <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
          <h2 style={{fontSize:15,fontWeight:600,flex:1}}>Almacén General — Recibir, Atender, Preparar y Entregar</h2>
          <button className="btn btn-ghost" onClick={()=>setShowEvidenceModal(true)}><Eye size={13}/>Adjuntar evidencia</button>
          <button className="btn btn-primary" onClick={()=>setShowRequestModal(true)}><Plus size={13}/>Nuevo requerimiento</button>
        </div>

        <div className="tab-bar">
          {["Recepción","Atención","Picking","Entrega"].map((tab, idx)=>(
            <button key={tab} className={`tab ${selectedTab===idx?"active":""}`} onClick={()=>setSelectedTab(idx)}>{tab}</button>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:14,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="card">
              <div className="section-title"><ClipboardList size={13}/>Cola operativa</div>
              <table className="tbl">
                <thead>
                  <tr><th>Documento</th><th>Trabajador</th><th>Área</th><th>Prioridad</th><th>Necesidad</th><th>Líneas</th><th>Estado</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {openRequests.map(r=>(
                    <tr key={r.id}>
                      <td>
                        <div className="mono" style={{color:C.accent,fontSize:11}}>{r.id}</div>
                        <div style={{fontSize:11,color:C.textMute}}>{r.type}</div>
                      </td>
                      <td>{r.worker}</td>
                      <td style={{fontSize:11,color:C.textMute}}>{r.area}</td>
                      <td>{r.priority==="CRÍTICA"?<span className="badge badge-danger">{r.priority}</span>:r.priority==="ALTA"?<span className="badge badge-warn">{r.priority}</span>:<span className="badge badge-gray">{r.priority}</span>}</td>
                      <td style={{fontSize:11}}>{r.needAt}</td>
                      <td>{r.lines}</td>
                      <td>{requestBadge(r.status)}</td>
                      <td>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {r.status==="PENDING_APPROVAL" && <button className="btn btn-xs btn-success" onClick={()=>approveRequest(r.id)}>Aprobar</button>}
                          {["APPROVED","READY","PICKING"].includes(r.status) && <button className="btn btn-xs btn-primary" onClick={()=>createDispatch(r.id)}>Despachar</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="section-title"><Truck size={13}/>Despachos y staging</div>
              <table className="tbl">
                <thead>
                  <tr><th>Despacho</th><th>Req.</th><th>Trabajador</th><th>Ruta</th><th>Avance</th><th>Dock</th><th>Estado</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {activeDispatches.map(d=>(
                    <tr key={d.id}>
                      <td><span className="mono" style={{color:C.accent}}>{d.id}</span></td>
                      <td style={{fontSize:11,color:C.textMute}}>{d.requestId}</td>
                      <td>{d.worker}</td>
                      <td><span className="mono" style={{fontSize:11}}>{d.route}</span></td>
                      <td style={{minWidth:130}}>
                        <div className="progress-bar" style={{height:6}}>
                          <div className="progress-fill" style={{width:`${Math.min(100,(d.picked/d.total)*100)}%`,background:d.status==="DELIVERED"?C.accent3:C.accent}}/>
                        </div>
                        <div style={{fontSize:11,color:C.textMute,marginTop:4}}>{d.picked}/{d.total} ítems</div>
                      </td>
                      <td style={{fontSize:11,color:C.textMute}}>{d.dock}</td>
                      <td>{dispatchBadge(d.status)}</td>
                      <td>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {d.status==="ALLOCATED" && <button className="btn btn-xs btn-warn" onClick={()=>stageDispatch(d.id)}>Preparar</button>}
                          {["ALLOCATED","STAGED","PICKING","READY"].includes(d.status) && <button className="btn btn-xs btn-success" onClick={()=>deliverDispatch(d.id)}>Entregar</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="card">
              <div className="section-title"><User size={13}/>Ficha operativa del trabajador</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15}}>{activeWorker.name}</div>
                  <div style={{fontSize:12,color:C.textMute}}>{activeWorker.role}</div>
                </div>
                {activeWorker.status==="RIESGO"?<span className="badge badge-danger">RIESGO</span>:activeWorker.status==="PICKING"?<span className="badge badge-info">EN FLUJO</span>:<span className="badge badge-ok">OPERATIVO</span>}
              </div>
              <div className="form-grid" style={{marginBottom:10}}>
                <div className="card-sm"><div className="metric-label">Docs abiertos</div><div className="metric-val" style={{fontSize:20}}>{activeWorker.openDocs}</div></div>
                <div className="card-sm"><div className="metric-label">Retornos pend.</div><div className="metric-val" style={{fontSize:20}}>{activeWorker.pendingReturns}</div></div>
                <div className="card-sm"><div className="metric-label">Evidencias</div><div className="metric-val" style={{fontSize:20}}>{activeWorker.evidence}</div></div>
              </div>
              <div className="warn-strip" style={{fontSize:12}}><AlertTriangle size={13}/>{activeWorker.lastEvent}</div>
              <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn btn-ghost btn-xs">Adjuntar foto salida</button>
                <button className="btn btn-ghost btn-xs">Adjuntar foto entrega</button>
                <button className="btn btn-ghost btn-xs">Ver historial</button>
              </div>
            </div>

            <div className="card">
              <div className="section-title"><CheckSquare size={13}/>Checklist de control</div>
              {[
                {label:"Requerimiento aprobado", done:true},
                {label:"Stock reservado en ATP", done:true},
                {label:"Picking validado por bin/lote", done:selectedTab>1},
                {label:"Evidencia de entrega adjunta", done:selectedTab>2},
              ].map(step=>(
                <div key={step.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12}}>{step.label}</span>
                  {step.done?<span className="badge badge-ok">OK</span>:<span className="badge badge-gray">PEND.</span>}
                </div>
              ))}
            </div>

            <div className="card">
              <div className="section-title"><Eye size={13}/>Últimas evidencias</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:320,overflowY:"auto",paddingRight:4}}>
                {evidences.slice(0,5).map(e=>(
                  <div key={e.id} className="card-sm">
                    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                      <span className="mono" style={{fontSize:11,color:C.accent}}>{e.id}</span>
                      <span className="badge badge-info">{e.event}</span>
                    </div>
                    <div style={{fontWeight:600,fontSize:12,marginTop:4}}>{e.file}</div>
                    <div style={{fontSize:11,color:C.textMute}}>{e.worker} · {e.entity} · {e.channel}</div>
                    <div style={{fontSize:11,color:C.textDim,marginTop:4}}>{e.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showRequestModal && (
          <div style={{position:"fixed",inset:0,background:"#000a",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div className="card fadein" style={{width:920,maxHeight:"88vh",overflowY:"auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{fontSize:16,fontWeight:700}}>Nuevo requerimiento operativo</h3>
                <button className="btn btn-ghost btn-xs" onClick={()=>setShowRequestModal(false)}>✕</button>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Tipo</label>
                  <select value={requestForm.type} onChange={e=>setRequestForm(p=>({...p,type:e.target.value}))}>
                    {["Abastecimiento obra","Herramientas + EPP","Mantenimiento","Reposición interna"].map(v=><option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Trabajador</label>
                  <input value={requestForm.worker} onChange={e=>setRequestForm(p=>({...p,worker:e.target.value}))} placeholder="Nombre completo"/>
                </div>
                <div className="form-field">
                  <label className="form-label">Área / CC</label>
                  <input value={requestForm.area} onChange={e=>setRequestForm(p=>({...p,area:e.target.value}))} placeholder="CC-OBRAS-ICA"/>
                </div>
                <div className="form-field">
                  <label className="form-label">Prioridad</label>
                  <select value={requestForm.priority} onChange={e=>setRequestForm(p=>({...p,priority:e.target.value}))}>
                    {["NORMAL","ALTA","CRÍTICA"].map(v=><option key={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Almacén</label>
                  <select value={requestForm.warehouse} onChange={e=>setRequestForm(p=>({...p,warehouse:e.target.value}))}>
                    {warehouses.map(w=><option key={w.id} value={w.id}>{w.id}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Necesario para</label>
                  <input value={requestForm.needAt} onChange={e=>setRequestForm(p=>({...p,needAt:e.target.value}))}/>
                </div>
                <div className="form-field" style={{gridColumn:"1/-1"}}>
                  <label className="form-label">Observaciones</label>
                  <textarea rows="3" value={requestForm.notes} onChange={e=>setRequestForm(p=>({...p,notes:e.target.value}))} placeholder="Objetivo operativo, frente de trabajo, restricciones y evidencia requerida"/>
                </div>
              </div>

              <div className="divider"/>
              <div className="section-title"><Package size={13}/>Líneas del requerimiento</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {requestForm.lines.map((line, idx)=>(
                  <div key={idx} className="form-grid" style={{padding:10,border:`1px solid ${C.border}`,borderRadius:8}}>
                    <div className="form-field">
                      <label className="form-label">SKU</label>
                      <input value={line.sku} onChange={e=>updateRequestLine(idx,"sku",e.target.value)} placeholder="SKU-0001"/>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Descripción</label>
                      <input value={line.description} onChange={e=>updateRequestLine(idx,"description",e.target.value)} placeholder="Descripción operativa"/>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Cantidad</label>
                      <input type="number" value={line.qty} onChange={e=>updateRequestLine(idx,"qty",e.target.value)} placeholder="0"/>
                    </div>
                    <div className="form-field">
                      <label className="form-label">UOM</label>
                      <input value={line.uom} onChange={e=>updateRequestLine(idx,"uom",e.target.value)} placeholder="UND"/>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
                <button className="btn btn-ghost" onClick={addRequestLine}><Plus size={13}/>Agregar línea</button>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-ghost" onClick={()=>setShowRequestModal(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveWarehouseRequest}><Send size={13}/>Crear requerimiento</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEvidence = () => (
    <div className="fadein">
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        <h2 style={{fontSize:15,fontWeight:600,flex:1}}>Evidencias operativas y trazabilidad visual</h2>
        <button className="btn btn-primary" onClick={()=>setShowEvidenceModal(true)}><Plus size={13}/>Nueva evidencia</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.3fr .9fr",gap:14}}>
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <table className="tbl">
            <thead><tr><th>ID</th><th>Entidad</th><th>Evento</th><th>Trabajador</th><th>Canal</th><th>Archivo</th><th>Detalle</th><th>Hora</th></tr></thead>
            <tbody>
              {evidences.map(e=>(
                <tr key={e.id}>
                  <td><span className="mono" style={{color:C.accent}}>{e.id}</span></td>
                  <td style={{fontSize:11}}>{e.entity}</td>
                  <td><span className="badge badge-info">{e.event}</span></td>
                  <td>{e.worker}</td>
                  <td><span className="badge badge-gray">{e.channel}</span></td>
                  <td style={{fontSize:11,color:C.textMute}}>{e.file}</td>
                  <td style={{maxWidth:260,fontSize:11,color:C.textDim}}>{e.notes}</td>
                  <td style={{fontSize:11}}>{e.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card">
            <div className="section-title"><Eye size={13}/>Panel de captura</div>
            <div className="form-grid">
              <div className="form-field" style={{gridColumn:"1/-1"}}>
                <label className="form-label">Botones requeridos en el sistema</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["Adjuntar foto salida","Adjuntar foto entrega","Adjuntar incidencia","Ver evidencia","Abrir historial trabajador"].map(label=>(
                    <button key={label} className="btn btn-ghost btn-xs">{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title"><Brain size={13}/>Prompts operativos potentes</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {OPERATIONAL_PROMPTS.map(prompt=>(
                <button key={prompt} className="btn btn-ghost" style={{justifyContent:"flex-start"}} onClick={()=>{setActiveView("ai"); setAiQuestion(prompt);}}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEvidenceModal && (
        <div style={{position:"fixed",inset:0,background:"#000a",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div className="card fadein" style={{width:640}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:700}}>Registrar evidencia</h3>
              <button className="btn btn-ghost btn-xs" onClick={()=>setShowEvidenceModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">Entidad</label>
                <input value={evidenceForm.entity} onChange={e=>setEvidenceForm(p=>({...p,entity:e.target.value}))} placeholder="DSP-20260518-1A9F"/>
              </div>
              <div className="form-field">
                <label className="form-label">Evento</label>
                <select value={evidenceForm.event} onChange={e=>setEvidenceForm(p=>({...p,event:e.target.value}))}>
                  {["RECEIPT","PICKING","DELIVERY","RETURN","INCIDENT","INSPECTION"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Trabajador</label>
                <input value={evidenceForm.worker} onChange={e=>setEvidenceForm(p=>({...p,worker:e.target.value}))} placeholder="Nombre completo"/>
              </div>
              <div className="form-field">
                <label className="form-label">Canal</label>
                <select value={evidenceForm.channel} onChange={e=>setEvidenceForm(p=>({...p,channel:e.target.value}))}>
                  {["WEB","MOBILE","KIOSK"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-field" style={{gridColumn:"1/-1"}}>
                <label className="form-label">Adjunto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e=>{
                    const file = e.target.files?.[0] || null;
                    setEvidenceFileBlob(file);
                    setEvidenceFileName(file?.name || "");
                  }}
                />
                <div style={{fontSize:11,color:C.textMute,marginTop:4}}>{evidenceFileName || "Sin archivo seleccionado"}</div>
              </div>
              <div className="form-field" style={{gridColumn:"1/-1"}}>
                <label className="form-label">Notas / checklist</label>
                <textarea rows="3" value={evidenceForm.notes} onChange={e=>setEvidenceForm(p=>({...p,notes:e.target.value}))} placeholder="Qué se verificó, quién recibió, condición visual, incidencias"/>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
              <button className="btn btn-ghost" onClick={()=>setShowEvidenceModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEvidence}><Send size={13}/>Guardar evidencia</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTokens = () => (
    <div className="fadein">
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        <h2 style={{fontSize:15,fontWeight:600,flex:1}}>Digital Tool Custody Token Engine</h2>
        <button className="btn btn-ghost" style={{color:C.accent3,border:`1px solid ${C.accent3}40`}} onClick={()=>{setSelDevIds(new Set());setShowDevolucionDialog(true);}}><ArrowDownRight size={13}/>Devolución</button>
        <button className="btn btn-ghost" style={{color:C.accent,border:`1px solid ${C.accent}40`}} onClick={()=>{setSelEntregaIds(new Set());setShowEntregaDialog(true);}}><ArrowUpRight size={13}/>Entrega Herramientas</button>
        <button className="btn btn-primary" onClick={()=>setShowNewToken(true)}><QrCode size={13}/>Emitir Token</button>
      </div>
 
      <div className="metric-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:14}}>
        {[
          {l:"En Custodia", v:tokens.filter(t=>t.status==="IN_CUSTODY").length,  c:C.accent,  icon:Lock},
          {l:"Por Vencer",  v:tokens.filter(t=>t.status==="DUE_SOON").length,    c:C.warn,    icon:Clock},
          {l:"Vencidos",    v:tokens.filter(t=>t.status==="OVERDUE").length,     c:C.danger,  icon:AlertCircle},
          {l:"En Mant.",    v:tokens.filter(t=>t.status==="MAINTENANCE").length, c:C.accent2, icon:Wrench},
        ].map(m=>(
          <div className="metric-card" key={m.l} style={{borderTop:`3px solid ${m.c}`}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span className="metric-label">{m.l}</span>
              <m.icon size={13} style={{color:m.c}}/>
            </div>
            <div className="metric-val" style={{color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
 
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
        {tokens.map(t=>(
          <div key={t.id} className={`token-card ${t.status==="OVERDUE"?"overdue":t.status==="DUE_SOON"?"due-soon":"active"}`}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span className="mono" style={{fontSize:11,color:C.accent}}>{t.id}</span>
              {tokenStatusBadge(t.status)}
            </div>
            <div style={{fontWeight:600,fontSize:14}}>{t.tool}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:12,color:C.textMute}}>
              <span>👤 {t.worker}</span>
              <span>📌 {t.cc}</span>
              <span>📅 Emitido: {fmtDate(t.issued)}</span>
              <span>⏰ Vence: {t.due}</span>
            </div>
            <div style={{fontSize:11,color:C.textMute,marginTop:4}}>Horas uso: {t.hours} / {t.maxHours}</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width:`${Math.min(100,(t.hours/t.maxHours)*100)}%`,
                background:t.hours/t.maxHours>0.9?C.danger:t.hours/t.maxHours>0.7?C.warn:C.accent3
              }}/>
            </div>
            <div style={{display:"flex",gap:6,marginTop:4}}>
              {t.status==="IN_CUSTODY"&&<button className="btn btn-ghost btn-xs" onClick={()=>{
                const d=new Date("2026-05-18"); d.setDate(d.getDate()+7);
                setTokens(prev=>prev.map(tk=>tk.id===t.id?{...tk,due:d.toISOString().slice(0,10)}:tk));
                onStatus?.(`Token ${t.id} renovado 7 días más.`);
              }}>Renovar</button>}
              {t.status==="OVERDUE"&&<button className="btn btn-danger btn-xs" onClick={()=>{
                onStatus?.(`⚠ Proceso iniciado: ${t.tool} — ${t.worker}. Notificación enviada.`);
              }}>Iniciar Proceso</button>}
              {t.status!=="RETURNED"&&t.status!=="MAINTENANCE"&&<button className="btn btn-success btn-xs" onClick={()=>{
                setTokens(prev=>prev.map(tk=>tk.id===t.id?{...tk,status:"RETURNED"}:tk));
                onStatus?.(`✅ ${t.tool} registrado como devuelto por ${t.worker}.`);
              }}>Registrar Retorno</button>}
            </div>
          </div>
        ))}
      </div>
 
      {/* ── DIALOG: ENTREGA DE HERRAMIENTAS ─────────────────────────────────── */}
      {showEntregaDialog && createPortal((()=>{
        const SECS: Record<string,string[]> = {
          torre:  ["Sótano","Nivel 1","Nivel 2","Acabados"],
          planta: ["Mecánica","Eléctrica","Montaje"],
        };
        const obraLabel = entObra==="torre"?"Edificio Torre Norte":entObra==="planta"?"Planta Industrial Sur":"";
        const filtered = INVENTARIO_TOOLS.filter(t=>{
          if(entCat && t.cat!==entCat) return false;
          if(entSearch && !t.name.toLowerCase().includes(entSearch.toLowerCase()) && !t.code.toLowerCase().includes(entSearch.toLowerCase())) return false;
          return true;
        });
        const toggleTool = (id:number)=>{
          setSelEntregaIds(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
          setEntLastId(id);
        };
        const confirmar = ()=>{
          if(!selEntregaIds.size||!entWorker||!entObra) return;
          onStatus?.(`✅ Entrega confirmada: ${selEntregaIds.size} herramienta(s) → ${entWorker} · ${obraLabel}`);
          setSelEntregaIds(new Set()); setShowEntregaDialog(false);
        };
        const lastTool = INVENTARIO_TOOLS.find(t=>t.id===entLastId);
        const inp = {background:"#0c1220",border:"1px solid #1e2d50",color:"#e8edf5",borderRadius:6,padding:"6px 10px",fontSize:12,fontFamily:"inherit",outline:"none"} as React.CSSProperties;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(5,9,18,0.88)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div style={{background:"#131c2b",border:"1px solid #1e2d50",borderRadius:14,width:"100%",maxWidth:1160,height:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.7)"}}>
              {/* HEADER */}
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 22px",borderBottom:"1px solid #1e2d50",flexShrink:0,background:"#0f1629"}}>
                <div style={{width:38,height:38,borderRadius:8,background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤝</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:18,fontWeight:700,color:"#00d4ff",letterSpacing:0.5,fontFamily:"Space Grotesk,sans-serif"}}>ENTREGA DE HERRAMIENTAS</div>
                  <div style={{fontSize:11,color:"#7a90b0",marginTop:2}}>Salida con token dinámico · Seleccione herramientas disponibles del inventario</div>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={()=>setShowEntregaDialog(false)}>✕</button>
              </div>
              {/* STATS */}
              <div style={{display:"flex",gap:10,padding:"10px 20px",background:"#0f1629",borderBottom:"1px solid #1e2d50",flexShrink:0}}>
                {[{l:"Disponibles",v:INVENTARIO_TOOLS.length,c:"#00e878"},{l:"En Custodia",v:ASIGNACIONES_ACTIVAS.filter(a=>a.status==="active").length,c:"#00d4ff"},{l:"Mantenimiento",v:3,c:"#ffb830"},{l:"Seleccionadas",v:selEntregaIds.size,c:"#ff4757"}].map(s=>(
                  <div key={s.l} style={{flex:1,background:"#0c1220",border:"1px solid #1e2d50",borderRadius:6,padding:"8px 12px",textAlign:"center"}}>
                    <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:10,color:"#4a5c78",marginTop:3}}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* FILTERS */}
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px",background:"#0f1629",borderBottom:"1px solid #1e2d50",flexShrink:0,overflowX:"auto"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Categoría</span>
                  <select value={entCat} onChange={e=>setEntCat(e.target.value)} style={inp}>
                    <option value="">Todas</option>
                    {["Perforación","Corte y desbaste","Corte madera","Concreto","Energía","Compactación","Soldadura","Acceso"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Trabajador</span>
                  <select value={entWorker} onChange={e=>setEntWorker(e.target.value)} style={inp}>
                    <option value="">▼ Seleccionar ▼</option>
                    {["Carlos Ramos","Pedro Llanos","Rosa Quispe","Luis Torres","Juan Rojas","Pepito Pérez","Luis Gómez"].map(w=><option key={w}>{w}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Obra</span>
                  <select value={entObra} onChange={e=>{setEntObra(e.target.value);setEntSec("");}} style={inp}>
                    <option value="">▼ Seleccionar ▼</option>
                    <option value="torre">Edificio Torre Norte</option>
                    <option value="planta">Planta Industrial Sur</option>
                  </select>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Sección</span>
                  <select value={entSec} onChange={e=>setEntSec(e.target.value)} style={inp}>
                    <option value="">▼ Sección ▼</option>
                    {(SECS[entObra]||[]).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Vence</span>
                  <input type="date" style={inp}/>
                </div>
                <input type="text" placeholder="🔍 Buscar herramienta..." value={entSearch} onChange={e=>setEntSearch(e.target.value)} style={{...inp,width:200}}/>
              </div>
              {/* SUMMARY */}
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 20px",background:"#0a0d14",borderBottom:"1px solid #1e2d50",flexShrink:0}}>
                <span style={{fontSize:11,color:"#7a90b0"}}>Inventario disponible:</span>
                <span style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#00e878",background:"rgba(0,232,120,0.1)",border:"1px solid rgba(0,232,120,0.2)",borderRadius:4,padding:"2px 8px"}}>{filtered.length} herramientas</span>
                <span style={{fontSize:11,color:"#7a90b0",marginLeft:8}}>Seleccionadas:</span>
                <span style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#00d4ff",background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:20,padding:"3px 14px"}}>{selEntregaIds.size}</span>
              </div>
              {/* BODY: left table + right detail */}
              <div style={{display:"flex",flex:1,overflow:"hidden"}}>
                {/* LEFT */}
                <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{flex:1,overflowY:"auto",overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}>
                      <thead>
                        <tr>
                          <th style={{position:"sticky",top:0,background:"#0f1629",borderBottom:"1px solid #243452",padding:"10px 14px",width:44,textAlign:"center",zIndex:2}}>
                            <input type="checkbox" onChange={e=>{ if(e.target.checked) setSelEntregaIds(new Set(filtered.map(t=>t.id))); else setSelEntregaIds(new Set()); }} style={{accentColor:"#00d4ff",width:16,height:16,cursor:"pointer"}}/>
                          </th>
                          {["CÓDIGO","HERRAMIENTA","CATEGORÍA","MARCA · MODELO","UBICACIÓN","USO h","ESTADO"].map(h=>(
                            <th key={h} style={{position:"sticky",top:0,background:"#0f1629",borderBottom:"1px solid #243452",padding:"10px 14px",textAlign:"left",fontSize:10,fontFamily:"JetBrains Mono,monospace",color:"#4a5c78",letterSpacing:0.8,textTransform:"uppercase",whiteSpace:"nowrap",zIndex:2}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length===0 && <tr><td colSpan={8} style={{textAlign:"center",padding:48,color:"#4a5c78",fontSize:13}}>No hay herramientas para este filtro</td></tr>}
                        {filtered.map((tool,i)=>{
                          const pct=Math.round((tool.horas/tool.maxHoras)*100);
                          const fc=pct>80?"#ff4757":pct>60?"#ffb830":"#00e878";
                          const checked=selEntregaIds.has(tool.id);
                          return (
                            <tr key={tool.id} onClick={()=>toggleTool(tool.id)}
                              style={{background:checked?"rgba(0,212,255,0.07)":i%2===0?"#161f30":"#111825",borderBottom:"1px solid #1e2d50",cursor:"pointer",transition:"background 0.1s"}}>
                              <td style={{textAlign:"center",padding:"10px 14px"}} onClick={e=>e.stopPropagation()}>
                                <input type="checkbox" checked={checked} onChange={()=>toggleTool(tool.id)} style={{accentColor:"#00d4ff",width:16,height:16,cursor:"pointer"}}/>
                              </td>
                              <td style={{padding:"10px 14px"}}><span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"#00d4ff",background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:4,padding:"2px 6px"}}>{tool.code}</span></td>
                              <td style={{padding:"10px 14px",fontWeight:500,fontSize:13,color:"#e8edf5"}}>{tool.name}</td>
                              <td style={{padding:"10px 14px",fontSize:11,color:"#7a90b0"}}>{tool.cat}</td>
                              <td style={{padding:"10px 14px",fontSize:11,color:"#7a90b0"}}>{tool.brand} · {tool.model}</td>
                              <td style={{padding:"10px 14px",fontSize:11,color:"#4a5c78"}}>{tool.location}</td>
                              <td style={{padding:"10px 14px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <div style={{width:70,height:4,background:"#1e2d50",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",borderRadius:2,background:fc,width:`${pct}%`}}/></div>
                                  <span style={{fontSize:10,color:"#4a5c78",fontFamily:"JetBrains Mono,monospace"}}>{tool.horas}h</span>
                                </div>
                              </td>
                              <td style={{padding:"10px 14px"}}><span style={{fontSize:10,fontFamily:"JetBrains Mono,monospace",color:"#00e878",background:"rgba(0,232,120,0.1)",border:"1px solid rgba(0,232,120,0.2)",borderRadius:4,padding:"3px 8px",display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:"#00e878",display:"inline-block"}}/>Disponible</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* ACTIONS */}
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"13px 20px",background:"#0f1629",borderTop:"1px solid #1e2d50",flexShrink:0,flexWrap:"wrap"}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelEntregaIds(new Set(filtered.map(t=>t.id)))}>☑ Seleccionar todo</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelEntregaIds(new Set())}>☐ Limpiar</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{}}>📷 Foto salida</button>
                    <span style={{flex:1}}/>
                    <span style={{fontSize:11,color:"#7a90b0"}}>Seleccionadas: <strong style={{color:"#00d4ff"}}>{selEntregaIds.size}</strong></span>
                    <button className="btn btn-ghost btn-sm">🔍 Vista previa</button>
                    <button onClick={confirmar} disabled={!selEntregaIds.size||!entWorker||!entObra}
                      style={{background:(!selEntregaIds.size||!entWorker||!entObra)?"#1e2d50":"#00d4ff",color:(!selEntregaIds.size||!entWorker||!entObra)?"#4a5c78":"#030810",fontWeight:700,padding:"9px 20px",border:"none",borderRadius:6,cursor:(!selEntregaIds.size||!entWorker||!entObra)?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13,letterSpacing:0.5}}>
                      ⚡ CONFIRMAR ENTREGA
                    </button>
                  </div>
                </div>
                {/* RIGHT PANEL */}
                <div style={{width:290,flexShrink:0,background:"#0f1629",borderLeft:"1px solid #1e2d50",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{padding:"14px 18px 10px",borderBottom:"1px solid #1e2d50",flexShrink:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#7a90b0",letterSpacing:0.8,textTransform:"uppercase"}}>Detalle de selección</div>
                  </div>
                  <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
                    {!lastTool||!selEntregaIds.has(lastTool.id) ? (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"40px 16px",color:"#4a5c78",textAlign:"center"}}>
                        <span style={{fontSize:32,opacity:0.4}}>🔧</span>
                        <span style={{fontSize:12}}>Seleccione una herramienta para ver su detalle</span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div style={{fontSize:10,fontFamily:"JetBrains Mono,monospace",fontWeight:600,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>Herramienta</div>
                          {([{k:"Código",v:<span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"#00d4ff",background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:4,padding:"2px 6px"}}>{lastTool.code}</span>},{k:"Nombre",v:lastTool.name},{k:"Categoría",v:lastTool.cat},{k:"Marca",v:lastTool.brand},{k:"Modelo",v:lastTool.model},{k:"Ubicación",v:lastTool.location},{k:"Horas uso",v:`${lastTool.horas} / ${lastTool.maxHoras}h`}] as {k:string,v:React.ReactNode}[]).map(r=>(
                            <div key={r.k} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"5px 0",borderBottom:"1px solid #1e2d50",gap:8}}>
                              <span style={{fontSize:11,color:"#4a5c78",flexShrink:0}}>{r.k}</span>
                              <span style={{fontSize:11,color:"#e8edf5",fontFamily:"JetBrains Mono,monospace",textAlign:"right"}}>{r.v}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{background:"#0c1220",border:"1px solid #1e2d50",borderRadius:6,display:"flex",flexDirection:"column",alignItems:"center",padding:14,gap:10}}>
                          <div style={{width:100,height:100,background:"#131c2b",border:"1px dashed #243452",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"#4a5c78"}}>⬡</div>
                          <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:9,color:"#4a5c78",textAlign:"center"}}>QR se generará al confirmar entrega</div>
                        </div>
                        <div style={{background:"#0c1220",border:"1px dashed #243452",borderRadius:6,minHeight:80,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,color:"#4a5c78",fontSize:11,cursor:"pointer"}}>
                          <span style={{fontSize:22}}>📷</span>
                          <span>Adjuntar foto de salida</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          <label style={{fontSize:10,fontWeight:600,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5}}>Observaciones</label>
                          <textarea placeholder="Notas adicionales sobre la entrega..." style={{background:"#0c1220",border:"1px solid #1e2d50",borderRadius:6,color:"#e8edf5",fontFamily:"inherit",fontSize:12,padding:"7px 10px",resize:"vertical",outline:"none",minHeight:56}}/>
                        </div>
                        {selEntregaIds.size>0 && (
                          <div>
                            <div style={{fontSize:10,fontFamily:"JetBrains Mono,monospace",fontWeight:600,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>Seleccionadas para entrega</div>
                            {[...selEntregaIds].map(sid=>{ const t=INVENTARIO_TOOLS.find(x=>x.id===sid); return t?(<div key={sid} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1e2d50",gap:8,fontSize:10}}><span style={{fontFamily:"JetBrains Mono,monospace",color:"#00d4ff",background:"rgba(0,212,255,0.06)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:4,padding:"1px 5px"}}>{t.code}</span><span style={{color:"#e8edf5",textAlign:"right"}}>{t.name}</span></div>):null; })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── DIALOG: DEVOLUCIÓN DE HERRAMIENTAS ──────────────────────────────── */}
      {showDevolucionDialog && createPortal((()=>{
        const filteredAsig = ASIGNACIONES_ACTIVAS.filter(a=>{
          if(devWorker && a.worker!==devWorker) return false;
          if(devObra && !a.obra.includes(devObra)) return false;
          if(devSoloVenc && a.status!=="overdue") return false;
          if(devSoloFoto && !a.fotoSalida) return false;
          if(devSearch && !a.token.toLowerCase().includes(devSearch.toLowerCase()) && !a.name.toLowerCase().includes(devSearch.toLowerCase()) && !a.worker.toLowerCase().includes(devSearch.toLowerCase())) return false;
          return true;
        });
        const toggleAsig = (id:number)=>{
          setSelDevIds(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
          setDevLastId(id);
        };
        const confirmar = ()=>{
          if(!selDevIds.size) return;
          onStatus?.(`✅ Devolución confirmada: ${selDevIds.size} herramienta(s) registradas como disponibles`);
          setSelDevIds(new Set()); setShowDevolucionDialog(false);
        };
        const statusC=(s:string)=>s==="overdue"?"#ff4757":s==="active"?"#00d4ff":"#ffb830";
        const statusL=(s:string)=>s==="overdue"?"VENCIDA":s==="active"?"ACTIVA":"POR VENCER";
        const lastAsig = ASIGNACIONES_ACTIVAS.find(a=>a.id===devLastId);
        const inp = {background:"#0c1220",border:"1px solid #1e2d50",color:"#e8edf5",borderRadius:6,padding:"6px 10px",fontSize:12,fontFamily:"inherit",outline:"none"} as React.CSSProperties;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(5,9,18,0.88)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div style={{background:"#131c2b",border:"1px solid #1e2d50",borderRadius:14,width:"100%",maxWidth:1160,height:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.7)"}}>
              {/* HEADER */}
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 22px",borderBottom:"1px solid #1e2d50",flexShrink:0,background:"#0f1629"}}>
                <div style={{width:38,height:38,borderRadius:8,background:"rgba(0,232,120,0.1)",border:"1px solid rgba(0,232,120,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📥</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:18,fontWeight:700,color:"#00e878",letterSpacing:0.5,fontFamily:"Space Grotesk,sans-serif"}}>DEVOLUCIÓN DE HERRAMIENTAS</div>
                  <div style={{fontSize:11,color:"#7a90b0",marginTop:2}}>Devolución por token · Checklist de herramientas activas asignadas al trabajador</div>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={()=>setShowDevolucionDialog(false)}>✕</button>
              </div>
              {/* STATS */}
              <div style={{display:"flex",gap:10,padding:"10px 20px",background:"#0f1629",borderBottom:"1px solid #1e2d50",flexShrink:0}}>
                {[{l:"Activas",v:ASIGNACIONES_ACTIVAS.filter(a=>a.status==="active").length,c:"#00d4ff"},{l:"Vencidas",v:ASIGNACIONES_ACTIVAS.filter(a=>a.status==="overdue").length,c:"#ff4757"},{l:"Sin foto",v:ASIGNACIONES_ACTIVAS.filter(a=>!a.fotoSalida).length,c:"#ffb830"},{l:"A devolver",v:selDevIds.size,c:"#00e878"}].map(s=>(
                  <div key={s.l} style={{flex:1,background:"#0c1220",border:"1px solid #1e2d50",borderRadius:6,padding:"8px 12px",textAlign:"center"}}>
                    <div style={{fontFamily:"Space Grotesk,sans-serif",fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:10,color:"#4a5c78",marginTop:3}}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* FILTERS */}
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px",background:"#0f1629",borderBottom:"1px solid #1e2d50",flexShrink:0,overflowX:"auto"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Trabajador</span>
                  <select value={devWorker} onChange={e=>setDevWorker(e.target.value)} style={inp}>
                    <option value="">Todos</option>
                    {["Carlos Ramos","Pedro Llanos","Rosa Quispe","Luis Torres","Juan Rojas","Pepito Pérez","Luis Gómez"].map(w=><option key={w}>{w}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>Obra</span>
                  <select value={devObra} onChange={e=>setDevObra(e.target.value)} style={inp}>
                    <option value="">Todas</option>
                    <option value="Torre">Edificio Torre Norte</option>
                    <option value="Industrial">Planta Industrial Sur</option>
                  </select>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#7a90b0",cursor:"pointer"}}>
                  <input type="checkbox" checked={devSoloVenc} onChange={e=>setDevSoloVenc(e.target.checked)} style={{accentColor:"#ff4757",width:14,height:14}}/>
                  Solo vencidas
                </label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#7a90b0",cursor:"pointer"}}>
                  <input type="checkbox" checked={devSoloFoto} onChange={e=>setDevSoloFoto(e.target.checked)} style={{accentColor:"#ffb830",width:14,height:14}}/>
                  Solo con foto salida
                </label>
                <input type="date" style={inp}/>
                <input type="text" placeholder="🔍 Buscar token / herramienta..." value={devSearch} onChange={e=>setDevSearch(e.target.value)} style={{...inp,width:210}}/>
                <button className="btn btn-ghost btn-sm" onClick={()=>{}}>↻ Buscar</button>
              </div>
              {/* SUMMARY */}
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 20px",background:"#0a0d14",borderBottom:"1px solid #1e2d50",flexShrink:0}}>
                <span style={{fontSize:11,color:"#7a90b0"}}>Herramientas en custodia:</span>
                <span style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#00d4ff",background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:4,padding:"2px 8px"}}>{filteredAsig.length} asignaciones activas</span>
                <span style={{fontSize:11,color:"#7a90b0",marginLeft:8}}>A devolver:</span>
                <span style={{fontFamily:"JetBrains Mono,monospace",fontSize:11,fontWeight:600,color:"#00e878",background:"rgba(0,232,120,0.1)",border:"1px solid rgba(0,232,120,0.2)",borderRadius:20,padding:"3px 14px"}}>{selDevIds.size}</span>
              </div>
              {/* BODY */}
              <div style={{display:"flex",flex:1,overflow:"hidden"}}>
                {/* LEFT */}
                <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{flex:1,overflowY:"auto",overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",minWidth:860}}>
                      <thead>
                        <tr>
                          <th style={{position:"sticky",top:0,background:"#0f1629",borderBottom:"1px solid #243452",padding:"10px 14px",width:44,textAlign:"center",zIndex:2}}>
                            <input type="checkbox" onChange={e=>{ if(e.target.checked) setSelDevIds(new Set(filteredAsig.map(a=>a.id))); else setSelDevIds(new Set()); }} style={{accentColor:"#00e878",width:16,height:16,cursor:"pointer"}}/>
                          </th>
                          {["TOKEN","HERRAMIENTA","TRABAJADOR","OBRA / SECCIÓN","F. ENTREGA","VENCE","FOTO SAL.","DEV. MÓVIL","ESTADO"].map(h=>(
                            <th key={h} style={{position:"sticky",top:0,background:"#0f1629",borderBottom:"1px solid #243452",padding:"10px 14px",textAlign:"left",fontSize:10,fontFamily:"JetBrains Mono,monospace",color:"#4a5c78",letterSpacing:0.8,textTransform:"uppercase",whiteSpace:"nowrap",zIndex:2}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAsig.length===0 && <tr><td colSpan={10} style={{textAlign:"center",padding:48,color:"#4a5c78",fontSize:13}}>No hay asignaciones para este filtro</td></tr>}
                        {filteredAsig.map((asig,i)=>{
                          const checked=selDevIds.has(asig.id);
                          const sc=statusC(asig.status);
                          const scRgb=sc==="#ff4757"?"255,71,87":sc==="#00d4ff"?"0,212,255":"255,184,48";
                          return (
                            <tr key={asig.id} onClick={()=>toggleAsig(asig.id)}
                              style={{background:checked?"rgba(0,232,120,0.07)":i%2===0?"#161f30":"#111825",borderBottom:"1px solid #1e2d50",cursor:"pointer",transition:"background 0.1s"}}>
                              <td style={{textAlign:"center",padding:"10px 14px"}} onClick={e=>e.stopPropagation()}>
                                <input type="checkbox" checked={checked} onChange={()=>toggleAsig(asig.id)} style={{accentColor:"#00e878",width:16,height:16,cursor:"pointer"}}/>
                              </td>
                              <td style={{padding:"10px 14px"}}><span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"#00e878",background:"rgba(0,232,120,0.06)",border:"1px solid rgba(0,232,120,0.15)",borderRadius:4,padding:"2px 6px"}}>{asig.token}</span></td>
                              <td style={{padding:"10px 14px",fontWeight:500,fontSize:13,color:asig.status==="overdue"?"#ff4757":"#e8edf5"}}>{asig.name}</td>
                              <td style={{padding:"10px 14px",fontSize:11,color:"#7a90b0"}}>👤 {asig.worker}</td>
                              <td style={{padding:"10px 14px",fontSize:11,color:"#7a90b0"}}>📍 {asig.obra} / {asig.seccion}</td>
                              <td style={{padding:"10px 14px",fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"#4a5c78"}}>{asig.fechaEntrega}</td>
                              <td style={{padding:"10px 14px",fontFamily:"JetBrains Mono,monospace",fontSize:10,fontWeight:asig.status==="overdue"?700:400,color:asig.status==="overdue"?"#ff4757":"#4a5c78"}}>{asig.vence}</td>
                              <td style={{padding:"10px 14px"}}>{asig.fotoSalida?<span style={{fontSize:10,color:"#00e878",background:"rgba(0,232,120,0.1)",border:"1px solid rgba(0,232,120,0.2)",borderRadius:4,padding:"2px 7px"}}>✓ Con foto</span>:<span style={{fontSize:10,color:"#ffb830",background:"rgba(255,184,48,0.1)",border:"1px solid rgba(255,184,48,0.2)",borderRadius:4,padding:"2px 7px"}}>⚠ Sin foto</span>}</td>
                              <td style={{padding:"10px 14px"}}>{asig.devMovil?<span style={{fontSize:10,color:"#00e878",background:"rgba(0,232,120,0.1)",border:"1px solid rgba(0,232,120,0.2)",borderRadius:4,padding:"2px 7px"}}>Recibido</span>:<span style={{fontSize:10,color:"#7a90b0",background:"rgba(100,120,150,0.1)",border:"1px solid #1e2d50",borderRadius:4,padding:"2px 7px"}}>Pendiente</span>}</td>
                              <td style={{padding:"10px 14px"}}><span style={{fontSize:10,fontFamily:"JetBrains Mono,monospace",color:sc,background:`rgba(${scRgb},0.1)`,border:`1px solid ${sc}40`,borderRadius:4,padding:"2px 7px",display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:sc,display:"inline-block"}}/>{statusL(asig.status)}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* ACTIONS */}
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"13px 20px",background:"#0f1629",borderTop:"1px solid #1e2d50",flexShrink:0,flexWrap:"wrap"}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelDevIds(new Set(filteredAsig.map(a=>a.id)))}>☑ Marcar todo</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelDevIds(new Set())}>☐ Limpiar selección</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{}}>📷 Foto devolución</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{}}>🖼 Ver foto salida</button>
                    <span style={{flex:1}}/>
                    <span style={{fontSize:11,color:"#7a90b0"}}>A devolver: <strong style={{color:"#00e878"}}>{selDevIds.size}</strong></span>
                    <button className="btn btn-ghost btn-sm">🔍 Vista previa</button>
                    <button onClick={confirmar} disabled={!selDevIds.size}
                      style={{background:!selDevIds.size?"#1e2d50":"#00e878",color:!selDevIds.size?"#4a5c78":"#030810",fontWeight:700,padding:"9px 20px",border:"none",borderRadius:6,cursor:!selDevIds.size?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13,letterSpacing:0.5}}>
                      ✅ CONFIRMAR DEVOLUCIÓN
                    </button>
                  </div>
                </div>
                {/* RIGHT PANEL */}
                <div style={{width:290,flexShrink:0,background:"#0f1629",borderLeft:"1px solid #1e2d50",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{padding:"14px 18px 10px",borderBottom:"1px solid #1e2d50",flexShrink:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#7a90b0",letterSpacing:0.8,textTransform:"uppercase"}}>Detalle del token</div>
                  </div>
                  <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:12}}>
                    {!lastAsig||!selDevIds.has(lastAsig.id) ? (
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"40px 16px",color:"#4a5c78",textAlign:"center"}}>
                        <span style={{fontSize:32,opacity:0.4}}>📋</span>
                        <span style={{fontSize:12}}>Seleccione un token para ver su detalle</span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div style={{fontSize:10,fontFamily:"JetBrains Mono,monospace",fontWeight:600,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>Token</div>
                          {([{k:"Token",v:<span style={{fontFamily:"JetBrains Mono,monospace",fontSize:10,color:"#00e878",background:"rgba(0,232,120,0.06)",border:"1px solid rgba(0,232,120,0.15)",borderRadius:4,padding:"2px 6px"}}>{lastAsig.token}</span>},{k:"Herramienta",v:lastAsig.name},{k:"Código",v:lastAsig.code},{k:"Trabajador",v:lastAsig.worker},{k:"Obra",v:lastAsig.obra},{k:"Sección",v:lastAsig.seccion},{k:"Entregado",v:lastAsig.fechaEntrega},{k:"Vence",v:<span style={{color:lastAsig.status==="overdue"?"#ff4757":"#e8edf5",fontWeight:lastAsig.status==="overdue"?700:400}}>{lastAsig.vence}</span>},{k:"Foto salida",v:lastAsig.fotoSalida?"✓ Sí":"⚠ No"},{k:"Dev. móvil",v:lastAsig.devMovil?"✓ Recibido":"Pendiente"}] as {k:string,v:React.ReactNode}[]).map(r=>(
                            <div key={r.k} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"5px 0",borderBottom:"1px solid #1e2d50",gap:8}}>
                              <span style={{fontSize:11,color:"#4a5c78",flexShrink:0}}>{r.k}</span>
                              <span style={{fontSize:11,color:"#e8edf5",fontFamily:"JetBrains Mono,monospace",textAlign:"right"}}>{r.v}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{background:"#0c1220",border:"1px solid #1e2d50",borderRadius:6,display:"flex",flexDirection:"column",alignItems:"center",padding:14,gap:8}}>
                          <div style={{width:100,height:100,background:"#131c2b",border:"1px dashed #243452",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"#4a5c78"}}>⬡</div>
                          <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:9,color:"#4a5c78",textAlign:"center"}}>QR Token: {lastAsig.token}</div>
                        </div>
                        <div style={{background:"#0c1220",border:"1px dashed #243452",borderRadius:6,minHeight:80,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,color:"#4a5c78",fontSize:11,cursor:"pointer"}}>
                          <span style={{fontSize:22}}>📷</span>
                          <span>Adjuntar foto devolución</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          <label style={{fontSize:10,fontWeight:600,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.5}}>Observaciones devolución</label>
                          <textarea placeholder="Estado de la herramienta al retorno..." style={{background:"#0c1220",border:"1px solid #1e2d50",borderRadius:6,color:"#e8edf5",fontFamily:"inherit",fontSize:12,padding:"7px 10px",resize:"vertical",outline:"none",minHeight:56}}/>
                        </div>
                        {selDevIds.size>0 && (
                          <div>
                            <div style={{fontSize:10,fontFamily:"JetBrains Mono,monospace",fontWeight:600,color:"#4a5c78",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>A devolver ({selDevIds.size})</div>
                            {[...selDevIds].map(sid=>{ const a=ASIGNACIONES_ACTIVAS.find(x=>x.id===sid); return a?(<div key={sid} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1e2d50",gap:8,fontSize:10}}><span style={{fontFamily:"JetBrains Mono,monospace",color:"#00e878",background:"rgba(0,232,120,0.06)",border:"1px solid rgba(0,232,120,0.15)",borderRadius:4,padding:"1px 5px"}}>{a.token.slice(-8)}</span><span style={{color:"#e8edf5",textAlign:"right"}}>{a.name}</span></div>):null; })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {showNewToken && (
        <div style={{position:"fixed",inset:0,background:"#000a",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div className="card fadein" style={{width:440,background:C.card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:15,fontWeight:600}}>Emitir Token Digital de Custodia</h3>
              <button className="btn btn-ghost btn-xs" onClick={()=>setShowNewToken(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-field" style={{gridColumn:"1/-1"}}>
                <label className="form-label">Herramienta / Serie</label>
                <input value={newToken.tool} onChange={e=>setNewToken(p=>({...p,tool:e.target.value}))} placeholder={'Amoladora 7" #SN-XXXX'}/>
              </div>
              <div className="form-field">
                <label className="form-label">Trabajador</label>
                <input value={newToken.worker} onChange={e=>setNewToken(p=>({...p,worker:e.target.value}))} placeholder="Nombre completo"/>
              </div>
              <div className="form-field">
                <label className="form-label">Centro de costo</label>
                <input value={newToken.cc} onChange={e=>setNewToken(p=>({...p,cc:e.target.value}))} placeholder="CC-OBRAS-ICA"/>
              </div>
              <div className="form-field">
                <label className="form-label">Vigencia (días)</label>
                <select value={newToken.days} onChange={e=>setNewToken(p=>({...p,days:e.target.value}))}>
                  {["1","3","7","14","30"].map(d=><option key={d} value={d}>{d} días</option>)}
                </select>
              </div>
            </div>
            <div style={{background:C.surface,borderRadius:8,padding:10,marginTop:12,fontSize:12,color:C.textMute}}>
              ⚡ Se generará QR digital · El token bloquea nuevas entregas si vence sin retorno · Requiere inspección al cierre.
            </div>
            <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setShowNewToken(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveToken}><QrCode size={13}/>Emitir Token</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
 
  const renderMovements = () => (
    <div className="fadein">
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        <h2 style={{fontSize:15,fontWeight:600,flex:1}}>Material Ledger — Libro de Movimientos</h2>
        <button className="btn btn-ghost" onClick={()=>{
          const csv = ["ID,Fecha,Tipo,SKU,Qty,Almacen,CC,Usuario,Costo",...movements.map(m=>`${m.id},${m.date},${m.type},${m.sku},${m.qty},${m.wh},${m.cc},${m.user},${m.cost}`)].join("\n");
          const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="movimientos.csv"; a.click();
          onStatus?.("Movimientos exportados como CSV.");
        }}><Download size={13}/>Exportar</button>
        <button className="btn btn-primary" onClick={()=>setShowNewMovement(true)}><Plus size={13}/>Registrar</button>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <table className="tbl">
          <thead>
            <tr><th>ID</th><th>Fecha</th><th>Tipo</th><th>SKU</th><th>Qty</th><th>Almacén/Ruta</th><th>CC</th><th>Usuario</th><th>Costo</th></tr>
          </thead>
          <tbody>
            {movements.map(m=>(
              <tr key={m.id}>
                <td><span className="mono" style={{fontSize:11,color:C.accent}}>{m.id}</span></td>
                <td style={{fontSize:11}}>{m.date}</td>
                <td><span className="mono" style={{fontSize:10,color:movTypeColor(m.type)}}>{m.type}</span></td>
                <td><span className="mono">{m.sku}</span></td>
                <td style={{fontWeight:600}}>{m.qty}</td>
                <td style={{fontSize:11,color:C.textMute}}>{m.wh}</td>
                <td style={{fontSize:11,color:C.textMute}}>{m.cc}</td>
                <td style={{fontSize:11}}>{m.user}</td>
                <td style={{textAlign:"right",color:m.cost<0?C.danger:m.cost>0?C.accent3:C.textMute}}>
                  {m.cost!==0?fmtMoney(Math.abs(m.cost)):"—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
 
  const renderEAM = () => (
    <div className="fadein">
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        <h2 style={{fontSize:15,fontWeight:600,flex:1}}>EAM / CMMS — Gestión de Activos y Mantenimiento</h2>
        <button className="btn btn-primary"><Plus size={13}/>Nueva WO</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[
          {l:"WO Abiertas",    v:workOrders.filter(w=>w.status==="ABIERTA").length,        c:C.accent},
          {l:"En Ejecución",   v:workOrders.filter(w=>w.status==="EN_EJECUCION").length,   c:C.warn},
          {l:"Programadas",    v:workOrders.filter(w=>w.status==="PROGRAMADA").length,     c:C.accent3},
          {l:"Cerradas (mes)", v:workOrders.filter(w=>w.status==="CERRADA").length,        c:C.textMute},
        ].map(m=>(
          <div className="metric-card" key={m.l} style={{borderLeft:`3px solid ${m.c}`}}>
            <span className="metric-label">{m.l}</span>
            <div className="metric-val" style={{color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <table className="tbl">
          <thead>
            <tr><th>ID</th><th>Activo</th><th>Tipo</th><th>Estado</th><th>Técnico</th><th>CC</th><th>Prioridad</th><th>Repuestos</th><th>Est/Real(h)</th></tr>
          </thead>
          <tbody>
            {workOrders.map(wo=>(
              <tr key={wo.id}>
                <td><span className="mono" style={{fontSize:11,color:C.accent}}>{wo.id}</span></td>
                <td style={{fontWeight:500}}>{wo.asset}</td>
                <td><span className="badge badge-gray">{wo.type}</span></td>
                <td>
                  {wo.status==="EN_EJECUCION"?<span className="badge badge-warn">EN EJEC.</span>:
                   wo.status==="ABIERTA"?<span className="badge badge-danger">ABIERTA</span>:
                   wo.status==="PROGRAMADA"?<span className="badge badge-info">PROGR.</span>:
                   <span className="badge badge-ok">CERRADA</span>}
                </td>
                <td style={{fontSize:12}}>{wo.tech}</td>
                <td style={{fontSize:11,color:C.textMute}}>{wo.cc}</td>
                <td>
                  {wo.priority==="CRÍTICA"?<span className="badge badge-danger">{wo.priority}</span>:
                   wo.priority==="ALTA"?<span className="badge badge-warn">{wo.priority}</span>:
                   <span className="badge badge-gray">{wo.priority}</span>}
                </td>
                <td style={{textAlign:"center"}}>{wo.parts}</td>
                <td><span className="mono" style={{fontSize:12}}>{wo.est}h / {wo.real}h</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
 
  const renderWarehouses = () => (
    <div className="fadein">
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
        <h2 style={{fontSize:15,fontWeight:600,flex:1}}>Mapa de Almacenes — Ocupación y Estado</h2>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {warehouses.map(wh=>(
          <div className="card" key={wh.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{wh.name}</div>
                <div style={{fontSize:11,color:C.textMute}}>{wh.id} · {wh.site}</div>
              </div>
              <span className="badge badge-gray">{wh.type}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
              <span style={{color:C.textMute}}>Ocupación</span>
              <span style={{fontWeight:700,color:wh.occ>85?C.danger:wh.occ>70?C.warn:C.accent3}}>{wh.occ}%</span>
            </div>
            <div className="progress-bar" style={{height:8,borderRadius:4}}>
              <div className="progress-fill" style={{
                width:`${wh.occ}%`,
                background:wh.occ>85?C.danger:wh.occ>70?C.warn:C.accent3,
                borderRadius:4
              }}/>
            </div>
            <div style={{fontSize:11,color:C.textMute,marginTop:8}}>Capacidad: {wh.cap} pallets</div>
            <div className="heatmap-grid" style={{marginTop:10}}>
              {heatmapCells.slice(0,30).map(c=>(
                <div key={c.id} className="heatmap-cell" style={{background:c.color,height:10}} title={`Bin ${c.id}: ${c.occ}%`}/>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
 
  const renderApprovals = () => (
    <div className="fadein">
      <h2 style={{fontSize:15,fontWeight:600,marginBottom:14}}>Centro de Aprobaciones — Workflow L1/L2/L3</h2>
      {pendingApprovals.length===0 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"32px 16px",textAlign:"center",color:C.textMute,fontSize:13}}>
          <CheckCircle2 size={24} style={{display:"block",margin:"0 auto 10px",color:C.accent3}}/> Sin aprobaciones pendientes
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {pendingApprovals.map(a=>(
          <div className="card" key={a.id} style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                <span className="mono" style={{fontSize:11,color:C.accent}}>{a.id}</span>
                <span className="badge badge-purple">{a.type}</span>
                <span className="badge badge-warn">Nivel {a.level}</span>
              </div>
              <div style={{fontWeight:500,fontSize:13}}>{a.desc}</div>
              <div style={{fontSize:11,color:C.textMute}}>Solicitante: {a.requestor} · Monto: {fmtMoney(a.amount)}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-success" onClick={()=>{
                setPendingApprovals(prev=>prev.filter(x=>x.id!==a.id));
                onStatus?.(`✅ Aprobación ${a.id} confirmada — ${a.desc}`);
              }}>✓ Aprobar</button>
              <button className="btn btn-danger" onClick={()=>{
                setPendingApprovals(prev=>prev.filter(x=>x.id!==a.id));
                onStatus?.(`✕ Aprobación ${a.id} rechazada — ${a.desc}`);
              }}>✕ Rechazar</button>
              <button className="btn btn-ghost" onClick={()=>{
                onStatus?.(`${a.id} · ${a.type} · ${a.desc} · Solicitante: ${a.requestor} · Monto: ${fmtMoney(a.amount)} · Nivel: ${a.level}`);
              }}>Ver detalle</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
 
  const renderAI = () => (
    <div className="fadein">
      <h2 style={{fontSize:15,fontWeight:600,marginBottom:14}}>Motor IA Gemini — Análisis Inteligente ApexLogix</h2>
      <div className="ai-panel">
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <input
            style={{flex:1,minWidth:200}}
            value={geminiKey}
            onChange={e=>setGeminiKey(e.target.value)}
            placeholder="Gemini API Key (aistudio.google.com → Get API Key)"
            type="password"
          />
          <button className="btn btn-primary" onClick={runGemini} disabled={aiLoading}>
            {aiLoading?<span className="pulse">Analizando...</span>:<><Brain size={13}/>Analizar con IA</>}
          </button>
        </div>
        <textarea
          style={{width:"100%",minHeight:72,marginBottom:10,resize:"vertical"}}
          value={aiQuestion}
          onChange={e=>setAiQuestion(e.target.value)}
          placeholder="Escribe tu pregunta al copiloto..."
        />
        <div className="section-title"><Activity size={13}/>Respuesta del Motor IA</div>
        <div className="ai-msg">{aiLoading?"⏳ Procesando con Gemini 1.5 Flash...":aiResponse}</div>
        <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
          {["Detecta riesgos SUNAT de stock no controlado",
            "¿Qué herramientas necesitan mantenimiento urgente?",
            "Recomienda política de reposición para SKUs clase A",
            "Analiza la eficiencia de custodia de herramientas"].map(q=>(
            <button key={q} className="btn btn-ghost btn-xs" onClick={()=>setAiQuestion(q)}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
 
  const renderReports = () => (
    <div className="fadein">
      <h2 style={{fontSize:15,fontWeight:600,marginBottom:14}}>Reportes y Libros</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
        {[
          {icon:FileText,    label:"Kardex por SKU",              desc:"Movimientos con saldos valorizados PPP/FIFO"},
          {icon:BarChart3,   label:"Rotación ABC",                desc:"Clasificación por valor y frecuencia"},
          {icon:DollarSign,  label:"Valorización de Inventario",  desc:"Saldo x costo promedio ponderado"},
          {icon:QrCode,      label:"Reporte de Tokens",           desc:"Custodia activa, vencida y retornada"},
          {icon:Wrench,      label:"Historial de Mantenimiento",  desc:"Hoja de vida por activo/herramienta"},
          {icon:ClipboardList,label:"Libro de Compras",           desc:"Integración con módulo contable"},
          {icon:AlertTriangle,label:"Informe de Mermas",          desc:"Ajustes, scrap y pérdidas del período"},
          {icon:Globe,        label:"Control Tower Ejecutivo",    desc:"KPIs operativos y financieros consolidados"},
        ].map(r=>(
          <div className="card" key={r.label} style={{cursor:"pointer"}} onClick={()=>{}}>
            <r.icon size={22} style={{color:C.accent,marginBottom:8}}/>
            <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{r.label}</div>
            <div style={{fontSize:11,color:C.textMute}}>{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
 
  const renderSettings = () => (
    <div className="fadein">
      <h2 style={{fontSize:15,fontWeight:600,marginBottom:14}}>Configuración — ApexLogix Core</h2>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="card">
          <div className="section-title"><Database size={13}/>Backend API</div>
          <div className="form-grid">
            <div className="form-field" style={{gridColumn:"1/-1"}}>
              <label className="form-label">API Base URL</label>
              <input value={apiBaseUrl} onChange={e=>setApiBaseUrl(e.target.value)} placeholder="https://api.apexlogix.io/v1"/>
            </div>
            <div className="form-field">
              <label className="form-label">Tenant ID</label>
              <input value={tenantId || "11111111-1111-1111-1111-111111111111"} readOnly/>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="section-title"><Brain size={13}/>Gemini AI</div>
          <div className="form-grid">
            <div className="form-field" style={{gridColumn:"1/-1"}}>
              <label className="form-label">API Key</label>
              <input type="password" value={geminiKey} onChange={e=>setGeminiKey(e.target.value)} placeholder="AIza..."/>
            </div>
            <div className="form-field">
              <label className="form-label">Modelo</label>
              <select>
                <option>gemini-1.5-flash</option>
                <option>gemini-1.5-pro</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="section-title"><DollarSign size={13}/>Motor de Costos</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Método valorización</label>
              <select><option>PPP (Promedio Ponderado)</option><option>FIFO</option></select>
            </div>
            <div className="form-field">
              <label className="form-label">Moneda base</label>
              <select><option>PEN — Sol</option><option>USD — Dólar</option></select>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="section-title"><QrCode size={13}/>Tokens de Herramientas</div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Vigencia default</label>
              <select><option>7 días</option><option>14 días</option><option>30 días</option></select>
            </div>
            <div className="form-field">
              <label className="form-label">Alerta vencimiento</label>
              <select><option>2 días antes</option><option>1 día antes</option><option>24h antes</option></select>
            </div>
          </div>
        </div>
      </div>
      <div style={{marginTop:12,display:"flex",gap:8}}>
        <button className="btn btn-primary">Guardar configuración</button>
        <button className="btn btn-ghost">Restaurar defaults</button>
      </div>
    </div>
  );
 
  const viewRenderer = {
    dashboard: renderDashboard,
    inventory:  renderInventory,
    fulfillment: renderFulfillment,
    evidence:   renderEvidence,
    tokens:     renderTokens,
    movements:  renderMovements,
    eam:        renderEAM,
    warehouses: renderWarehouses,
    approvals:  renderApprovals,
    ai:         renderAI,
    reports:    renderReports,
    settings:   renderSettings,
  };
 
  return (
    <div className="apex-shell">
      {/* Sidebar Rail */}
      <aside
        className={`apex-rail ${railExp?"expanded":""}`}
        onMouseEnter={()=>setRailExp(true)}
        onMouseLeave={()=>setRailExp(false)}
      >
        <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8,padding:"0 8px",width:"100%"}}>
          <Warehouse size={18} style={{color:C.accent,flexShrink:0}}/>
          {railExp&&<span style={{fontSize:13,fontWeight:700,color:C.accent,whiteSpace:"nowrap"}}>ApexLogix</span>}
        </div>
        {railItems.map(item=>(
          <button
            key={item.id}
            className={`rail-item ${activeView===item.id?"active":""}`}
            onClick={()=>setActiveView(item.id)}
            title={item.label}
          >
            <item.icon size={16} style={{flexShrink:0}}/>
            <span className="rail-label">{item.label}</span>
            {item.id==="tokens"&&metrics.tokensVencidos>0&&
              <span style={{background:C.danger,borderRadius:9,fontSize:9,padding:"1px 5px",color:"#fff",marginLeft:"auto"}}>{metrics.tokensVencidos}</span>
            }
          </button>
        ))}
      </aside>
 
      {/* Main */}
      <div className="apex-main">
        {/* Topbar */}
        <header className="apex-topbar">
          <Warehouse size={16} style={{color:C.accent}}/>
          <span style={{fontWeight:700,fontSize:14,color:C.text}}>ApexLogix Core</span>
          <span className="badge badge-info" style={{fontSize:10}}>Enterprise WMS/ERP v4.0</span>
          <div style={{flex:1}}/>
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.textMute}}/>
            <input style={{paddingLeft:28,width:220}} placeholder="Buscar SKU, token, WO..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button className="btn btn-ghost" style={{position:"relative"}}>
            <Bell size={15}/>
            {alerts.length>0&&<span style={{position:"absolute",top:4,right:4,width:7,height:7,borderRadius:"50%",background:C.danger}}/>}
          </button>
          <div style={{width:28,height:28,borderRadius:"50%",background:C.accent2,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <User size={14}/>
          </div>
        </header>
 
        {/* Content */}
        <main className="apex-content">
          {(viewRenderer[activeView]||renderDashboard)()}
        </main>
      </div>
    </div>
  );
}
