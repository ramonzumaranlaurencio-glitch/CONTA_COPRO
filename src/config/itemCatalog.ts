/**
 * CATÁLOGO MAESTRO DE ARTÍCULOS DE ALMACÉN
 * Multi-empresa · Multi-rubro · PCGE Perú · NIC 2
 *
 * Código: CTA-NAT-RUB-SEQQ-TK
 *   CTA  = Cuenta PCGE de inventario (3 dígitos)
 *   NAT  = Naturaleza del bien (2 letras)
 *   RUB  = Rubro/industria (2 letras)
 *   SEQQ = Correlativo (4 dígitos)
 *   TK   = P(ermanente) | T(emporal) | F(ungible)
 */

// ============================================================
// TIPOS
// ============================================================
export type Rubro =
  | 'GE' | 'MI' | 'CO' | 'FA' | 'CM' | 'DI'
  | 'AG' | 'PE' | 'SA' | 'HO' | 'TR' | 'EN'
  | 'TE' | 'RE' | 'ED';

export type TokenTipo = 'P' | 'T' | 'F';

export interface CatalogItem {
  code: string;           // Código único del artículo
  name: string;           // Nombre principal
  aliases: string[];      // Nombres alternativos (para detección IA)
  cta: string;            // Cuenta PCGE inventario (Dr al comprar)
  cta_name: string;       // Nombre cuenta inventario
  gasto: string;          // Cuenta PCGE gasto (Dr al consumir)
  gasto_name: string;     // Nombre cuenta gasto
  nat: string;            // Naturaleza (SU, MP, ME, etc.)
  nat_name: string;       // Descripción naturaleza
  tk: TokenTipo;          // P=Permanente T=Temporal F=Fungible
  unit: string;           // Unidad de medida SUNAT
  rubros: Rubro[];        // Rubros que usan este artículo
  class_name: string;     // Clasificación PCGE legible
  description?: string;   // Descripción técnica
  ai_keywords: string[];  // Palabras clave para detección IA
}

// ============================================================
// RUBROS — DEFINICIÓN
// ============================================================
export const RUBROS_DEF: Record<Rubro, { name: string; icon: string; color: string }> = {
  GE: { name: 'General (Todas las empresas)',    icon: '🏢', color: '#58a6ff' },
  MI: { name: 'Minería',                         icon: '⛏',  color: '#d4a017' },
  CO: { name: 'Construcción',                    icon: '🏗',  color: '#e36f2a' },
  FA: { name: 'Fabricación / Manufactura',       icon: '🏭',  color: '#3fb950' },
  CM: { name: 'Comercial / Ventas',              icon: '🛒',  color: '#a371f7' },
  DI: { name: 'Distribución / Logística',        icon: '🚚',  color: '#22d3ee' },
  AG: { name: 'Agropecuario',                    icon: '🌾',  color: '#84cc16' },
  PE: { name: 'Pesca / Acuicultura',             icon: '🎣',  color: '#06b6d4' },
  SA: { name: 'Salud / Farmacéutico',            icon: '🏥',  color: '#f43f5e' },
  HO: { name: 'Hostelería / Restaurantes',       icon: '🍽',  color: '#fb923c' },
  TR: { name: 'Transporte',                      icon: '🚛',  color: '#fbbf24' },
  EN: { name: 'Energía / Utilities',             icon: '⚡',  color: '#eab308' },
  TE: { name: 'Tecnología / TI',                icon: '💻',  color: '#8b5cf6' },
  RE: { name: 'Inmobiliaria / Real Estate',      icon: '🏠',  color: '#10b981' },
  ED: { name: 'Educación',                       icon: '📚',  color: '#6366f1' },
};

// ============================================================
// MAPA DE CUENTAS PCGE
// ============================================================
export const PCGE_INVENTARIO: Record<string, string> = {
  '201': 'Mercaderías manufacturadas',
  '202': 'Mercaderías no manufacturadas',
  '211': 'Productos terminados',
  '221': 'Subproductos',
  '231': 'Productos en proceso',
  '241': 'Materias primas manufactureras',
  '242': 'Materias primas no manufactureras',
  '251': 'Materiales auxiliares',
  '252': 'Suministros',
  '253': 'Repuestos',
  '261': 'Envases',
  '262': 'Embalajes',
  '271': 'Activos NC disponibles para venta',
  '281': 'Existencias por recibir',
  '333': 'Maquinaria y equipo de explotación',
  '334': 'Unidades de transporte',
  '335': 'Muebles y enseres',
  '336': 'Equipos diversos',
  '337': 'Herramientas y unidades de reemplazo',
};

export const PCGE_GASTO: Record<string, string> = {
  '6011': 'Compras de mercaderías (manufact.)',
  '6012': 'Compras de mercaderías (no manufact.)',
  '6021': 'Compras de mat. primas (manufact.)',
  '6022': 'Compras de mat. primas (no manufact.)',
  '6031': 'Materiales auxiliares',
  '6032': 'Suministros',
  '6033': 'Repuestos',
  '6041': 'Envases',
  '6042': 'Embalajes',
  '6111': 'Variación MP manufactureras',
  '6112': 'Variación MP no manufactureras',
  '6131': 'Variación mat. auxiliares',
  '6132': 'Variación suministros',
  '6133': 'Variación repuestos',
  '6411': 'Envases y embalajes',
  '6561': 'Suministros - útiles de oficina',
  '6562': 'Suministros - combustibles',
  '6563': 'Suministros - pequeños instrumentos',
  '6564': 'Suministros - EPP',
  '6569': 'Suministros - otros',
  '6531': 'Repuestos y accesorios',
  '6811': 'Depreciación - edificios',
  '6813': 'Depreciación - maquinaria',
  '6814': 'Depreciación - transporte',
  '6815': 'Depreciación - muebles',
  '6816': 'Depreciación - equipos',
  '6817': 'Depreciación - herramientas',
  '6911': 'Costo de ventas (merc. manufact.)',
  '6912': 'Costo de ventas (merc. no manufact.)',
};

// ============================================================
// CATÁLOGO MAESTRO
// ============================================================
export const CATALOG: CatalogItem[] = [

  // ═══════════════════════════════════════════════════════════
  // CUENTA 252 — SUMINISTROS · SUMINISTROS GENERALES (GE)
  // ═══════════════════════════════════════════════════════════

  // Útiles de oficina (aplica a TODOS los rubros)
  { code:'252-SU-GE-0001-F', name:'Papel Bond A4 75g (millar)',       aliases:['papel bond a4','papel fotocopia a4','papel bond 75'],                cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'MIL', rubros:['GE','MI','CO','FA','CM','DI','AG','PE','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['papel','bond','a4','fotocopia','millar','resma'] },
  { code:'252-SU-GE-0002-F', name:'Papel Bond A4 80g (millar)',       aliases:['papel bond 80','papel a4 80g','resma 80g'],                         cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'MIL', rubros:['GE','MI','CO','FA','CM','DI','AG','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['papel','bond','80g','a4','resma'] },
  { code:'252-SU-GE-0003-F', name:'Papel Bond A3 75g (millar)',       aliases:['papel a3','bond a3'],                                               cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'MIL', rubros:['GE','FA','CM','TE','RE','ED'], class_name:'Suministros', ai_keywords:['papel','a3','bond','plano'] },
  { code:'252-SU-GE-0004-F', name:'Tóner impresora HP LaserJet',      aliases:['toner hp','cartucho laser hp','toner laserjet'],                    cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','CM','DI','AG','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['toner','cartucho','hp','laser','impresora'] },
  { code:'252-SU-GE-0005-F', name:'Tóner impresora Epson / Canon',    aliases:['toner epson','cartucho epson','toner canon'],                       cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','CM','DI','SA','HO','TE','RE','ED'], class_name:'Suministros', ai_keywords:['toner','cartucho','epson','canon','inyeccion'] },
  { code:'252-SU-GE-0006-F', name:'Útiles de escritorio (set)',       aliases:['utiles oficina','articulos escritorio','materiales de oficina'],     cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'SET', rubros:['GE','MI','CO','FA','CM','DI','AG','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['utiles','escritorio','lapiz','boligrafo','archivador','folder'] },
  { code:'252-SU-GE-0007-F', name:'Archivadores y fólderes',          aliases:['archivador','folder manila','legajador'],                           cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','CM','DI','AG','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['archivador','folder','legajador','manila'] },
  { code:'252-SU-GE-0008-F', name:'Cinta adhesiva / masking tape',    aliases:['cinta scotch','masking tape','cinta adhesiva'],                     cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Útiles de oficina', nat:'SU', nat_name:'Suministro Oficina', tk:'F', unit:'UND', rubros:['GE','CO','FA','CM','DI','SA','HO','EN','RE'], class_name:'Suministros', ai_keywords:['cinta','scotch','masking','adhesiva','tape'] },

  // Combustibles y lubricantes (TODOS)
  { code:'252-CO-GE-0001-F', name:'Gasolina 84 octanos (galón)',      aliases:['gasolina 84','combustible 84','gasohol 84'],                        cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Combustible', tk:'F', unit:'GLN', rubros:['GE','MI','CO','FA','CM','DI','AG','PE','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['gasolina','84','combustible','gasohol','galones'] },
  { code:'252-CO-GE-0002-F', name:'Gasolina 90 octanos (galón)',      aliases:['gasolina 90','combustible 90','gasohol 90'],                        cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Combustible', tk:'F', unit:'GLN', rubros:['GE','MI','CO','FA','CM','DI','AG','TR','EN','RE'], class_name:'Suministros', ai_keywords:['gasolina','90','combustible','gasohol'] },
  { code:'252-CO-GE-0003-F', name:'Gasolina 95 octanos (galón)',      aliases:['gasolina 95','combustible 95','premium 95'],                        cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Combustible', tk:'F', unit:'GLN', rubros:['GE','CM','DI','TR','TE','RE'], class_name:'Suministros', ai_keywords:['gasolina','95','premium','combustible'] },
  { code:'252-CO-GE-0004-F', name:'Petróleo Diesel B5 (galón)',       aliases:['diesel','petroleo','b5','diesel b5'],                               cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Combustible', tk:'F', unit:'GLN', rubros:['GE','MI','CO','FA','DI','AG','PE','TR','EN','RE'], class_name:'Suministros', ai_keywords:['diesel','petroleo','b5','combustible','gasoil'] },
  { code:'252-CO-GE-0005-F', name:'Gas Natural Vehicular GNV (m³)',   aliases:['gnv','gas natural vehicular','gas comprimido'],                     cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Combustible', tk:'F', unit:'M3',  rubros:['GE','DI','TR','HO','EN'], class_name:'Suministros', ai_keywords:['gnv','gas','natural','vehicular','comprimido'] },
  { code:'252-CO-GE-0006-F', name:'Aceite motor SAE 20W50 (galón)',   aliases:['aceite motor 20w50','lubricante motor','aceite 20w50'],              cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Combustible/Lubricante', tk:'F', unit:'GLN', rubros:['GE','MI','CO','FA','DI','AG','TR','EN','RE'], class_name:'Suministros', ai_keywords:['aceite','motor','20w50','lubricante','sae'] },
  { code:'252-CO-GE-0007-F', name:'Aceite motor SAE 15W40 (galón)',   aliases:['aceite 15w40','lubricante 15w40'],                                  cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Lubricante', tk:'F', unit:'GLN', rubros:['GE','MI','CO','FA','DI','AG','TR','EN'], class_name:'Suministros', ai_keywords:['aceite','15w40','lubricante','motor','sae'] },
  { code:'252-CO-GE-0008-F', name:'Grasa multiusos (kg)',             aliases:['grasa industrial','grasa multiuso','grasa litica'],                 cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Lubricante', tk:'F', unit:'KGM', rubros:['GE','MI','CO','FA','DI','AG','TR','EN'], class_name:'Suministros', ai_keywords:['grasa','lubricante','industrial','multiuso'] },

  // EPP — Equipos de Protección Personal (TODOS)
  { code:'252-EP-GE-0001-F', name:'Casco de seguridad Clase E',       aliases:['casco seguridad','casco de obra','casco industrial'],               cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','AG','PE','EN','RE'], class_name:'Suministros', ai_keywords:['casco','seguridad','industrial','obra','clase e'] },
  { code:'252-EP-GE-0002-F', name:'Guantes de cuero/nitrilo',         aliases:['guantes seguridad','guantes industriales','guantes trabajo'],        cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'PAR', rubros:['GE','MI','CO','FA','AG','PE','SA','EN','RE'], class_name:'Suministros', ai_keywords:['guantes','cuero','nitrilo','seguridad','proteccion'] },
  { code:'252-EP-GE-0003-F', name:'Lentes de seguridad luna clara',   aliases:['lentes seguridad','gafas proteccion','lentes industriales'],         cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','AG','PE','SA','EN','RE'], class_name:'Suministros', ai_keywords:['lentes','gafas','seguridad','industrial','luna','clear'] },
  { code:'252-EP-GE-0004-F', name:'Zapatos de seguridad punta acero', aliases:['zapatos seguridad','botas industrial','calzado seguridad'],          cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'PAR', rubros:['GE','MI','CO','FA','AG','PE','EN','RE'], class_name:'Suministros', ai_keywords:['zapatos','botas','seguridad','punta','acero','calzado'] },
  { code:'252-EP-GE-0005-F', name:'Chaleco de seguridad reflectivo',  aliases:['chaleco seguridad','chaleco reflectivo','chaleco naranja'],          cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','DI','AG','PE','TR','EN','RE'], class_name:'Suministros', ai_keywords:['chaleco','seguridad','reflectivo','naranja','alta visibilidad'] },
  { code:'252-EP-GE-0006-F', name:'Protector de oídos (tapones)',     aliases:['tapon oidos','protector auditivo','orejeras'],                      cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'PAR', rubros:['GE','MI','CO','FA','AG','PE','EN'], class_name:'Suministros', ai_keywords:['tapones','oidos','protector','auditivo','orejeras'] },
  { code:'252-EP-GE-0007-F', name:'Mascarilla N95 respiratoria',      aliases:['mascarilla n95','respirador n95','mascarilla industrial'],           cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','AG','SA','EN','RE'], class_name:'Suministros', ai_keywords:['mascarilla','n95','respirador','proteccion','facial'] },
  { code:'252-EP-GE-0008-F', name:'Arnés de seguridad altura',        aliases:['arnes seguridad','arnes altura','cinturon seguridad'],              cta:'252', cta_name:'Suministros', gasto:'6564', gasto_name:'Suministros - EPP', nat:'EP', nat_name:'EPP Seguridad', tk:'F', unit:'UND', rubros:['GE','MI','CO','FA','EN','RE'], class_name:'Suministros', ai_keywords:['arnes','seguridad','altura','cinturon','caida'] },

  // Limpieza e higiene (TODOS)
  { code:'252-LI-GE-0001-F', name:'Jabón líquido antibacterial (gl)', aliases:['jabon liquido','jabon industrial','detergente liquido'],            cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros diversos', nat:'LI', nat_name:'Limpieza e Higiene', tk:'F', unit:'GLN', rubros:['GE','MI','CO','FA','CM','DI','AG','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['jabon','liquido','antibacterial','limpieza','higiene'] },
  { code:'252-LI-GE-0002-F', name:'Lejía / cloro (galón)',            aliases:['lejia','hipoclorito','cloro','desinfectante'],                       cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros diversos', nat:'LI', nat_name:'Limpieza e Higiene', tk:'F', unit:'GLN', rubros:['GE','FA','CM','DI','SA','HO','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['lejia','cloro','hipoclorito','desinfectante','blanqueador'] },
  { code:'252-LI-GE-0003-F', name:'Papel higiénico industrial',       aliases:['papel higienico','papel bano','tissue industrial'],                  cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros diversos', nat:'LI', nat_name:'Limpieza e Higiene', tk:'F', unit:'PAQ', rubros:['GE','MI','CO','FA','CM','DI','AG','SA','HO','TR','EN','TE','RE','ED'], class_name:'Suministros', ai_keywords:['papel','higienico','bano','tissue','sanitario'] },
  { code:'252-LI-GE-0004-F', name:'Detergente industrial (kg)',       aliases:['detergente','polvo limpieza','limpiador polvo'],                     cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros diversos', nat:'LI', nat_name:'Limpieza e Higiene', tk:'F', unit:'KGM', rubros:['GE','MI','CO','FA','CM','DI','SA','HO','EN','RE','ED'], class_name:'Suministros', ai_keywords:['detergente','polvo','limpieza','industrial','lavado'] },

  // ═══════════════════════════════════════════════════════════
  // MINERÍA (MI)
  // ═══════════════════════════════════════════════════════════
  { code:'252-EX-MI-0001-F', name:'ANFO explosivo (kg)',              aliases:['anfo','explosivo anfo','nitrato amonio fuel oil'],                   cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Suministros explosivos', nat:'EX', nat_name:'Explosivo', tk:'F', unit:'KGM', rubros:['MI','CO'], class_name:'Suministros', ai_keywords:['anfo','explosivo','nitrato','amonio','fuel oil','voladura'] },
  { code:'252-EX-MI-0002-F', name:'Dinamita gelatinosa 60%',         aliases:['dinamita','explosivo dinamita','gelignita'],                         cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Suministros explosivos', nat:'EX', nat_name:'Explosivo', tk:'F', unit:'KGM', rubros:['MI','CO'], class_name:'Suministros', ai_keywords:['dinamita','explosivo','gelatina','voladura','60%'] },
  { code:'252-EX-MI-0003-F', name:'Detonador no eléctrico NONEL',    aliases:['detonador nonel','fulminante nonel','iniciador'],                    cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Suministros explosivos', nat:'EX', nat_name:'Explosivo', tk:'F', unit:'UND', rubros:['MI','CO'], class_name:'Suministros', ai_keywords:['detonador','nonel','no electrico','fulminante','iniciador'] },
  { code:'252-EX-MI-0004-F', name:'Mecha de seguridad (m)',          aliases:['mecha seguridad','mecha lenta','cordón mecha'],                      cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Suministros explosivos', nat:'EX', nat_name:'Explosivo', tk:'F', unit:'MTR', rubros:['MI','CO'], class_name:'Suministros', ai_keywords:['mecha','seguridad','lenta','cordon','voladura'] },
  { code:'252-QU-MI-0001-F', name:'Ácido sulfúrico 98% (kg)',        aliases:['acido sulfurico','h2so4','acido para lixiviacion'],                  cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros químicos', nat:'QU', nat_name:'Químico Industrial', tk:'F', unit:'KGM', rubros:['MI'], class_name:'Suministros', ai_keywords:['acido','sulfurico','h2so4','quimico','lixiviacion'] },
  { code:'252-QU-MI-0002-F', name:'Cal viva (saco 40 kg)',           aliases:['cal viva','oxido calcio','cal industrial'],                          cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros químicos', nat:'QU', nat_name:'Químico Industrial', tk:'F', unit:'SAC', rubros:['MI','CO'], class_name:'Suministros', ai_keywords:['cal','viva','oxido','calcio','industrial','saco'] },
  { code:'252-QU-MI-0003-F', name:'Cianuro de sodio (kg)',           aliases:['cianuro sodio','nacn','reactivo cianuración'],                       cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros químicos', nat:'QU', nat_name:'Químico Industrial', tk:'F', unit:'KGM', rubros:['MI'], class_name:'Suministros', ai_keywords:['cianuro','sodio','nacn','cianuración','reactivo'] },
  { code:'242-MM-MI-0001-F', name:'Mineral de cobre (concentrado)',  aliases:['concentrado cobre','mineral cobre','cu concentrado'],                 cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MM', nat_name:'Mineral', tk:'F', unit:'TON', rubros:['MI'], class_name:'Materias Primas', ai_keywords:['mineral','cobre','concentrado','cu','mineria'] },
  { code:'242-MM-MI-0002-F', name:'Mineral de zinc (concentrado)',   aliases:['concentrado zinc','mineral zinc','zn concentrado'],                   cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MM', nat_name:'Mineral', tk:'F', unit:'TON', rubros:['MI'], class_name:'Materias Primas', ai_keywords:['mineral','zinc','concentrado','zn'] },
  { code:'253-RM-MI-0001-F', name:'Broca de perforación (pulgada)',  aliases:['broca minera','bit perforacion','broca tricono'],                    cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RM', nat_name:'Repuesto Mecánico', tk:'T', unit:'UND', rubros:['MI'], class_name:'Repuestos', ai_keywords:['broca','perforacion','bit','tricono','roca'] },
  { code:'333-MQ-MI-0001-P', name:'Perforadora neumática Jackleg',   aliases:['jackleg','perforadora neumatica','rompedor neumatico'],               cta:'333', cta_name:'Maquinaria y equipo', gasto:'6813', gasto_name:'Depreciación maquinaria', nat:'MQ', nat_name:'Maquinaria Minera', tk:'P', unit:'UND', rubros:['MI'], class_name:'Activo Fijo', ai_keywords:['jackleg','perforadora','neumatica','mineria'] },

  // ═══════════════════════════════════════════════════════════
  // CONSTRUCCIÓN (CO)
  // ═══════════════════════════════════════════════════════════
  { code:'241-MC-CO-0001-F', name:'Cemento Portland Tipo I x 42.5kg',aliases:['cemento portland','cemento tipo i','cemento 42.5kg','cpo'],           cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MC', nat_name:'Mat. Construcción', tk:'F', unit:'BOL', rubros:['CO','FA','RE'], class_name:'Materias Primas', ai_keywords:['cemento','portland','tipo i','42.5','saco','bolsa','cpo'] },
  { code:'241-MC-CO-0002-F', name:'Cemento Andino Tipo V x 42.5kg',  aliases:['cemento andino','cemento tipo v','cemento resistente sulfatos'],     cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MC', nat_name:'Mat. Construcción', tk:'F', unit:'BOL', rubros:['CO','FA'], class_name:'Materias Primas', ai_keywords:['cemento','andino','tipo v','42.5','sulfatos'] },
  { code:'241-MC-CO-0003-F', name:'Acero corrugado Grado 60 3/8"',   aliases:['fierro 3/8','acero 3/8','varilla corrugada 3/8','barra acero'],      cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MC', nat_name:'Mat. Construcción', tk:'F', unit:'BAR', rubros:['CO','FA'], class_name:'Materias Primas', ai_keywords:['acero','fierro','3/8','corrugado','grado 60','barra'] },
  { code:'241-MC-CO-0004-F', name:'Acero corrugado Grado 60 1/2"',   aliases:['fierro 1/2','acero 1/2','varilla 1/2','barra 1/2'],                  cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MC', nat_name:'Mat. Construcción', tk:'F', unit:'BAR', rubros:['CO','FA'], class_name:'Materias Primas', ai_keywords:['acero','fierro','1/2','corrugado','barra'] },
  { code:'241-MC-CO-0005-F', name:'Acero corrugado Grado 60 5/8"',   aliases:['fierro 5/8','acero 5/8','varilla 5/8'],                             cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MC', nat_name:'Mat. Construcción', tk:'F', unit:'BAR', rubros:['CO','FA'], class_name:'Materias Primas', ai_keywords:['acero','fierro','5/8','corrugado','barra'] },
  { code:'242-MC-CO-0001-F', name:'Arena gruesa de río (m³)',         aliases:['arena gruesa','arena de rio','arena para construccion'],              cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MC', nat_name:'Agregado', tk:'F', unit:'M3',  rubros:['CO'], class_name:'Materias Primas', ai_keywords:['arena','gruesa','rio','construccion','m3'] },
  { code:'242-MC-CO-0002-F', name:'Piedra chancada 3/4" (m³)',        aliases:['piedra chancada','agregado grueso','piedra 3/4'],                    cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MC', nat_name:'Agregado', tk:'F', unit:'M3',  rubros:['CO'], class_name:'Materias Primas', ai_keywords:['piedra','chancada','3/4','agregado','grueso','m3'] },
  { code:'242-MC-CO-0003-F', name:'Hormigón / Gravilla (m³)',         aliases:['hormigon','gravilla','ripio'],                                       cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MC', nat_name:'Agregado', tk:'F', unit:'M3',  rubros:['CO'], class_name:'Materias Primas', ai_keywords:['hormigon','gravilla','ripio','agregado'] },
  { code:'241-MC-CO-0006-F', name:'Ladrillo King Kong 18 huecos',     aliases:['ladrillo kk','ladrillo 18h','ladrillo king kong'],                   cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MC', nat_name:'Mat. Construcción', tk:'F', unit:'UND', rubros:['CO','RE'], class_name:'Materias Primas', ai_keywords:['ladrillo','king kong','18 huecos','arcilla'] },
  { code:'241-MC-CO-0007-F', name:'Madera tornillo 2"x3" (pie tablar)',aliases:['madera tornillo','tornillo 2x3','madera encofrado'],                cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MF', nat_name:'Mat. Forestal/Madera', tk:'F', unit:'PTA', rubros:['CO','FA','RE'], class_name:'Materias Primas', ai_keywords:['madera','tornillo','pie tablar','encofrado','2x3'] },
  { code:'241-MC-CO-0008-F', name:'Triplay 4mm 1.22x2.44m',          aliases:['triplay','madera triplay','plywood'],                                cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MF', nat_name:'Mat. Forestal/Madera', tk:'F', unit:'PLN', rubros:['CO','FA','RE'], class_name:'Materias Primas', ai_keywords:['triplay','plywood','madera','encofrado','4mm'] },
  // Mercaderías de construcción (materiales acabados para venta/uso)
  { code:'202-ME-CO-0001-F', name:'Tubería PVC SAP 4" desagüe x 3m', aliases:['tubo pvc 4','tuberia pvc desague','pvc 4 pulg'],                     cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Construcción', tk:'F', unit:'UND', rubros:['CO','CM','RE'], class_name:'Mercaderías', ai_keywords:['tubo','tuberia','pvc','4','desague','sap','nicoll'] },
  { code:'202-ME-CO-0002-F', name:'Tubería PVC SAP 2" presión x 5m', aliases:['tubo pvc 2','tuberia pvc presion','pvc 2 presion'],                   cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Construcción', tk:'F', unit:'UND', rubros:['CO','CM','RE'], class_name:'Mercaderías', ai_keywords:['tubo','pvc','2','presion','sap'] },
  { code:'202-ME-CO-0003-F', name:'Cable NYY 3x6mm² (m)',            aliases:['cable nyy','cable thw','conductor electrico'],                         cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Eléctrica', tk:'F', unit:'MTR', rubros:['CO','CM','EN','RE'], class_name:'Mercaderías', ai_keywords:['cable','nyy','conductor','electrico','3x6'] },
  // Herramientas de obra
  { code:'337-HT-CO-0001-T', name:'Mezcladora concreto 9P³ diesel',  aliases:['mezcladora concreto','hormigonera 9p','mezcladora diesel'],           cta:'337', cta_name:'Herramientas y utensilios', gasto:'6817', gasto_name:'Depreciación herramientas', nat:'HT', nat_name:'Herramienta Temporal', tk:'T', unit:'UND', rubros:['CO','FA'], class_name:'Activo Fijo', ai_keywords:['mezcladora','concreto','hormigonera','diesel','9p'] },
  { code:'337-HT-CO-0002-T', name:'Vibrador de concreto c/manguera', aliases:['vibrador concreto','vibrador electrico','aguja vibradora'],           cta:'337', cta_name:'Herramientas y utensilios', gasto:'6817', gasto_name:'Depreciación herramientas', nat:'HT', nat_name:'Herramienta Temporal', tk:'T', unit:'UND', rubros:['CO','FA'], class_name:'Activo Fijo', ai_keywords:['vibrador','concreto','aguja','manguera','electrico'] },
  { code:'337-HT-CO-0003-T', name:'Andamio tubular modular (paño)',  aliases:['andamio tubular','andamio metalico','scaffolding'],                   cta:'337', cta_name:'Herramientas y utensilios', gasto:'6817', gasto_name:'Depreciación herramientas', nat:'HT', nat_name:'Herramienta Temporal', tk:'T', unit:'PAR', rubros:['CO','FA','RE'], class_name:'Activo Fijo', ai_keywords:['andamio','tubular','metalico','scaffolding'] },
  { code:'337-HE-CO-0001-P', name:'Amoladora angular 7" 2200W',      aliases:['amoladora 7','esmeril angular','grinder 7'],                         cta:'337', cta_name:'Herramientas y utensilios', gasto:'6817', gasto_name:'Depreciación herramientas', nat:'HE', nat_name:'Herramienta Permanente', tk:'P', unit:'UND', rubros:['GE','CO','FA','MI','EN','RE'], class_name:'Activo Fijo', ai_keywords:['amoladora','angular','7','grinder','esmeril','bosch','dewalt'] },
  { code:'337-HE-CO-0002-P', name:'Taladro percutor 13mm SDS',       aliases:['taladro percutor','taladro sds','taladro electrico'],                 cta:'337', cta_name:'Herramientas y utensilios', gasto:'6817', gasto_name:'Depreciación herramientas', nat:'HE', nat_name:'Herramienta Permanente', tk:'P', unit:'UND', rubros:['GE','CO','FA','MI','EN','RE'], class_name:'Activo Fijo', ai_keywords:['taladro','percutor','sds','electrico','bosch','makita'] },
  { code:'337-HE-GE-0001-P', name:'Nivel láser rotativo',            aliases:['nivel laser','nivel giratorio','nivel electronico'],                  cta:'337', cta_name:'Herramientas y utensilios', gasto:'6817', gasto_name:'Depreciación herramientas', nat:'HE', nat_name:'Herramienta Permanente', tk:'P', unit:'UND', rubros:['CO','FA','RE'], class_name:'Activo Fijo', ai_keywords:['nivel','laser','rotativo','electronico'] },

  // ═══════════════════════════════════════════════════════════
  // FABRICACIÓN (FA)
  // ═══════════════════════════════════════════════════════════
  { code:'241-MP-FA-0001-F', name:'Bobina acero inoxidable 304 (kg)',alias:['bobina acero inox','acero inoxidable 304','lamina inox'],                cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MP', nat_name:'Materia Prima Manufact.', tk:'F', unit:'KGM', rubros:['FA'], class_name:'Materias Primas', ai_keywords:['bobina','acero','inoxidable','304','lamina','inox'] } as any,
  { code:'241-MP-FA-0002-F', name:'Plancha de acero A36 1/4" (kg)',   aliases:['plancha acero','lamina acero a36','plancha 1/4'],                    cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MP', nat_name:'Materia Prima Manufact.', tk:'F', unit:'KGM', rubros:['FA','CO'], class_name:'Materias Primas', ai_keywords:['plancha','acero','a36','lamina','1/4'] },
  { code:'241-MP-FA-0003-F', name:'PVC granulado natural (kg)',        aliases:['pvc granulo','resina pvc','granza pvc'],                            cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MP', nat_name:'Materia Prima Manufact.', tk:'F', unit:'KGM', rubros:['FA'], class_name:'Materias Primas', ai_keywords:['pvc','granulo','resina','granza','polimero'] },
  { code:'241-MP-FA-0004-F', name:'Polipropileno PP copolímero (kg)', aliases:['polipropileno','pp copolimero','resina pp'],                         cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MP', nat_name:'Materia Prima Manufact.', tk:'F', unit:'KGM', rubros:['FA'], class_name:'Materias Primas', ai_keywords:['polipropileno','pp','copolimero','resina','plastico'] },
  { code:'241-MP-FA-0005-F', name:'Pintura epóxica base (galón)',     aliases:['pintura epoxica','epoxy','recubrimiento epoxico'],                   cta:'241', cta_name:'Materias primas manufact.', gasto:'6021', gasto_name:'Compras MP manufact.', nat:'MA', nat_name:'Mat. Auxiliar', tk:'F', unit:'GLN', rubros:['FA','CO','RE'], class_name:'Materias Primas', ai_keywords:['pintura','epoxica','epoxy','base','recubrimiento'] },
  { code:'251-MA-FA-0001-F', name:'Soldadura punto azul 7018 (kg)',   aliases:['soldadura 7018','electrodo 7018','soldadura acero'],                 cta:'251', cta_name:'Materiales auxiliares', gasto:'6031', gasto_name:'Materiales auxiliares', nat:'MA', nat_name:'Mat. Auxiliar Producción', tk:'F', unit:'KGM', rubros:['FA','CO','MI'], class_name:'Materiales Auxiliares', ai_keywords:['soldadura','7018','electrodo','acero','punto azul'] },
  { code:'252-GA-FA-0001-F', name:'Oxígeno industrial (m³)',          aliases:['oxigeno industrial','gas oxigeno','cilindro oxigeno'],               cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros diversos', nat:'GA', nat_name:'Gas Industrial', tk:'F', unit:'M3',  rubros:['FA','CO','MI'], class_name:'Suministros', ai_keywords:['oxigeno','industrial','gas','cilindro','m3'] },
  { code:'252-GA-FA-0002-F', name:'Acetileno industrial (kg)',        aliases:['acetileno','gas acetileno','cilindro acetileno'],                    cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros diversos', nat:'GA', nat_name:'Gas Industrial', tk:'F', unit:'KGM', rubros:['FA','CO','MI'], class_name:'Suministros', ai_keywords:['acetileno','gas','industrial','cilindro','corte'] },
  { code:'261-EN-FA-0001-F', name:'Saco de polipropileno 50kg',       aliases:['saco pp','saco polipropileno','envase saco'],                        cta:'261', cta_name:'Envases', gasto:'6411', gasto_name:'Envases y embalajes', nat:'EC', nat_name:'Envase', tk:'F', unit:'UND', rubros:['FA','DI','AG'], class_name:'Envases', ai_keywords:['saco','polipropileno','pp','envase','50kg'] },

  // ═══════════════════════════════════════════════════════════
  // COMERCIAL (CM)
  // ═══════════════════════════════════════════════════════════
  { code:'201-ME-CM-0001-P', name:'Laptop HP Core i7 16GB 1TB',      aliases:['laptop hp','portatil hp','notebook hp'],                             cta:'201', cta_name:'Mercaderías manufact.', gasto:'6911', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería TI', tk:'P', unit:'UND', rubros:['CM','TE'], class_name:'Mercaderías', ai_keywords:['laptop','hp','core i7','notebook','portatil'] },
  { code:'201-ME-CM-0002-P', name:'Televisor LED Smart 50" 4K',       aliases:['tv smart','televisor led','smart tv 50'],                            cta:'201', cta_name:'Mercaderías manufact.', gasto:'6911', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Electrónica', tk:'P', unit:'UND', rubros:['CM'], class_name:'Mercaderías', ai_keywords:['televisor','tv','smart','led','50','4k'] },
  { code:'202-ME-CM-0001-F', name:'Calzado deportivo (par)',           aliases:['zapatilla','calzado','zapato deportivo'],                            cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Calzado', tk:'F', unit:'PAR', rubros:['CM'], class_name:'Mercaderías', ai_keywords:['calzado','zapatilla','zapato','deportivo','par'] },
  { code:'202-ME-CM-0002-F', name:'Prenda de vestir (textil)',         aliases:['ropa','prenda','textil','polo','camisa'],                            cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Textil', tk:'F', unit:'UND', rubros:['CM'], class_name:'Mercaderías', ai_keywords:['ropa','prenda','vestir','textil','polo','camisa','pantalon'] },

  // ═══════════════════════════════════════════════════════════
  // DISTRIBUCIÓN (DI)
  // ═══════════════════════════════════════════════════════════
  { code:'202-ME-DI-0001-F', name:'Arroz extra blanco (saco 50kg)',   aliases:['arroz blanco','arroz extra','arroz 50kg'],                           cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'MD', nat_name:'Mercadería Distribución', tk:'F', unit:'SAC', rubros:['DI','CM'], class_name:'Mercaderías', ai_keywords:['arroz','blanco','extra','50kg','saco'] },
  { code:'202-ME-DI-0002-F', name:'Azúcar rubia (saco 50kg)',         aliases:['azucar rubia','azucar 50kg','azucar saco'],                          cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'MD', nat_name:'Mercadería Distribución', tk:'F', unit:'SAC', rubros:['DI','CM'], class_name:'Mercaderías', ai_keywords:['azucar','rubia','50kg','saco'] },
  { code:'202-ME-DI-0003-F', name:'Aceite vegetal botella 1L',        aliases:['aceite vegetal','aceite cocinero','aceite soya'],                    cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'MD', nat_name:'Mercadería Distribución', tk:'F', unit:'UND', rubros:['DI','CM','HO'], class_name:'Mercaderías', ai_keywords:['aceite','vegetal','cocinero','soya','1l','botella'] },
  { code:'262-EM-DI-0001-F', name:'Caja de cartón exportación',       aliases:['caja exportacion','caja carton corrugado','embalaje carton'],        cta:'262', cta_name:'Embalajes', gasto:'6412', gasto_name:'Embalajes', nat:'CB', nat_name:'Embalaje Cartón', tk:'F', unit:'UND', rubros:['DI','FA','CM'], class_name:'Embalajes', ai_keywords:['caja','carton','exportacion','corrugado','embalaje'] },
  { code:'253-RN-DI-0001-T', name:'Llanta 195/65R15 (vehículo dist.)',aliases:['llanta','neumatico','goma','cubierta'],                              cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RN', nat_name:'Repuesto Neumático', tk:'T', unit:'UND', rubros:['GE','DI','TR','CM'], class_name:'Repuestos', ai_keywords:['llanta','neumatico','goma','cubierta','195/65','r15'] },

  // ═══════════════════════════════════════════════════════════
  // AGROPECUARIO (AG)
  // ═══════════════════════════════════════════════════════════
  { code:'242-MA-AG-0001-F', name:'Maíz amarillo duro (kg)',          aliases:['maiz amarillo','maiz duro','maiz grano'],                            cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MA', nat_name:'Mat. Prima Agrícola', tk:'F', unit:'KGM', rubros:['AG','FA'], class_name:'Materias Primas', ai_keywords:['maiz','amarillo','duro','grano','kg'] },
  { code:'252-AG-AG-0001-F', name:'Urea fertilizante granulado (kg)', aliases:['urea','fertilizante urea','abono nitrogeno'],                        cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros agroquímicos', nat:'AG', nat_name:'Agroquímico', tk:'F', unit:'KGM', rubros:['AG'], class_name:'Suministros', ai_keywords:['urea','fertilizante','nitrogeno','abono','granulado'] },
  { code:'252-AG-AG-0002-F', name:'Fosfato diamónico DAP (saco)',     aliases:['dap','fosfato diamonico','fertilizante fosfatado'],                  cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros agroquímicos', nat:'AG', nat_name:'Agroquímico', tk:'F', unit:'SAC', rubros:['AG'], class_name:'Suministros', ai_keywords:['dap','fosfato','diamonico','fertilizante','fosfatado'] },
  { code:'252-AG-AG-0003-F', name:'Pesticida/Fungicida (litro)',      aliases:['pesticida','fungicida','herbicida','plaguicida'],                    cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros agroquímicos', nat:'AG', nat_name:'Agroquímico', tk:'F', unit:'LTR', rubros:['AG'], class_name:'Suministros', ai_keywords:['pesticida','fungicida','herbicida','plaguicida','litro'] },
  { code:'333-MQ-AG-0001-P', name:'Tractor agrícola 85HP 4WD',       aliases:['tractor agricola','tractor campo','tractor 85hp'],                   cta:'333', cta_name:'Maquinaria y equipo', gasto:'6813', gasto_name:'Depreciación maquinaria', nat:'MQ', nat_name:'Maquinaria Agrícola', tk:'P', unit:'UND', rubros:['AG'], class_name:'Activo Fijo', ai_keywords:['tractor','agricola','85hp','campo','4wd'] },

  // ═══════════════════════════════════════════════════════════
  // SALUD / FARMACÉUTICO (SA)
  // ═══════════════════════════════════════════════════════════
  { code:'252-ME-SA-0001-F', name:'Paracetamol 500mg x 100 tab',     aliases:['paracetamol','acetaminofen','analgesico'],                           cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros médicos', nat:'ME', nat_name:'Medicamento', tk:'F', unit:'UND', rubros:['SA'], class_name:'Suministros', ai_keywords:['paracetamol','acetaminofen','analgesico','tableta','500mg'] },
  { code:'252-ME-SA-0002-F', name:'Amoxicilina 500mg x 100 caps',    aliases:['amoxicilina','antibiotico amoxicilina'],                             cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros médicos', nat:'ME', nat_name:'Medicamento', tk:'F', unit:'UND', rubros:['SA'], class_name:'Suministros', ai_keywords:['amoxicilina','antibiotico','capsula','500mg'] },
  { code:'252-ME-SA-0003-F', name:'Guantes de látex médico (caja)',   aliases:['guantes latex','guantes medicos','guantes quirurgicos'],             cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros médicos', nat:'ME', nat_name:'Insumo Médico', tk:'F', unit:'CAJ', rubros:['SA'], class_name:'Suministros', ai_keywords:['guantes','latex','medico','quirurgico','caja'] },
  { code:'252-ME-SA-0004-F', name:'Jeringas hipodérmicas 5ml (caja)',  aliases:['jeringa hipordermica','jeringa 5ml','jeringa descartable'],          cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros médicos', nat:'ME', nat_name:'Insumo Médico', tk:'F', unit:'CAJ', rubros:['SA'], class_name:'Suministros', ai_keywords:['jeringa','hipordermica','5ml','descartable','caja'] },

  // ═══════════════════════════════════════════════════════════
  // HOSTELERÍA / RESTAURANTES (HO)
  // ═══════════════════════════════════════════════════════════
  { code:'252-AL-HO-0001-F', name:'Aceite vegetal 20L bidón',         aliases:['aceite 20l','aceite cocinero 20l','aceite bidon'],                   cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros alimentarios', nat:'AL', nat_name:'Alimento Insumo', tk:'F', unit:'UND', rubros:['HO'], class_name:'Suministros', ai_keywords:['aceite','vegetal','20l','bidon','cocinero'] },
  { code:'252-AL-HO-0002-F', name:'Harina de trigo 50kg (saco)',      aliases:['harina trigo','harina 50kg','harina pastelera'],                     cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros alimentarios', nat:'AL', nat_name:'Alimento Insumo', tk:'F', unit:'SAC', rubros:['HO','FA'], class_name:'Suministros', ai_keywords:['harina','trigo','50kg','saco','pastelera'] },
  { code:'252-AL-HO-0003-F', name:'Gas propano balón 10kg',           aliases:['gas propano','balon gas','garrafa gas'],                             cta:'252', cta_name:'Suministros', gasto:'6562', gasto_name:'Combustibles y lubricantes', nat:'CO', nat_name:'Combustible Gas', tk:'F', unit:'UND', rubros:['HO','FA','RE'], class_name:'Suministros', ai_keywords:['gas','propano','balon','10kg','garrafa','cocina'] },
  { code:'335-MU-HO-0001-P', name:'Juego de menaje acero inox.',      aliases:['menaje restaurante','cubiertos','vajilla'],                          cta:'335', cta_name:'Muebles y enseres', gasto:'6815', gasto_name:'Depreciación muebles', nat:'MU', nat_name:'Mueble/Enser', tk:'P', unit:'JGO', rubros:['HO'], class_name:'Activo Fijo', ai_keywords:['menaje','cubiertos','vajilla','acero','inox','restaurante'] },

  // ═══════════════════════════════════════════════════════════
  // TRANSPORTE (TR)
  // ═══════════════════════════════════════════════════════════
  { code:'253-RV-TR-0001-T', name:'Llanta 295/80R22.5 camión',       aliases:['llanta camion','neumatico camion','cubierta 22.5'],                   cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RN', nat_name:'Repuesto Neumático', tk:'T', unit:'UND', rubros:['TR','DI'], class_name:'Repuestos', ai_keywords:['llanta','camion','295/80','neumatico','22.5'] },
  { code:'253-RV-TR-0002-T', name:'Filtro de aceite motor (pieza)',   aliases:['filtro aceite','filtro motor','filter oil'],                          cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RM', nat_name:'Repuesto Mecánico', tk:'T', unit:'UND', rubros:['GE','TR','DI','MI','CO','FA'], class_name:'Repuestos', ai_keywords:['filtro','aceite','motor','oil','pieza'] },
  { code:'253-RV-TR-0003-T', name:'Pastillas de freno (juego)',       aliases:['pastillas freno','zapata freno','brake pads'],                        cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RM', nat_name:'Repuesto Mecánico', tk:'T', unit:'JGO', rubros:['GE','TR','DI','MI','CO'], class_name:'Repuestos', ai_keywords:['pastillas','freno','zapata','brake','pads'] },
  { code:'334-VH-TR-0001-P', name:'Camión de carga 10 tn.',          aliases:['camion carga','camion 10tn','furgon carga'],                          cta:'334', cta_name:'Unidades de transporte', gasto:'6814', gasto_name:'Depreciación transp.', nat:'VH', nat_name:'Vehículo', tk:'P', unit:'UND', rubros:['TR','DI','MI','CO','AG'], class_name:'Activo Fijo', ai_keywords:['camion','carga','10tn','transporte','furgon'] },
  { code:'334-VH-GE-0001-P', name:'Camioneta Pick-Up 4x4 diesel',    aliases:['camioneta 4x4','hilux','pick-up diesel','camioneta'],                 cta:'334', cta_name:'Unidades de transporte', gasto:'6814', gasto_name:'Depreciación transp.', nat:'VH', nat_name:'Vehículo', tk:'P', unit:'UND', rubros:['GE','MI','CO','FA','AG','TR','DI'], class_name:'Activo Fijo', ai_keywords:['camioneta','hilux','pickup','4x4','diesel','toyota'] },

  // ═══════════════════════════════════════════════════════════
  // ENERGÍA / UTILITIES (EN)
  // ═══════════════════════════════════════════════════════════
  { code:'202-ME-EN-0001-F', name:'Cable de energía THW 10mm² (m)',  aliases:['cable thw','conductor thw','cable energia'],                          cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Eléctrica', tk:'F', unit:'MTR', rubros:['EN','CO','CM'], class_name:'Mercaderías', ai_keywords:['cable','thw','conductor','energia','10mm','metro'] },
  { code:'202-ME-EN-0002-F', name:'Transformador de distribución 15KVA',aliases:['transformador','trafo 15kva','transformador electrico'],            cta:'202', cta_name:'Mercaderías no manufact.', gasto:'6912', gasto_name:'Costo de ventas merc.', nat:'ME', nat_name:'Mercadería Eléctrica', tk:'P', unit:'UND', rubros:['EN'], class_name:'Mercaderías', ai_keywords:['transformador','trafo','15kva','electrico','distribucion'] },
  { code:'252-GA-EN-0001-F', name:'Argón grado industrial (cilindro)',aliases:['argon','gas argon','cilindro argon'],                                 cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros diversos', nat:'GA', nat_name:'Gas Industrial', tk:'F', unit:'UND', rubros:['EN','FA','MI'], class_name:'Suministros', ai_keywords:['argon','gas','industrial','cilindro','soldadura'] },

  // ═══════════════════════════════════════════════════════════
  // TECNOLOGÍA / TI (TE)
  // ═══════════════════════════════════════════════════════════
  { code:'336-EQ-TE-0001-P', name:'Servidor rack Dell PowerEdge',     aliases:['servidor rack','server dell','servidor empresa'],                    cta:'336', cta_name:'Equipos diversos', gasto:'6816', gasto_name:'Depreciación equipos', nat:'EQ', nat_name:'Equipo TI', tk:'P', unit:'UND', rubros:['TE','FA','CM','DI'], class_name:'Activo Fijo', ai_keywords:['servidor','rack','dell','poweredge','server'] },
  { code:'336-EQ-TE-0002-P', name:'Switch administrable 24 puertos',  aliases:['switch red','switch 24p','conmutador red'],                          cta:'336', cta_name:'Equipos diversos', gasto:'6816', gasto_name:'Depreciación equipos', nat:'EQ', nat_name:'Equipo TI', tk:'P', unit:'UND', rubros:['TE','CM','FA','DI'], class_name:'Activo Fijo', ai_keywords:['switch','red','24','puertos','administrable','conmutador'] },
  { code:'252-TI-GE-0001-F', name:'Disco SSD 1TB (unidad)',           aliases:['ssd 1tb','disco solido','unidad ssd'],                               cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Suministros TI', nat:'TI', nat_name:'Suministro TI', tk:'F', unit:'UND', rubros:['GE','TE','CM','FA','DI'], class_name:'Suministros', ai_keywords:['disco','ssd','1tb','solido','unidad','almacenamiento'] },
  { code:'252-TI-GE-0002-F', name:'Memoria RAM DDR4 8GB',            aliases:['ram 8gb','memoria 8gb','modulo ram ddr4'],                            cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Suministros TI', nat:'TI', nat_name:'Suministro TI', tk:'F', unit:'UND', rubros:['GE','TE','CM','FA'], class_name:'Suministros', ai_keywords:['ram','8gb','memoria','ddr4','modulo'] },
  { code:'252-TI-GE-0003-F', name:'Cable UTP cat6 (m)',              aliases:['cable utp','cable red cat6','cable ethernet'],                          cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Suministros TI', nat:'TI', nat_name:'Suministro TI', tk:'F', unit:'MTR', rubros:['GE','TE','CM','FA','DI','EN'], class_name:'Suministros', ai_keywords:['cable','utp','cat6','red','ethernet','metro'] },

  // ═══════════════════════════════════════════════════════════
  // INMOBILIARIA / REAL ESTATE (RE)
  // ═══════════════════════════════════════════════════════════
  { code:'242-MC-RE-0001-F', name:'Porcelanato 60x60 rectificado',    aliases:['porcelanato','ceramica 60x60','piso ceramico'],                      cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MC', nat_name:'Mat. Acabados', tk:'F', unit:'M2',  rubros:['RE','CO'], class_name:'Materias Primas', ai_keywords:['porcelanato','ceramica','60x60','rectificado','piso'] },
  { code:'242-MC-RE-0002-F', name:'Pintura látex interior (galón)',    aliases:['pintura latex','pintura interior','latex vinilico'],                 cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MC', nat_name:'Mat. Acabados', tk:'F', unit:'GLN', rubros:['RE','CO','FA'], class_name:'Materias Primas', ai_keywords:['pintura','latex','interior','gallon','vinilico'] },
  { code:'242-MC-RE-0003-F', name:'Porcelana sanitaria blanca',       aliases:['inodoro','lavatorio','sanitario','poza'],                            cta:'242', cta_name:'Materias primas no manufact.', gasto:'6022', gasto_name:'Compras MP no manufact.', nat:'MC', nat_name:'Mat. Sanitarios', tk:'F', unit:'UND', rubros:['RE','CO'], class_name:'Materias Primas', ai_keywords:['inodoro','lavatorio','sanitario','porcelana','blanca'] },

  // ═══════════════════════════════════════════════════════════
  // EDUCACIÓN (ED)
  // ═══════════════════════════════════════════════════════════
  { code:'252-SU-ED-0001-F', name:'Material didáctico escolar (set)',  aliases:['material didactico','material escolar','kit didactico'],             cta:'252', cta_name:'Suministros', gasto:'6561', gasto_name:'Suministros educativos', nat:'SU', nat_name:'Suministro Educativo', tk:'F', unit:'SET', rubros:['ED'], class_name:'Suministros', ai_keywords:['material','didactico','escolar','kit','educativo'] },
  { code:'252-SU-ED-0002-F', name:'Reactivos de laboratorio (kit)',    aliases:['reactivo laboratorio','kit laboratorio','quimico laboratorio'],      cta:'252', cta_name:'Suministros', gasto:'6569', gasto_name:'Suministros laboratorio', nat:'QU', nat_name:'Reactivo Laboratorio', tk:'F', unit:'KIT', rubros:['ED','SA'], class_name:'Suministros', ai_keywords:['reactivo','laboratorio','kit','quimico','escolar'] },

  // ═══════════════════════════════════════════════════════════
  // REPUESTOS GENERALES (GE)
  // ═══════════════════════════════════════════════════════════
  { code:'253-RM-GE-0001-T', name:'Correa de transmisión (und)',      aliases:['correa transmision','faja transmision','belt transmision'],           cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RM', nat_name:'Repuesto Mecánico', tk:'T', unit:'UND', rubros:['GE','FA','MI','CO','AG'], class_name:'Repuestos', ai_keywords:['correa','transmision','faja','belt'] },
  { code:'253-RE-GE-0001-T', name:'Relé termomagnético 10A',          aliases:['rele termomagnetico','disyuntor','protector termico'],                cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RE', nat_name:'Repuesto Eléctrico', tk:'T', unit:'UND', rubros:['GE','FA','MI','CO','EN'], class_name:'Repuestos', ai_keywords:['rele','termomagnetico','disyuntor','protector','termico'] },
  { code:'253-RI-GE-0001-T', name:'Disco duro HDD 2TB servidor',      aliases:['disco duro','hdd 2tb','unidad hdd servidor'],                         cta:'253', cta_name:'Repuestos', gasto:'6531', gasto_name:'Repuestos y accesorios', nat:'RI', nat_name:'Repuesto Informático', tk:'T', unit:'UND', rubros:['GE','TE','CM','FA'], class_name:'Repuestos', ai_keywords:['disco','duro','hdd','2tb','servidor'] },

  // ═══════════════════════════════════════════════════════════
  // ACTIVOS FIJOS GENERALES (GE)
  // ═══════════════════════════════════════════════════════════
  { code:'336-EQ-GE-0001-P', name:'Computadora de escritorio Core i5',aliases:['pc escritorio','desktop core i5','computadora oficina'],              cta:'336', cta_name:'Equipos diversos', gasto:'6816', gasto_name:'Depreciación equipos', nat:'EQ', nat_name:'Equipo Cómputo', tk:'P', unit:'UND', rubros:['GE','MI','CO','FA','CM','DI','SA','HO','TR','EN','TE','RE','ED'], class_name:'Activo Fijo', ai_keywords:['computadora','pc','desktop','escritorio','core i5'] },
  { code:'336-EQ-GE-0002-P', name:'Impresora multifuncional láser',   aliases:['impresora laser','multifuncional','impresora oficina'],               cta:'336', cta_name:'Equipos diversos', gasto:'6816', gasto_name:'Depreciación equipos', nat:'EQ', nat_name:'Equipo Cómputo', tk:'P', unit:'UND', rubros:['GE','MI','CO','FA','CM','DI','SA','HO','TR','EN','TE','RE','ED'], class_name:'Activo Fijo', ai_keywords:['impresora','laser','multifuncional','oficina'] },
  { code:'335-MU-GE-0001-P', name:'Escritorio ejecutivo 1.60m',       aliases:['escritorio','escritorio oficina','modulo trabajo'],                   cta:'335', cta_name:'Muebles y enseres', gasto:'6815', gasto_name:'Depreciación muebles', nat:'MU', nat_name:'Mueble/Enser', tk:'P', unit:'UND', rubros:['GE','CM','DI','SA','HO','TE','RE','ED'], class_name:'Activo Fijo', ai_keywords:['escritorio','ejecutivo','oficina','mueble','1.60m'] },
  { code:'335-MU-GE-0002-P', name:'Silla ergonómica de oficina',      aliases:['silla oficina','silla ergonomica','silla ejecutiva'],                 cta:'335', cta_name:'Muebles y enseres', gasto:'6815', gasto_name:'Depreciación muebles', nat:'MU', nat_name:'Mueble/Enser', tk:'P', unit:'UND', rubros:['GE','CM','DI','SA','HO','TE','RE','ED'], class_name:'Activo Fijo', ai_keywords:['silla','ergonomica','oficina','ejecutiva','mueble'] },
  { code:'333-MQ-GE-0001-P', name:'Compresora de aire 100L 3HP',      aliases:['compresora aire','compresora 100l','compresora 3hp'],                 cta:'333', cta_name:'Maquinaria y equipo', gasto:'6813', gasto_name:'Depreciación maquinaria', nat:'MQ', nat_name:'Maquinaria', tk:'P', unit:'UND', rubros:['GE','CO','FA','MI','TR'], class_name:'Activo Fijo', ai_keywords:['compresora','aire','100l','3hp','industrial'] },
  { code:'333-MQ-GE-0002-P', name:'Grupo electrógeno 15KVA diesel',   aliases:['generador','grupo electrogeno','generador 15kva'],                   cta:'333', cta_name:'Maquinaria y equipo', gasto:'6813', gasto_name:'Depreciación maquinaria', nat:'MQ', nat_name:'Maquinaria', tk:'P', unit:'UND', rubros:['GE','MI','CO','FA','TR','AG'], class_name:'Activo Fijo', ai_keywords:['generador','grupo electrogeno','15kva','diesel'] },
];

// ============================================================
// FUNCIONES DE BÚSQUEDA Y MATCHING
// ============================================================

/** Filtra el catálogo por rubro(s) */
export function getCatalogByRubro(rubros: Rubro[]): CatalogItem[] {
  return CATALOG.filter(item => item.rubros.some(r => rubros.includes(r)));
}

/** Filtra por cuenta PCGE de inventario */
export function getCatalogByCta(cta: string): CatalogItem[] {
  return CATALOG.filter(item => item.cta === cta);
}

/** Matching IA: dada una descripción de factura, encuentra el artículo más cercano */
export function matchCatalogItem(
  description: string,
  accountCode?: string,
  rubro?: Rubro,
): CatalogItem | null {
  const desc = description.toLowerCase();
  const pool = rubro
    ? CATALOG.filter(i => i.rubros.includes(rubro) || i.rubros.includes('GE'))
    : CATALOG;

  // 1. Búsqueda exacta por keywords IA
  let best: CatalogItem | null = null;
  let bestScore = 0;

  for (const item of pool) {
    // Filtrar primero por cuenta PCGE si se provee
    // Comparar CTA del catálogo (3 dígitos) con los primeros 3 dígitos del account_code PCGE
    // Permite que "2522" coincida con items cuyo cta es "252"
    if (accountCode && item.cta !== accountCode.slice(0, 3) && item.cta !== accountCode) continue;

    let score = 0;
    for (const kw of item.ai_keywords) {
      if (desc.includes(kw.toLowerCase())) score += 2;
    }
    for (const alias of item.aliases) {
      if (desc.includes(alias.toLowerCase())) score += 3;
    }
    if (desc.includes(item.name.toLowerCase())) score += 5;

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 2 ? best : null;
}

/** Genera el siguiente código secuencial para una CTA+NAT+RUB dado */
export function generateNextCode(
  existingCodes: string[],
  cta: string,
  nat: string,
  rub: string,
  tk: TokenTipo,
): string {
  const prefix = `${cta}-${nat}-${rub}-`;
  const existing = existingCodes
    .filter(c => c.startsWith(prefix))
    .map(c => parseInt(c.slice(prefix.length, prefix.length + 4)) || 0);
  const next = (Math.max(0, ...existing) + 1).toString().padStart(4, '0');
  return `${prefix}${next}-${tk}`;
}

/** Retorna todas las cuentas PCGE presentes en el catálogo para un rubro */
export function getCtasForRubro(rubro: Rubro): string[] {
  const ctas = new Set<string>();
  CATALOG.filter(i => i.rubros.includes(rubro)).forEach(i => ctas.add(i.cta));
  return Array.from(ctas).sort();
}
