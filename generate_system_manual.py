#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Generador de PDF Manual del Sistema CONTA_PRO Enterprise
Documento completo con explicación paso a paso de cada ventana
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak,
    Image, KeepTogether
)
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from datetime import datetime
import os

# Configuration
OUTPUT_PATH = r"C:\Users\USUARIO\Downloads\CONTA_PRO_ENTERPRISE_MASTER\MANUAL_SISTEMA_CONTA_PRO.pdf"
PAGE_SIZE = A4
MARGIN = 0.75 * inch

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._pageNumber = 0

    def showPage(self):
        self._pageNumber += 1
        super().showPage()

    def draw_page_footer(self):
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.grey)
        page_text = f"Página {self._pageNumber}"
        self.drawRightString(7.5 * inch, 0.5 * inch, page_text)
        self.drawCentredString(4.25 * inch, 0.5 * inch, "CONTA_PRO Enterprise v1.0")

def create_manual():
    """Crear el documento PDF con el manual completo"""
    
    # Setup
    styles = getSampleStyleSheet()
    
    # Estilos personalizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=12,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=8,
        spaceBefore=8,
        fontName='Helvetica-Bold',
        borderColor=colors.HexColor('#3b82f6'),
        borderWidth=2,
        borderPadding=8,
    )
    
    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6,
        spaceBefore=6,
        fontName='Helvetica-Bold',
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=8,
        leading=14,
    )
    
    # Document
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=PAGE_SIZE,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )
    
    story = []
    
    # ==================== PORTADA ====================
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("CONTA_PRO", title_style))
    story.append(Paragraph("ENTERPRISE", title_style))
    story.append(Spacer(1, 0.3 * inch))
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#3b82f6'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
    )
    story.append(Paragraph("Manual de Usuario - Sistema Contable Empresarial", subtitle_style))
    story.append(Spacer(1, 0.2 * inch))
    
    info_style = ParagraphStyle(
        'Info',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#64748b'),
    )
    story.append(Paragraph(f"Versión 1.1 | {datetime.now().strftime('%B %Y')}", info_style))
    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph("Explicación Paso a Paso de Cada Ventana", subtitle_style))
    story.append(PageBreak())
    
    # ==================== ÍNDICE ====================
    story.append(Paragraph("📑 ÍNDICE DE CONTENIDOS", heading_style))
    story.append(Spacer(1, 0.2 * inch))
    
    toc_items = [
        "1. Descripción General del Sistema",
        "2. Navegación Principal",
        "3. Dashboard - Inicio",
        "4. Contabilidad - Registro de Asientos",
        "5. Compras & Proveedores",
        "6. Ventas & Facturación",
        "7. Tesorería - Gestión de Efectivo",
        "8. Inventario - Control de Stock",
        "9. Nómina - Gestión de Empleados",
        "10. Activos Fijos - Registro y Depreciación",
        "11. CXC/CXP - Cuentas por Cobrar y Pagar",
        "12. Libros Electrónicos - Generación de PLE",
        "13. SUNAT - Cumplimiento Tributario",
        "14. Reportes Financieros",
        "15. Portal del Propietario",
        "16. Configuración General",
        "17. Flujo de Datos - Arquitectura General",
        "18. Ledger Engine - Validación Experta Antes de Guardar",
    ]
    
    for item in toc_items:
        story.append(Paragraph(f"• {item}", body_style))
    
    story.append(PageBreak())
    
    # ==================== CONTENIDO ====================
    
    # 1. Descripción General
    story.append(Paragraph("1️⃣ DESCRIPCIÓN GENERAL DEL SISTEMA", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    gen_text = """
    CONTA_PRO Enterprise es una solución integral de gestión contable y empresarial 
    diseñada para empresas medianas y grandes en Perú. El sistema integra módulos de 
    contabilidad, facturación, inventario, nómina, activos fijos y reporting, con 
    cumplimiento total de normativa SUNAT y auditoría de integridad de datos mediante 
    hash chain (cadena de hashes criptográficos).
    <br/><br/>
    <b>Características principales:</b><br/>
    • Contabilidad multimoneda con soporte para PEN y USD<br/>
    • Auditoría automática con integridad de datos mediante hashing<br/>
    • Cumplimiento SUNAT: PLE 5.1/5.2, SIRE, libros electrónicos<br/>
    • Dashboard empresarial con métricas en tiempo real<br/>
    • Generación de reportes financieros automáticos<br/>
    • Control de inventario con KARDEX<br/>
    • Gestión de proveedores y clientes<br/>
    """
    story.append(Paragraph(gen_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 2. Navegación Principal
    story.append(Paragraph("2️⃣ NAVEGACIÓN PRINCIPAL", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    nav_text = """
    La interfaz principal consta de:<br/><br/>
    <b>Barra Superior:</b> Búsqueda global (RUC, asientos, facturas, hashes), 
    indicador de auditoría activa<br/><br/>
    <b>Panel Lateral Izquierdo:</b> Menú de navegación con los siguientes módulos<br/>
    """
    story.append(Paragraph(nav_text, body_style))
    story.append(Spacer(1, 0.1 * inch))
    
    # Tabla de módulos
    module_data = [
        ['Módulo', 'Descripción', 'Acceso'],
        ['🏠 Dashboard', 'Resumen ejecutivo de métricas principales', 'Primer acceso'],
        ['📊 Contabilidad', 'Registro y análisis de asientos contables', 'Diario'],
        ['📚 Libros', 'Generación de PLE (Libro Diario, Simplificado)', 'Mensual'],
        ['📦 Inventario', 'Control de stock y movimientos de almacén', 'Diario'],
        ['👤 Owner Portal', 'Portal ejecutivo para propietarios', 'A demanda'],
        ['🧾 Ventas', 'Facturación y gestión de ventas', 'Diario'],
        ['💳 Compras', 'Registro de compras y proveedores', 'Diario'],
        ['💰 Tesorería', 'Gestión de efectivo y bancos', 'Diario'],
        ['👥 CXC/CXP', 'Cuentas por cobrar y por pagar', 'Diario'],
        ['🔧 Integraciones', 'Conexión con sistemas externos', 'Eventos'],
        ['⚙️ Configuración', 'Parámetros y ajustes del sistema', 'Admin'],
    ]
    
    module_table = Table(module_data, colWidths=[1.2*inch, 2.8*inch, 1.2*inch])
    module_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
    ]))
    story.append(module_table)
    story.append(PageBreak())
    
    # 3. Dashboard
    story.append(Paragraph("3️⃣ DASHBOARD - INICIO", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    dashboard_text = """
    El Dashboard es la pantalla de bienvenida que muestra un resumen ejecutivo de 
    la empresa en tiempo real.
    <br/><br/>
    <b>Pasos para acceder:</b><br/>
    1. Hacer clic en el icono 🏠 "Dashboard" en el panel izquierdo<br/>
    2. El sistema carga automáticamente las métricas del último período contable<br/>
    3. Se muestran 5 tarjetas principales:<br/>
    &nbsp;&nbsp;• Caja: S/ 482,900.00 (efectivo disponible)<br/>
    &nbsp;&nbsp;• CXC: S/ 1,284,320.10 (cuentas por cobrar)<br/>
    &nbsp;&nbsp;• CXP: S/ 712,008.44 (cuentas por pagar)<br/>
    &nbsp;&nbsp;• IGV: S/ 86,240.00 (impuesto retenido)<br/>
    &nbsp;&nbsp;• Resultado: S/ 392,600.18 (ganancia neta)<br/><br/>
    <b>Funcionalidades:</b><br/>
    • Exportar resumen a CSV<br/>
    • Ver detalles de cada métrica<br/>
    • Análisis de tendencias<br/>
    • Acceso rápido a otros módulos<br/>
    """
    story.append(Paragraph(dashboard_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 4. Contabilidad
    story.append(Paragraph("4️⃣ CONTABILIDAD - REGISTRO DE ASIENTOS", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    accounting_text = """
    El módulo de Contabilidad es el corazón del sistema. Aquí se registran todos 
    los movimientos contables de la empresa con auditoría integrada. Utiliza el 
    <b>Ledger Engine</b>, un flujo inteligente que valida cada asiento contra normativa 
    SUNAT y Código Tributario antes de permitir guardarlo.
    <br/><br/>
    <b>📘 INTRODUCCIÓN: QUÉ ES EL PCGE</b><br/>
    El PCGE (Plan Contable General Empresarial) es el catálogo oficial de cuentas 
    que SUNAT exige usar. Está dividido en 9 clases:<br/>
    &nbsp;&nbsp;Clase 1: Activos (dinero, bancos, maquinaria)<br/>
    &nbsp;&nbsp;Clase 2: Pasivos (deudas, préstamos)<br/>
    &nbsp;&nbsp;Clase 3: Patrimonio (capital, ganancias)<br/>
    &nbsp;&nbsp;Clase 4: Ingresos (ventas, servicios)<br/>
    &nbsp;&nbsp;Clase 5: Compras (costo de productos)<br/>
    &nbsp;&nbsp;Clase 6: Gastos (sueldos, servicios, depreciación)<br/>
    &nbsp;&nbsp;Clase 7: Costos de producción<br/>
    &nbsp;&nbsp;Clase 8: Valuación y provisiones<br/>
    &nbsp;&nbsp;Clase 9: Orden y cuentas auxiliares<br/><br/>
    
    <b>🔍 PASO 1: ACCEDER AL MÓDULO</b><br/>
    • Hacer clic en "📊 Contabilidad" en el menú izquierdo<br/>
    • Se abre la vista del Diario General (Libro Diario según SUNAT)<br/>
    • Muestra título: "FIRMAR Y BLOQUEAR CONTABILIDAD" (período actual: Mayo 2026)<br/>
    • Debajo: Tabla con todos los 3,000+ asientos del período<br/><br/>
    
    <b>📊 PASO 2: VISUALIZAR Y FILTRAR ASIENTOS</b><br/>
    La tabla principal muestra 10 columnas:<br/>
    &nbsp;&nbsp;<b>FECHA:</b> 2026-05-10 (cuándo se registró)<br/>
    &nbsp;&nbsp;<b>PERIODO:</b> 2026-05 (mes/año contable)<br/>
    &nbsp;&nbsp;<b>GLOSA:</b> "Compra factura F001-8421 a Proveedor XYZ" (descripción)<br/>
    &nbsp;&nbsp;<b>CUENTA:</b> 60111 (código PCGE, ej: 60111=Compra mercadería)<br/>
    &nbsp;&nbsp;<b>CC:</b> LIM-COM (centro de costo, opcional)<br/>
    &nbsp;&nbsp;<b>DEBE:</b> 1,000.00 (lado izquierdo del asiento)<br/>
    &nbsp;&nbsp;<b>HABER:</b> 1,000.00 (lado derecho del asiento)<br/>
    &nbsp;&nbsp;<b>ESTADO:</b> POSTED | SUNAT | REVIEW (estado SUNAT)<br/>
    &nbsp;&nbsp;<b>MODULO:</b> VENTAS | COMPRAS | TESORERIA (de dónde vino)<br/>
    &nbsp;&nbsp;<b>HASH:</b> e8f2c1a7b9d3... (huella digital SHA-256)<br/><br/>
    
    <b>Cómo filtrar:</b> Debajo de cada encabezado hay un campo de búsqueda. 
    Ej: Escribir "60111" en CUENTA filtra solo gastos de mercadería.<br/><br/>
    
    <b>✍️ PASO 3: CREAR NUEVO ASIENTO MANUALMENTE</b><br/>
    <b>Paso 3a: Abrir formulario</b><br/>
    • Botón "Nuevo asiento" abre un panel lateral con formulario<br/>
    • O seleccionar un asiento existente para editarlo<br/><br/>
    
    <b>Paso 3b: Completar campos</b><br/>
    <u>Campo "Fecha":</u> 2026-05-11 (fecha del movimiento)<br/>
    <u>Campo "Período":</u> 2026-05 (automático del sistema)<br/>
    <u>Campo "Glosa":</u> "Compra mercadería a Proveedor ABC - Factura 001-9876"<br/>
    <u>Campo "Cuenta":</u> Ingresar código PCGE (ej: 60111, 40111, 42121)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;Cuentas más usadas:<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 1212 = Banco corriente (dinero en banco)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 1410 = Cuentas por cobrar (clientes deben)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 29 = Depreciación acumulada<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 40111 = IGV crédito fiscal (compras con impuesto)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 40112 = IGV por pagar (ventas con impuesto)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 42121 = Facturas por pagar (deuda con proveedor)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 42131 = Recibos por pagar (deuda por servicios)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 60111 = Compra de mercadería<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 60211 = Materiales para transformación<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 62 = Gasto de personal (sueldos, AFP)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 63 = Gastos de servicios (energía, agua, teléfono)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 68 = Valuación de activos (provisiones, depreciación)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 401 = Ventas de mercadería<br/><br/>
    
    <u>Campo "Debe":</u> Ingresa monto SOLO si es débito (izq) ej: 1000.00<br/>
    <u>Campo "Haber":</u> Ingresa monto SOLO si es crédito (der) ej: 1000.00<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;Regla: Debe + Haber = 0 (uno es positivo, otro negativo)<br/><br/>
    
    <u>Campo "Centro de Costo" (OPCIONAL):</u> LIM-COM, LIM-ADM, PROVINCIAS, etc<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;⚠️ Si la cuenta es gasto (clase 6), CC es OBLIGATORIO<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;Si falta → Sistema rechaza guardado<br/><br/>
    
    <b>Paso 3c: Validación automática (Ledger Engine)</b><br/>
    Cuando presionas "Guardar", el Ledger Engine ejecuta 5 validaciones:<br/>
    <u>1. Partida Doble:</u> Valida que Debe = Haber<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si no: Muestra error "Asiento desbalanceado"<br/>
    <u>2. Cuenta válida:</u> Verifica que la cuenta existe en PCGE<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si no: Muestra error "Cuenta 99999 no existe"<br/>
    <u>3. Centro de Costo:</u> Si es gasto → CC obligatorio<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si falta: Muestra error "Gasto sin centro de costo"<br/>
    <u>4. Causalidad tributaria:</u> Valida que el gasto sea deducible (TUO LIR Art. 37)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si no cumple: Bloquea con advertencia legal<br/>
    <u>5. Bancarización:</u> Si monto > S/ 2,000, requiere medio de pago<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si falta: Bloquea "Monto alto sin método de pago"<br/><br/>
    
    <b>Paso 3d: Generación del HASH</b><br/>
    Si todas las validaciones pasan ✅:<br/>
    • Sistema genera HASH SHA-256 (huella digital criptográfica)<br/>
    • HASH = SHA256(fecha + cuenta + debe + haber + cc + glosa)<br/>
    • Ej: e8f2c1a7b9d3e5f2c1a7b9d3e5f2c1a7<br/>
    • Se guarda en BD junto con el asiento<br/>
    • Imposible modificar sin cambiar el HASH<br/>
    • SUNAT puede verificar integridad del libro sin confiar en sistema<br/><br/>
    
    <b>🔐 PASO 4: INTEGRIDAD Y AUDITORÍA</b><br/>
    <u>Botón "Escanear integridad":</u><br/>
    • Valida HASH de todos los 3,000+ asientos del período<br/>
    • Si alguno no coincide → Detección automática de fraude/corrupción<br/>
    • Genera reporte: "Asiento JE-2026-000184 manipulado" con fecha/hora<br/>
    • Marca asiento como comprometido, bloquea cierre del período<br/><br/>
    
    <b>💾 PASO 5: EXPORTAR A SUNAT</b><br/>
    <u>Botón "Exportar PLE/SIRE":</u><br/>
    • Descarga CSV del Libro Diario en formato SUNAT 5.1<br/>
    • Incluye todas las columnas: fecha, período, código, debe, haber, etc<br/>
    • Puedes importar directamente al portal PLE.SUNAT.GOB.PE<br/>
    • También genera archivos para SIRE (Sistema Ingreso Rentas)<br/><br/>
    
    <b>🔒 PASO 6: CIERRE DEL PERÍODO (FIRMAR Y BLOQUEAR)</b><br/>
    <u>Botón Rojo "Firmar y Bloquear Contabilidad":</u><br/>
    Esta es la acción más importante del mes. Cuando presionas:<br/>
    1. Sistema verifica que los 3,000+ asientos estén balanceados ✅<br/>
    2. Calcula diferencia de cambio (USD → PEN)<br/>
    3. Genera Libros Electrónicos PLE 5.1/5.2<br/>
    4. Sella el período digitalmente → IRREVERSIBLE<br/>
    5. Después NO se puede modificar nada del mes<br/>
    ⚠️ CUIDADO: Esta acción es definitiva. Se recomienda hacer auditoría antes.<br/><br/>
    
    <b>❓ TROUBLESHOOTING / PREGUNTAS FRECUENTES</b><br/>
    <u>P: ¿Qué pasa si cierro el período y luego encuentro un error?</u><br/>
    R: No se puede modificar. Debes abrir un nuevo período correctivo<br/>
    con asientos inversos (reversales) en junio.<br/><br/>
    
    <u>P: ¿Cómo sé qué cuenta usar?</u><br/>
    R: Consulta el PCGE en Configuración → Catálogo de Cuentas.<br/>
    O usa búsqueda: "compra" → filtra cuentas de compra.<br/><br/>
    
    <u>P: ¿Se puede auto-generar asientos?</u><br/>
    R: Sí. El Ledger Engine genera asientos automáticamente cuando<br/>
    registras ventas/compras. Aquí es para asientos especiales (ajustes, etc).<br/><br/>
    
    <u>P: ¿Por qué me pide centro de costo?</u><br/>
    R: Porque SUNAT exige segregar gastos por departamento/proyecto<br/>
    para análisis de rentabilidad y auditoría interna.<br/>
    """
    story.append(Paragraph(accounting_text, body_style))
    story.append(PageBreak())
    
    # 5. Compras
    story.append(Paragraph("5️⃣ COMPRAS & PROVEEDORES", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    compras_text = """
    El módulo de Compras gestiona todas las adquisiciones y relaciones con proveedores, 
    con auditoría automática de riesgo fiscal.
    <br/><br/>
    <b>Secciones principales:</b><br/><br/>
    
    <b>📊 Estadísticas Generales (4 tarjetas)</b><br/>
    • Compras: 342 facturas registradas en el mes<br/>
    • Facturas Validadas: 98% de cumplimiento<br/>
    • Alertas Activas: 12 facturas con detracciones pendientes<br/>
    • Riesgo: 3 proveedores con riesgo fiscal alto<br/><br/>
    
    <b>🛡️ Auditoría Preventiva IA</b><br/>
    • Sistema automático que analiza cada compra contra normativa SUNAT<br/>
    • 3 Cards de Riesgo:<br/>
    &nbsp;&nbsp;1. Riesgo Fiscal Alto (Rojo): 3 proveedores sin RUC verificado<br/>
    &nbsp;&nbsp;2. Detracciones Pendientes (Naranja): 12 facturas sin CDR<br/>
    &nbsp;&nbsp;3. Proyección Régimen MYPE (Azul): Asesoramiento normativo<br/>
    • Botón "INICIAR ESCANEO GLOBAL" dispara análisis en profundidad<br/><br/>
    
    <b>🔍 Log de Hallazgos Forenses</b><br/>
    • Expande para ver hallazgos detectados por IA<br/>
    • Cada hallazgo muestra: Fecha | Título | Descripción | Sugerencia de IA<br/>
    • Ejemplo: "RUC 20450123456 no está en padrón SUNAT - Comunicar a proveedor"<br/><br/>
    
    <b>👥 Proveedores por Categoría</b><br/>
    • Clasificación automática: Mayoristas, Minoristas, Servicios, Otros<br/>
    • Muestra barra de progreso de cumplimiento normativo<br/>
    • Porcentaje de documentos verificados<br/><br/>
    
    <b>📄 Estado de Documentos</b><br/>
    • Seguimiento de documentación: CDR, Facturas, Notas, Guías<br/>
    • Muestra porcentaje de recibidos vs pendientes<br/>
    • Alertas de documentos vencidos<br/>
    """
    story.append(Paragraph(compras_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 6. Ventas
    story.append(Paragraph("6️⃣ VENTAS & FACTURACIÓN", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    ventas_text = """
    <b>Paso 1: Registrar nueva venta</b><br/>
    • Menú izquierdo → "🧾 Ventas"<br/>
    • Botón "+ Nuevo" abre formulario de factura<br/>
    • Completar datos:<br/>
    &nbsp;&nbsp;- Serie (ej: F001), Número, RUC cliente<br/>
    &nbsp;&nbsp;- Items con cantidad y precio unitario<br/>
    &nbsp;&nbsp;- Cálculo automático de IGV (18%)<br/>
    &nbsp;&nbsp;- Total neto + IGV = Total factura<br/><br/>
    
    <b>Paso 2: Generar asiento contable</b><br/>
    • Sistema automático genera asiento de venta<br/>
    • Débito: Caja/Banco (1212)<br/>
    • Crédito: Ventas (401) y IGV (4011)<br/>
    • Hash generado para auditoría<br/><br/>
    
    <b>Paso 3: Envío a SUNAT</b><br/>
    • Si está configurado, se envía automáticamente<br/>
    • Recibe CDR (Comprobante de Recepción)<br/>
    • Estado cambia a "SUNAT" cuando es aceptado<br/>
    """
    story.append(Paragraph(ventas_text, body_style))
    story.append(PageBreak())
    
    # 7. Tesorería
    story.append(Paragraph("7️⃣ TESORERÍA - GESTIÓN DE EFECTIVO", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    tesoreria_text = """
    <b>Funcionalidades:</b><br/>
    • Control de efectivo en caja<br/>
    • Movimientos entre bancos<br/>
    • Diferencia de cambio (USD a PEN)<br/>
    • Conciliación bancaria automática<br/>
    • Pronóstico de flujo de caja<br/>
    """
    story.append(Paragraph(tesoreria_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 8. Inventario
    story.append(Paragraph("8️⃣ INVENTARIO - CONTROL DE STOCK", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    inventario_text = """
    <b>Características:</b><br/>
    • Registro de entradas y salidas de almacén<br/>
    • Cálculo automático de KARDEX<br/>
    • Métodos de valoración: FIFO, LIFO, Promedio<br/>
    • Alertas de stock bajo<br/>
    • Auditoría de movimientos<br/>
    """
    story.append(Paragraph(inventario_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 9. Nómina
    story.append(Paragraph("9️⃣ NÓMINA - GESTIÓN DE EMPLEADOS", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    nomina_text = """
    <b>Funciones:</b><br/>
    • Registro de empleados y datos personales<br/>
    • Cálculo automático de sueldo con AFP/ONP<br/>
    • Quinta categoría (5ta cat) de impuesto a la renta<br/>
    • Horas extra al 25%<br/>
    • Generación de asiento contable de planilla<br/>
    • Exportación de datos para pago a banco<br/>
    """
    story.append(Paragraph(nomina_text, body_style))
    story.append(PageBreak())
    
    # 10. Activos Fijos
    story.append(Paragraph("1️⃣0️⃣ ACTIVOS FIJOS - REGISTRO Y DEPRECIACIÓN", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    activos_text = """
    <b>Gestión de activos:</b><br/>
    • Registro de bienes (vehículos, maquinaria, etc.)<br/>
    • Cálculo automático de depreciación mensual<br/>
    • Métodos: Línea recta, Unidades de producción<br/>
    • Generación automática de asiento contable de depreciación<br/>
    • Control de baja de activos<br/>
    """
    story.append(Paragraph(activos_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 11. CXC/CXP
    story.append(Paragraph("1️⃣1️⃣ CXC/CXP - CUENTAS POR COBRAR Y PAGAR", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    cxc_text = """
    <b>Análisis de cartera:</b><br/>
    • Desglose por vencimiento: 0-30, 30-60, 60-90, 90+ días<br/>
    • Provisión automática de cobranza dudosa<br/>
    • Seguimiento de pagos y cobranzas<br/>
    • Proyección de flujo de efectivo<br/>
    • Alertas de vencimientos próximos<br/>
    """
    story.append(Paragraph(cxc_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 12. Libros Electrónicos
    story.append(Paragraph("1️⃣2️⃣ LIBROS ELECTRÓNICOS - GENERACIÓN DE PLE", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    libros_text = """
    <b>Procedimiento:</b><br/>
    1. Ir a "📚 Libros" en el menú izquierdo<br/>
    2. Seleccionar período (ej: Mayo 2026)<br/>
    3. Aparecen 2 opciones:<br/>
    &nbsp;&nbsp;• Libro Diario (5.1): 342 asientos detectados<br/>
    &nbsp;&nbsp;• Libro Simplificado (5.2): Para empresas en régimen simplificado<br/>
    4. Botón "Generar TXT" descarga el archivo en formato SUNAT<br/>
    5. Descargar ZIP completo y enviar a portal PLE de SUNAT<br/>
    """
    story.append(Paragraph(libros_text, body_style))
    story.append(PageBreak())
    
    # 13. SUNAT
    story.append(Paragraph("1️⃣3️⃣ SUNAT - CUMPLIMIENTO TRIBUTARIO", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    sunat_text = """
    <b>Validaciones SUNAT:</b><br/>
    • Verificación automática de RUC<br/>
    • Cálculo de IGV y retenciones<br/>
    • Seguimiento de CDR (Comprobante de Recepción)<br/>
    • Detracciones (10% retención en compras)<br/>
    • Retenciones por servicios (3% o 6%)<br/>
    • Generación de SIRE (Sistema de Ingreso de Rentas)<br/>
    """
    story.append(Paragraph(sunat_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 14. Reportes
    story.append(Paragraph("1️⃣4️⃣ REPORTES FINANCIEROS", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    reportes_text = """
    <b>Reportes disponibles:</b><br/>
    • Estado de Resultados (Ingresos - Gastos = Resultado)<br/>
    • Balance General (Activos = Pasivos + Patrimonio)<br/>
    • Flujo de Caja (Entradas - Salidas = Cambio neto en caja)<br/>
    • Ratios Financieros (Rentabilidad, Liquidez, Endeudamiento)<br/>
    • Comparativo período a período<br/>
    • Exportación a XLSX y PDF<br/>
    """
    story.append(Paragraph(reportes_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 15. Owner Portal
    story.append(Paragraph("1️⃣5️⃣ PORTAL DEL PROPIETARIO", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    owner_text = """
    <b>Vista ejecutiva para propietarios:</b><br/>
    • Resumen de resultados financieros<br/>
    • KPI principales del negocio<br/>
    • Análisis de rentabilidad por línea de negocio<br/>
    • Proyecciones de crecimiento<br/>
    • Alertas de riesgos identificados<br/>
    """
    story.append(Paragraph(owner_text, body_style))
    story.append(PageBreak())
    
    # 16. Configuración
    story.append(Paragraph("1️⃣6️⃣ CONFIGURACIÓN GENERAL", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    config_text = """
    <b>Parámetros configurables:</b><br/>
    • Datos de la empresa (RUC, razón social, domicilio)<br/>
    • Centros de costo<br/>
    • Catálogo de cuentas contables<br/>
    • Usuarios y permisos<br/>
    • Período contable actual<br/>
    • Cierre y reapertura de períodos<br/>
    • Configuración de integraciones externas<br/>
    """
    story.append(Paragraph(config_text, body_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 17. Arquitectura
    story.append(Paragraph("1️⃣7️⃣ FLUJO DE DATOS - ARQUITECTURA GENERAL", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    arquitectura_text = """
    <b>Cómo se comunican los módulos:</b><br/><br/>
    
    <b>Frontend (Interfaz de Usuario):</b><br/>
    • React + TypeScript en navegador<br/>
    • Componentes reutilizables (PanelSection, PanelsGrid)<br/>
    • Estilos con Tailwind CSS + CSS personalizado<br/>
    • Animaciones con Framer Motion<br/>
    • Iconos con Fluent UI<br/><br/>
    
    <b>Backend (Lógica de Negocio):</b><br/>
    • FastAPI (Python) en servidor<br/>
    • Endpoints REST en /api/v1/<br/>
    • Base de datos PostgreSQL<br/>
    • Servicio de integridad: Hash Chain (SHA-256)<br/>
    • Orquestador de asientos: LedgerPostingService<br/><br/>
    
    <b>Flujo de una transacción (Ej: Venta F001-8421):</b><br/>
    1. Usuario ingresa datos de venta en formulario<br/>
    2. Frontend envía POST /api/v1/orchestrator/sync-sale<br/>
    3. Backend valida: RUC, montos, documentos<br/>
    4. Se crea asiento contable automático<br/>
    5. Se genera hash SHA-256 para auditoría<br/>
    6. Si es exitoso, estado = "POSTED"<br/>
    7. Si es SUNAT, se envía para firma digital<br/>
    8. Se recibe CDR (estado = "SUNAT")<br/>
    9. Frontend actualiza tabla con nueva fila<br/>
    10. Usuario ve cambio en tiempo real<br/>
    <br/>
    <b>Seguridad y Auditoría:</b><br/>
    • Hash Chain: Cada asiento contiene hash del anterior<br/>
    • Imposible modificar sin alterar la cadena completa<br/>
    • Detecta automáticamente manipulaciones<br/>
    • Cumplimiento SUNAT: Integridad de datos garantizada<br/>
    """
    story.append(Paragraph(arquitectura_text, body_style))
    story.append(PageBreak())

    # 18. Ledger Engine
    story.append(Paragraph("1️⃣8️⃣ LEDGER ENGINE - VALIDACIÓN EXPERTA ANTES DE GUARDAR", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    ledger_engine_text = """
    El Ledger Engine es un flujo inteligente que valida legal y contablemente cada
    transacción antes de permitir su guardado en la base de datos.
    <br/><br/>
    <b>Objetivo:</b><br/>
    • Evitar asientos inválidos o incompletos<br/>
    • Cumplir normativa SUNAT y tributaria automáticamente<br/>
    • Garantizar integridad de partida doble y centros de costo<br/><br/>

    <b>Cómo funciona (paso a paso):</b><br/>
    1. El usuario inicia una operación (ej: Ingreso de Gasto)<br/>
    2. El sistema envía la solicitud al endpoint /api/v1/ledger/engine<br/>
    3. Unit A clasifica la transacción y genera asientos PCGE<br/>
    4. Unit B revisa cumplimiento: bancarización, causalidad y detracciones<br/>
    5. Si cumple, retorna JSON con asientos + acciones sugeridas<br/>
    6. Si no cumple, bloquea persistencia y devuelve motivo (error 422)<br/><br/>

    <b>Controles automáticos clave:</b><br/>
    • Partida doble obligatoria: Debe = Haber<br/>
    • Gasto clase 6 con destino automático a clase 9<br/>
    • Centro de costo obligatorio en gastos<br/>
    • Bancarización obligatoria para montos > S/ 2,000 o > USD 500<br/>
    • Retención 4ta categoría para honorarios según umbral UIT<br/>
    • Cálculo de detracciones SPOT cuando aplica<br/><br/>

    <b>Qué ve el usuario en pantalla:</b><br/>
    • Asiento diario propuesto (líneas contables)<br/>
    • Resultado de cumplimiento legal y tributario<br/>
    • Acciones requeridas (ej: notificar tesorería)<br/>
    • Estado final: "Aprobado" o "Bloqueado"<br/><br/>

    <b>Beneficio operativo:</b><br/>
    Se reducen errores de registro, observaciones en auditoría y riesgos de sanción
    por incumplimiento tributario.
    """
    story.append(Paragraph(ledger_engine_text, body_style))
    story.append(PageBreak())
    
    # Resumen final
    story.append(Paragraph("📋 RESUMEN DE FLUJOS", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    resumen_text = """
    <b>Flujo Diario Típico:</b><br/>
    1. Mañana: Revisar Dashboard para ver estado general<br/>
    2. Registrar Ventas del día (módulo Ventas)<br/>
    3. Registrar Compras del día (módulo Compras)<br/>
    4. Movimientos de Tesorería (cobros, pagos)<br/>
    5. Ajustes manuales si es necesario (módulo Contabilidad)<br/>
    6. Fin de día: Verificar integridad (Escanear hash)<br/><br/>
    
    <b>Flujo Mensual:</b><br/>
    1. Hacer cierre de período en Configuración<br/>
    2. Validar todos los asientos están cuadrados<br/>
    3. Generar Libros Electrónicos (PLE 5.1/5.2)<br/>
    4. Enviar a SUNAT si es obligatorio<br/>
    5. Generar Reportes Financieros<br/>
    6. Análisis de resultados vs presupuesto<br/><br/>
    
    <b>Flujo de Riesgos Tributarios:</b><br/>
    1. Sistema detecta anomalía (ej: RUC sin verificar)<br/>
    2. Auditoria IA genera "Hallazgo Forense"<br/>
    3. Se muestra en Log de Hallazgos en Compras<br/>
    4. Usuario analiza y toma acción correctiva<br/>
    5. Se marca como resuelto<br/>
    """
    story.append(Paragraph(resumen_text, body_style))
    story.append(Spacer(1, 0.3 * inch))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey,
    )
    story.append(Paragraph(
        f"<br/><br/>© 2026 CONTA_PRO Enterprise. Manual versión 1.1. "
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}<br/>"
        f"Todos los derechos reservados.",
        footer_style
    ))
    
    # Build PDF
    doc.build(story)
    print(f"✅ PDF generado exitosamente: {OUTPUT_PATH}")

if __name__ == '__main__':
    create_manual()
