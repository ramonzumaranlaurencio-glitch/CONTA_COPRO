#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Generador de PDF Manual del Sistema CONTA_COLPRO Enterprise
Documento completo con explicación paso a paso de cada ventana
Contexto: Colombia - DIAN - PUC - IVA - NIT - COP
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
)
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from datetime import datetime
import os

# Configuration
OUTPUT_PATH = os.path.join(os.path.expanduser("~"), "Downloads", "MANUAL_SISTEMA_CONTA_COLPRO.pdf")
PAGE_SIZE = A4
MARGIN = 0.75 * inch

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._pageNumber = 0

    def showPage(self):
        self.draw_page_footer()
        self._pageNumber += 1
        super().showPage()

    def draw_page_footer(self):
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.grey)
        page_text = f"Página {self._pageNumber}"
        self.drawRightString(7.5 * inch, 0.5 * inch, page_text)
        self.drawCentredString(4.25 * inch, 0.5 * inch, "CONTA_COLPRO Enterprise v1.5 — Colombia")

def create_manual():
    """Crear el documento PDF con el manual completo"""

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=HexColor('#0f172a'),
        spaceAfter=12,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=HexColor('#1e293b'),
        spaceAfter=8,
        spaceBefore=12,
        fontName='Helvetica-Bold',
        borderColor=HexColor('#FFCD00'),
        borderWidth=2,
        borderPadding=8,
    )

    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=13,
        textColor=HexColor('#334155'),
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
    story.append(Paragraph("CONTA_COLPRO", title_style))
    story.append(Paragraph("ENTERPRISE MASTER v1.5", title_style))
    story.append(Spacer(1, 0.3 * inch))

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=16,
        textColor=HexColor('#FFCD00'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
    )
    story.append(Paragraph("Especificaciones Técnicas y Manual de Operaciones", subtitle_style))
    story.append(Spacer(1, 0.4 * inch))

    info_style = ParagraphStyle(
        'Info',
        parent=styles['Normal'],
        fontSize=11,
        alignment=TA_CENTER,
        textColor=HexColor('#64748b'),
    )
    story.append(Paragraph("Documentación para: Gerencia de Finanzas y Auditoría", info_style))
    story.append(Paragraph(f"Fecha de Emisión: {datetime.now().strftime('%d de %B, %Y')}", info_style))
    story.append(Paragraph("Colombia · DIAN · PUC · IVA · NIT", info_style))
    story.append(Spacer(1, 1 * inch))
    story.append(Paragraph("SEGURIDAD TRIBUTARIA | INTEGRIDAD CRIPTOGRÁFICA | IA ACCOUNTING", info_style))
    story.append(PageBreak())

    # ==================== ÍNDICE ====================
    story.append(Paragraph("📑 ÍNDICE DE CONTENIDOS", heading_style))
    story.append(Spacer(1, 0.2 * inch))

    toc_items = [
        "1. Descripción General del Sistema",
        "2. Arquitectura de Datos y Seguridad (Hash Chain)",
        "3. Dashboard Ejecutivo de Mando",
        "4. Módulo de Contabilidad: El Ledger Engine v1.5 (PUC Colombia)",
        "5. Vision Accounting Engine: IA Aplicada a Compras",
        "6. Gestión de Ventas e Ingresos (Facturación Electrónica DIAN)",
        "7. Tesorería Avanzada y Flujo de Caja",
        "8. Control de Inventarios y Almacenes (Kardex)",
        "9. Nómina Enterprise: Motor de Planillas (AFP / EPS / ARL / CCF)",
        "10. Gestión de Activos Fijos",
        "11. Control de Cartera (CXC / CXP)",
        "12. Declaraciones Electrónicas DIAN (IVA · Retención · Renta)",
        "13. Cumplimiento DIAN y Auditoría Forense",
        "14. Financial Reporting Framework",
        "15. Owner Portal: Inteligencia de Negocios",
        "16. Configuración y Parametrización",
        "17. Arquitectura del Sistema (React + FastAPI)",
        "18. Glosario de Funciones y Troubleshooting",
    ]

    for item in toc_items:
        story.append(Paragraph(f"• {item}", body_style))

    story.append(PageBreak())

    # ==================== CONTENIDO ====================

    # 1. Descripción General
    story.append(Paragraph("1️⃣ DESCRIPCIÓN GENERAL DEL SISTEMA", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    gen_text = """
    CONTA_COLPRO Enterprise es una solución integral de gestión contable y empresarial
    diseñada para empresas colombianas medianas y grandes. El sistema integra módulos de
    contabilidad bajo el PUC (Plan Único de Cuentas), facturación electrónica DIAN,
    inventario, nómina con aportes parafiscales, activos fijos y reporting, con
    cumplimiento total de la normativa colombiana.
    <br/><br/>
    <b>Diferenciadores Enterprise:</b><br/>
    • <b>Integridad de Datos:</b> Implementación de Hash Chain SHA-256 para evitar alteraciones en el Libro Diario.<br/>
    • <b>Motor IA Vision:</b> Clasificación automática de facturas electrónicas y comprobantes con reconocimiento de CUFE.<br/>
    • <b>Ledger Engine:</b> Validador de partida doble y causalidad tributaria según normativa DIAN en tiempo real.<br/>
    • <b>Multimoneda Real:</b> Manejo de bimoneda (COP/USD) con actualización de TRM (Tasa de Referencia del Mercado).<br/>
    • <b>DIAN Integrado:</b> Facturación electrónica, medios magnéticos, exógena y declaraciones tributarias.<br/>
    """
    story.append(Paragraph(gen_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 2. Seguridad
    story.append(Paragraph("2️⃣ ARQUITECTURA DE DATOS Y SEGURIDAD", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    seguridad_text = """
    A diferencia de sistemas básicos, CONTA_COLPRO Enterprise protege la contabilidad mediante
    una <b>Cadena de Hashes (Hash Chain)</b>.
    <br/><br/>
    <b>Funcionamiento Técnico:</b><br/>
    Cada vez que se guarda un asiento contable, el sistema genera una huella digital única (SHA-256)
    que incluye el contenido del asiento actual y el hash del asiento anterior.
    Si un usuario intentara modificar un valor directamente en la base de datos, la cadena
    se rompería y el sistema emitiría una alerta de "Integridad Comprometida".
    <br/><br/>
    <b>Beneficio para Auditoría y DIAN:</b><br/>
    Garantiza ante la DIAN y socios que la contabilidad es inalterable y veraz,
    cumpliendo con el Decreto 2420 de 2015 y las Normas de Información Financiera (NIF) colombianas.
    """
    story.append(Paragraph(seguridad_text, body_style))
    story.append(PageBreak())

    # 3. Dashboard
    story.append(Paragraph("3️⃣ DASHBOARD EJECUTIVO DE MANDO", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    dashboard_text = """
    El Dashboard es la pantalla de bienvenida que muestra un resumen ejecutivo de
    la empresa en tiempo real.
    <br/><br/>
    <b>Pasos para acceder:</b><br/>
    1. Hacer clic en el icono 🏠 "Dashboard" en el panel izquierdo<br/>
    2. El sistema carga automáticamente las métricas del último período contable<br/>
    3. Se muestran 5 tarjetas principales:<br/>
    &nbsp;&nbsp;• Caja: $482.900.000 COP (efectivo disponible)<br/>
    &nbsp;&nbsp;• CXC: $1.284.320.100 COP (cuentas por cobrar)<br/>
    &nbsp;&nbsp;• CXP: $712.008.440 COP (cuentas por pagar)<br/>
    &nbsp;&nbsp;• IVA: $86.240.000 COP (impuesto descontable/por pagar)<br/>
    &nbsp;&nbsp;• Resultado: $392.600.180 COP (ganancia neta)<br/><br/>
    <b>Funcionalidades:</b><br/>
    • Exportar resumen a CSV y PDF<br/>
    • Ver detalles de cada métrica<br/>
    • Análisis de tendencias por período<br/>
    • Acceso rápido a declaraciones DIAN pendientes<br/>
    """
    story.append(Paragraph(dashboard_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 4. Contabilidad
    story.append(Paragraph("4️⃣ MÓDULO DE CONTABILIDAD: EL LEDGER ENGINE v1.5 (PUC COLOMBIA)", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    accounting_text = """
    El módulo de Contabilidad es el núcleo transaccional. Opera bajo el concepto de
    <b>Ledger Engine</b>, un motor que orquesta la validación experta de cada registro
    bajo las Normas de Información Financiera colombianas.
    <br/><br/>
    <b>📘 INTRODUCCIÓN: QUÉ ES EL PUC COLOMBIANO</b><br/>
    El PUC (Plan Único de Cuentas) es el catálogo oficial de cuentas que la DIAN y
    la Superintendencia de Sociedades exigen usar en Colombia. Está dividido en 7 clases:<br/>
    &nbsp;&nbsp;Clase 1: Activo (efectivo, bancos, inventarios, maquinaria)<br/>
    &nbsp;&nbsp;Clase 2: Pasivo (deudas, proveedores, IVA por pagar, obligaciones financieras)<br/>
    &nbsp;&nbsp;Clase 3: Patrimonio (capital social, reservas, utilidades)<br/>
    &nbsp;&nbsp;Clase 4: Ingresos (ventas, prestación de servicios)<br/>
    &nbsp;&nbsp;Clase 5: Gastos (gastos de personal, servicios, depreciaciones)<br/>
    &nbsp;&nbsp;Clase 6: Costos de Producción y Operación (materias primas, mano de obra)<br/>
    &nbsp;&nbsp;Clase 7: Costos de Ventas (costo de mercancías vendidas)<br/><br/>

    <b>🔍 PASO 1: ACCEDER AL MÓDULO</b><br/>
    • Hacer clic en "📊 Contabilidad" en el menú izquierdo<br/>
    • Se abre la vista del Libro Diario (Libro Diario de Contabilidad según normativa colombiana)<br/>
    • Muestra título: "FIRMAR Y BLOQUEAR CONTABILIDAD" (período actual: Mayo 2026)<br/>
    • Debajo: Tabla con todos los 3.000+ asientos del período<br/><br/>

    <b>📊 PASO 2: VISUALIZAR Y FILTRAR ASIENTOS</b><br/>
    La tabla principal muestra 10 columnas:<br/>
    &nbsp;&nbsp;<b>FECHA:</b> 2026-05-10 (cuándo se registró)<br/>
    &nbsp;&nbsp;<b>PERIODO:</b> 2026-05 (mes/año contable)<br/>
    &nbsp;&nbsp;<b>GLOSA:</b> "Compra factura FEV 001-8421 a Proveedor XYZ NIT 900.123.456-1" (descripción)<br/>
    &nbsp;&nbsp;<b>CUENTA PUC:</b> 513540 (código PUC, ej: 513540=Impuestos y contribuciones)<br/>
    &nbsp;&nbsp;<b>CC:</b> BOG-COM (centro de costo, opcional)<br/>
    &nbsp;&nbsp;<b>DÉBITO:</b> 1.000.000 (lado izquierdo del asiento)<br/>
    &nbsp;&nbsp;<b>CRÉDITO:</b> 1.000.000 (lado derecho del asiento)<br/>
    &nbsp;&nbsp;<b>ESTADO:</b> POSTED | DIAN | REVIEW (estado)<br/>
    &nbsp;&nbsp;<b>MÓDULO:</b> VENTAS | COMPRAS | TESORERÍA (de dónde vino)<br/>
    &nbsp;&nbsp;<b>HASH:</b> e8f2c1a7b9d3... (huella digital SHA-256)<br/><br/>

    <b>Cómo filtrar:</b> Debajo de cada encabezado hay un campo de búsqueda.
    Ej: Escribir "2408" en CUENTA filtra solo IVA por pagar.<br/><br/>

    <b>✍️ PASO 3: CREAR NUEVO ASIENTO MANUALMENTE</b><br/>
    <b>Paso 3a: Abrir formulario</b><br/>
    • Botón "Nuevo asiento" abre un panel lateral con formulario<br/>
    • O seleccionar un asiento existente para editarlo<br/><br/>

    <b>Paso 3b: Completar campos — Cuentas PUC más usadas</b><br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 1105 = Caja (efectivo en mano)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 1110 = Bancos (Bancolombia, Davivienda, BBVA, Banco de Bogotá)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 1305 = Clientes (cuentas por cobrar)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 1430 = Mercancías no fabricadas por la empresa<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 2205 = Proveedores (cuentas por pagar comerciales)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 2365 = Retención en la fuente a favor<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 2367 = Retención de IVA a favor<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 2368 = Retención de ICA a favor<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 2408 = IVA por pagar (débito = descontable, crédito = generado)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 4135 = Comercio al por mayor y menor (ingresos)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 4145 = Prestación de servicios (ingresos)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 5105 = Gastos de personal (sueldos, prestaciones)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 5135 = Servicios (energía, agua, teléfono, internet)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 6135 = Costo de ventas (comercio)<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;• 7135 = Costo de ventas (manufactura/producción)<br/><br/>

    <u>Campo "Débito":</u> Monto SOLO si aumenta activo o disminuye pasivo/patrimonio<br/>
    <u>Campo "Crédito":</u> Monto SOLO si aumenta pasivo/patrimonio o disminuye activo<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;Regla: Débito = Crédito (partida doble obligatoria)<br/><br/>

    <u>Campo "Centro de Costo" (OPCIONAL):</u> BOG-COM, BOG-ADM, MED-OPS, etc.<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;⚠️ Si la cuenta es gasto (clase 5 ó 6), CC es OBLIGATORIO<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;Si falta → Sistema rechaza guardado<br/><br/>

    <b>Paso 3c: Validación automática (Ledger Engine)</b><br/>
    Cuando presionas "Guardar", el Ledger Engine ejecuta 5 validaciones:<br/>
    <u>1. Partida Doble:</u> Valida que Débito = Crédito<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si no: Muestra error "Asiento desbalanceado"<br/>
    <u>2. Cuenta válida PUC:</u> Verifica que la cuenta existe en el PUC colombiano<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si no: Muestra error "Cuenta 99999 no existe en PUC"<br/>
    <u>3. Centro de Costo:</u> Si es gasto clase 5 → CC obligatorio<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si falta: Muestra error "Gasto sin centro de costo"<br/>
    <u>4. Causalidad tributaria:</u> Valida que el gasto sea deducible según ET colombiano<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si no cumple: Bloquea con advertencia legal<br/>
    <u>5. Bancarización:</u> Si monto > $1.000.000 COP, requiere medio de pago<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;❌ Si falta: Bloquea "Monto alto sin método de pago"<br/><br/>

    <b>Paso 3d: Generación del HASH</b><br/>
    Si todas las validaciones pasan ✅:<br/>
    • Sistema genera HASH SHA-256 (huella digital criptográfica)<br/>
    • HASH = SHA256(fecha + cuenta + débito + crédito + cc + glosa)<br/>
    • Se guarda en BD junto con el asiento → INALTERABLE<br/>
    • La DIAN puede verificar integridad del libro sin confiar en el sistema<br/><br/>

    <b>🔐 PASO 4: INTEGRIDAD Y AUDITORÍA</b><br/>
    <u>Botón "Escanear integridad":</u><br/>
    • Valida HASH de todos los 3.000+ asientos del período<br/>
    • Si alguno no coincide → Detección automática de fraude/corrupción<br/>
    • Genera reporte: "Asiento JE-2026-000184 manipulado" con fecha/hora<br/>
    • Marca asiento como comprometido, bloquea cierre del período<br/><br/>

    <b>💾 PASO 5: EXPORTAR PARA DIAN</b><br/>
    <u>Botón "Exportar Medios Magnéticos":</u><br/>
    • Descarga archivos para Exógena DIAN (información del año gravable)<br/>
    • Genera formatos 1001, 1007, 1008, 1009 según conceptos<br/>
    • Compatible con el esquema XML de la DIAN<br/><br/>

    <b>🔒 PASO 6: CIERRE DEL PERÍODO (FIRMAR Y BLOQUEAR)</b><br/>
    <u>Botón Rojo "Firmar y Bloquear Contabilidad":</u><br/>
    Esta es la acción más importante del mes. Cuando presionas:<br/>
    1. Sistema verifica que todos los asientos estén balanceados ✅<br/>
    2. Calcula diferencia en cambio (USD → COP con TRM del día)<br/>
    3. Genera resumen de declaraciones pendientes (IVA, ReteFuente)<br/>
    4. Sella el período digitalmente → IRREVERSIBLE<br/>
    5. Después NO se puede modificar nada del mes<br/>
    ⚠️ CUIDADO: Esta acción es definitiva. Se recomienda hacer auditoría antes.<br/>
    """
    story.append(Paragraph(accounting_text, body_style))
    story.append(PageBreak())

    # 5. Compras
    story.append(Paragraph("5️⃣ COMPRAS & PROVEEDORES (DIAN COLOMBIA)", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    compras_text = """
    El módulo de Compras gestiona todas las adquisiciones y relaciones con proveedores,
    con validación automática del NIT ante la DIAN y auditoría de riesgo fiscal colombiano.
    <br/><br/>
    <b>Secciones principales:</b><br/><br/>

    <b>📊 Estadísticas Generales (4 tarjetas)</b><br/>
    • Compras: 342 facturas electrónicas registradas en el mes<br/>
    • Facturas Validadas DIAN: 98% con CUFE verificado<br/>
    • Alertas Activas: 12 facturas con retención en la fuente pendiente<br/>
    • Riesgo: 3 proveedores con NIT sin verificar ante la DIAN<br/><br/>

    <b>🛡️ Auditoría Preventiva IA</b><br/>
    • Sistema automático que analiza cada compra contra normativa DIAN y ET (Estatuto Tributario)<br/>
    • 3 Cards de Riesgo:<br/>
    &nbsp;&nbsp;1. Riesgo Fiscal Alto (Rojo): 3 proveedores sin NIT verificado en DIAN<br/>
    &nbsp;&nbsp;2. Retenciones Pendientes (Naranja): 12 facturas sin retención aplicada<br/>
    &nbsp;&nbsp;3. IVA Descontable Proyectado (Azul): Optimización del IVA del período<br/>
    • Botón "INICIAR ESCANEO GLOBAL" dispara análisis en profundidad<br/><br/>

    <b>📄 Factura Electrónica DIAN</b><br/>
    • Cada factura de compra incluye su CUFE (Código Único de Factura Electrónica)<br/>
    • Sistema verifica validez del CUFE en portal DIAN automáticamente<br/>
    • Extrae: NIT proveedor, fecha, base gravable, IVA, retenciones<br/>
    • IVA descontable se registra automáticamente en cuenta 2408<br/><br/>

    <b>💰 Tratamiento del IVA en Compras</b><br/>
    • IVA tarifa general: 19% (base más común)<br/>
    • IVA tarifa diferencial: 5% (algunos alimentos, medicina, etc.)<br/>
    • IVA excluido / exento: 0% (exportaciones, bienes básicos de la canasta)<br/>
    • IVA descontable: cuenta 2408 (débito = IVA a favor)<br/>
    • ReteIVA: 15% del IVA si el comprador es Gran Contribuyente o Agente Retenedor<br/><br/>

    <b>🔍 Retención en la Fuente</b><br/>
    • Compras de bienes: 3.5% ReteFuente si proveedor declarante<br/>
    • Servicios generales: 4% ReteFuente<br/>
    • Honorarios / servicios persona jurídica: 11%<br/>
    • Se registra en cuenta 2365 (ReteFuente por pagar a DIAN)<br/>
    """
    story.append(Paragraph(compras_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 6. Ventas
    story.append(Paragraph("6️⃣ VENTAS & FACTURACIÓN ELECTRÓNICA DIAN", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    ventas_text = """
    <b>Paso 1: Registrar nueva venta con Factura Electrónica</b><br/>
    • Menú izquierdo → "🧾 Ventas"<br/>
    • Botón "+ Nueva Factura" abre formulario de factura electrónica DIAN<br/>
    • Completar datos:<br/>
    &nbsp;&nbsp;- NIT del cliente (se valida contra DIAN en tiempo real)<br/>
    &nbsp;&nbsp;- Prefijo y número de factura (según resolución DIAN vigente)<br/>
    &nbsp;&nbsp;- Ítems con descripción, cantidad y valor unitario<br/>
    &nbsp;&nbsp;- Cálculo automático de IVA (19%, 5% ó 0% según bien/servicio)<br/>
    &nbsp;&nbsp;- Aplicación de retenciones si el cliente es agente retenedor<br/>
    &nbsp;&nbsp;- Total base + IVA - retenciones = Valor neto a pagar<br/><br/>

    <b>Paso 2: Generación del CUFE y envío a DIAN</b><br/>
    • Sistema genera el CUFE (Código Único de Factura Electrónica)<br/>
    • Se firma digitalmente con certificado digital del emisor<br/>
    • Se envía en tiempo real al Portal Factura Electrónica de la DIAN<br/>
    • DIAN responde con acuse de recibo: estado ACEPTADA o RECHAZADA<br/><br/>

    <b>Paso 3: Generación del asiento contable</b><br/>
    • Sistema genera asiento automático de venta:<br/>
    &nbsp;&nbsp;Débito: 1305 Clientes (valor total)<br/>
    &nbsp;&nbsp;Crédito: 4135 Ingresos por ventas (base gravable)<br/>
    &nbsp;&nbsp;Crédito: 2408 IVA por pagar (valor del IVA generado)<br/>
    • Hash SHA-256 generado para auditoría<br/>
    • Estado cambia a "DIAN-ACEPTADA" cuando es aprobada<br/>
    """
    story.append(Paragraph(ventas_text, body_style))
    story.append(PageBreak())

    # 7. Tesorería
    story.append(Paragraph("7️⃣ TESORERÍA - GESTIÓN DE EFECTIVO Y BANCOS COLOMBIANOS", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    tesoreria_text = """
    <b>Funcionalidades:</b><br/>
    • Control de efectivo en caja (cuenta PUC 1105)<br/>
    • Movimientos entre bancos colombianos:<br/>
    &nbsp;&nbsp;- Bancolombia (cuenta 1110-01)<br/>
    &nbsp;&nbsp;- Davivienda (cuenta 1110-02)<br/>
    &nbsp;&nbsp;- BBVA Colombia (cuenta 1110-03)<br/>
    &nbsp;&nbsp;- Banco de Bogotá (cuenta 1110-04)<br/>
    &nbsp;&nbsp;- Banco Popular, Scotiabank Colpatria, AV Villas, etc.<br/>
    • Diferencia en cambio USD → COP (con TRM Banco de la República)<br/>
    • Conciliación bancaria automática<br/>
    • Pronóstico de flujo de caja en COP<br/>
    • GMF (Gravamen a los Movimientos Financieros 4x1000) registrado automáticamente<br/>
    • Pagos PSE, Nequi, Daviplata integrados<br/>
    """
    story.append(Paragraph(tesoreria_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 8. Inventario
    story.append(Paragraph("8️⃣ INVENTARIO - CONTROL DE STOCK (PUC COLOMBIA)", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    inventario_text = """
    <b>Características:</b><br/>
    • Registro de entradas y salidas de almacén con cuentas PUC<br/>
    • Cálculo automático de KARDEX (método promedio ponderado)<br/>
    • Cuentas PUC de inventario:<br/>
    &nbsp;&nbsp;- 1430: Mercancías no fabricadas por la empresa<br/>
    &nbsp;&nbsp;- 1435: Materias primas<br/>
    &nbsp;&nbsp;- 1440: Productos en proceso<br/>
    &nbsp;&nbsp;- 1445: Productos terminados<br/>
    &nbsp;&nbsp;- 1455: Materiales, repuestos y accesorios<br/>
    • Costo de ventas: cuenta 6135 (comercio) o 7135 (manufactura)<br/>
    • Alertas de stock mínimo y rotación<br/>
    • Auditoría de movimientos con hash de integridad<br/>
    """
    story.append(Paragraph(inventario_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 9. Nómina
    story.append(Paragraph("9️⃣ NÓMINA - MOTOR DE PLANILLAS COLOMBIA (AFP / EPS / ARL / CCF)", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    nomina_text = """
    <b>Funciones:</b><br/>
    • Registro de empleados con datos personales y tipo de contrato<br/>
    • Cálculo automático de salario con aportes parafiscales colombianos:<br/>
    &nbsp;&nbsp;- AFP (Pensiones): 12% empleador + 4% empleado<br/>
    &nbsp;&nbsp;- EPS (Salud): 8.5% empleador + 4% empleado<br/>
    &nbsp;&nbsp;- ARL (Riesgos Laborales): 0.348% al 8.7% según riesgo<br/>
    &nbsp;&nbsp;- CCF (Caja de Compensación Familiar): 4%<br/>
    &nbsp;&nbsp;- SENA: 2%<br/>
    &nbsp;&nbsp;- ICBF: 3%<br/>
    • Prestaciones sociales:<br/>
    &nbsp;&nbsp;- Prima de servicios: 1 mes de salario cada 6 meses (Jun y Dic)<br/>
    &nbsp;&nbsp;- Cesantías: 1 mes de salario por año trabajado<br/>
    &nbsp;&nbsp;- Intereses sobre cesantías: 12% anual sobre saldo de cesantías<br/>
    &nbsp;&nbsp;- Vacaciones: 15 días hábiles por año (50% del salario básico)<br/>
    • Retención en la fuente 5ª categoría (ingresos laborales) calculada automáticamente<br/>
    • Generación de archivo plano PILA (Planilla Integrada Liquidación Aportes)<br/>
    • Exportación de datos para operadores PILA: SOI, Aportes En Línea<br/>
    • Asiento contable de nómina generado automáticamente en cuentas 5105, 2610, 2205<br/>
    """
    story.append(Paragraph(nomina_text, body_style))
    story.append(PageBreak())

    # 10. Activos Fijos
    story.append(Paragraph("1️⃣0️⃣ ACTIVOS FIJOS - REGISTRO Y DEPRECIACIÓN (NIIF COLOMBIA)", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    activos_text = """
    <b>Gestión de activos:</b><br/>
    • Registro de bienes (vehículos, maquinaria, equipos de cómputo, muebles)<br/>
    • Cuentas PUC de activos fijos:<br/>
    &nbsp;&nbsp;- 1520: Maquinaria y equipo<br/>
    &nbsp;&nbsp;- 1524: Equipo de oficina<br/>
    &nbsp;&nbsp;- 1528: Equipo de cómputo y comunicación<br/>
    &nbsp;&nbsp;- 1540: Flota y equipo de transporte<br/>
    &nbsp;&nbsp;- 1592: Depreciación acumulada (cuenta de valoración)<br/>
    • Cálculo automático de depreciación mensual según vida útil:<br/>
    &nbsp;&nbsp;- Edificios: 40-50 años (método línea recta)<br/>
    &nbsp;&nbsp;- Maquinaria: 10 años<br/>
    &nbsp;&nbsp;- Vehículos: 5 años<br/>
    &nbsp;&nbsp;- Equipo de cómputo: 3 años<br/>
    • Generación automática de asiento contable de depreciación (5160 Depreciaciones)<br/>
    • Control de baja de activos y activos totalmente depreciados<br/>
    • Compatible con NIIF (Normas Internacionales de Información Financiera) Pymes y Plenas<br/>
    """
    story.append(Paragraph(activos_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 11. CXC/CXP
    story.append(Paragraph("1️⃣1️⃣ CXC/CXP - CUENTAS POR COBRAR Y PAGAR", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    cxc_text = """
    <b>Análisis de cartera:</b><br/>
    • Cuentas por cobrar: PUC 1305 (Clientes nacionales), 1310 (Clientes del exterior)<br/>
    • Cuentas por pagar: PUC 2205 (Proveedores nacionales), 2210 (Proveedores del exterior)<br/>
    • Desglose por vencimiento: 0-30, 30-60, 60-90, 90+ días<br/>
    • Provisión automática de deudas de difícil cobro (cuenta 1399)<br/>
    • Seguimiento de pagos y cobros<br/>
    • Proyección de flujo de efectivo en COP y USD<br/>
    • Alertas de vencimientos próximos y clientes en mora<br/>
    • Generación de estado de cuenta por cliente/proveedor<br/>
    """
    story.append(Paragraph(cxc_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 12. Declaraciones DIAN
    story.append(Paragraph("1️⃣2️⃣ DECLARACIONES TRIBUTARIAS DIAN (IVA · RETENCIÓN · RENTA)", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    libros_text = """
    <b>Declaración de IVA — Formulario 300:</b><br/>
    1. Sistema consolida todas las ventas e IVA generado del período<br/>
    2. Consolida IVA descontable (compras) del mismo período<br/>
    3. Calcula: IVA a pagar = IVA generado - IVA descontable - ReteIVA sufrida<br/>
    4. Exporta datos pre-diligenciados para cargar en Muisca DIAN<br/>
    • Declarantes bimestrales: Ene-Feb, Mar-Abr, May-Jun, Jul-Ago, Sep-Oct, Nov-Dic<br/>
    • Declarantes cuatrimestrales: Ene-Abr, May-Ago, Sep-Dic<br/><br/>

    <b>Retención en la Fuente — Formulario 350:</b><br/>
    1. Consolida todas las retenciones practicadas en el mes<br/>
    2. Por concepto: compras, servicios, honorarios, arrendamientos, etc.<br/>
    3. Exporta datos para Formulario 350 en Muisca DIAN<br/>
    4. Vence el día 10-12 de cada mes según último dígito del NIT<br/><br/>

    <b>Renta Personas Jurídicas — Formulario 110:</b><br/>
    1. Consolida ingresos, costos y gastos del año gravable<br/>
    2. Calcula renta líquida gravable y descuentos tributarios<br/>
    3. Aplica tarifa: 35% para 2026<br/>
    4. Exporta datos para Formulario 110 en Muisca DIAN<br/><br/>

    <b>Medios Magnéticos / Exógena:</b><br/>
    1. Genera reporte anual de terceros (clientes, proveedores, empleados)<br/>
    2. Formatos: 1001 (pagos), 1007 (ingresos), 1008 (descuentos), 1009 (retenciones)<br/>
    3. Vence en mayo del año siguiente según calendario DIAN<br/>
    """
    story.append(Paragraph(libros_text, body_style))
    story.append(PageBreak())

    # 13. DIAN
    story.append(Paragraph("1️⃣3️⃣ DIAN - CUMPLIMIENTO TRIBUTARIO COLOMBIANO", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    sunat_text = """
    <b>Obligaciones ante la DIAN:</b><br/>
    • Verificación automática de NIT de clientes y proveedores (RUT DIAN)<br/>
    • Cálculo de IVA (19%, 5%, 0%) y retenciones en la fuente<br/>
    • Seguimiento de facturas electrónicas (estado ACEPTADA / RECHAZADA / EN PROCESO)<br/>
    • Aplicación automática de ReteIVA (15% del IVA) cuando aplica<br/>
    • Retención de ICA según tarifa municipal (Bogotá, Medellín, Cali, etc.)<br/>
    • Generación de Exógena (Medios Magnéticos) para informe de terceros<br/>
    • Alertas de vencimientos tributarios según calendario DIAN<br/>
    • Régimen SIMPLE: cálculo de tasa unificada según actividad y ingresos<br/>
    • GMF (4x1000): registro automático en cada transacción bancaria<br/>
    <br/>
    <b>Portal Muisca DIAN:</b><br/>
    • Acceso integrado al portal Muisca DIAN para declaraciones<br/>
    • Consulta de estado del RUT de proveedores y clientes en tiempo real<br/>
    • Verificación de CUFE de facturas electrónicas recibidas<br/>
    • Descarga de facturas electrónicas emitidas y recibidas<br/>
    """
    story.append(Paragraph(sunat_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 14. Reportes
    story.append(Paragraph("1️⃣4️⃣ REPORTES FINANCIEROS (NIIF COLOMBIA)", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    reportes_text = """
    <b>Reportes disponibles:</b><br/>
    • Estado de Resultados Integral (Ingresos - Costos - Gastos = Utilidad)<br/>
    • Estado de Situación Financiera / Balance General (Activos = Pasivos + Patrimonio)<br/>
    • Estado de Flujos de Efectivo (Actividades operacionales, inversión y financiación)<br/>
    • Estado de Cambios en el Patrimonio<br/>
    • Indicadores financieros (Rentabilidad, Liquidez, Endeudamiento, EBITDA)<br/>
    • Comparativo período a período y vs. presupuesto<br/>
    • Exportación a XLSX y PDF con logos corporativos<br/>
    • Reportes para Superintendencia de Sociedades (cuando aplique)<br/>
    """
    story.append(Paragraph(reportes_text, body_style))
    story.append(Spacer(1, 0.2 * inch))

    # 15. Owner Portal
    story.append(Paragraph("1️⃣5️⃣ PORTAL DEL PROPIETARIO", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    owner_text = """
    <b>Vista ejecutiva para propietarios:</b><br/>
    • Resumen de resultados financieros en COP y USD<br/>
    • KPI principales del negocio<br/>
    • Análisis de rentabilidad por línea de negocio y centro de costo<br/>
    • Proyecciones de crecimiento y flujo de caja<br/>
    • Alertas de riesgos tributarios DIAN identificados<br/>
    • Dashboard de obligaciones tributarias pendientes<br/>
    """
    story.append(Paragraph(owner_text, body_style))
    story.append(PageBreak())

    # 16. Configuración
    story.append(Paragraph("1️⃣6️⃣ CONFIGURACIÓN GENERAL", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    config_text = """
    <b>Parámetros configurables:</b><br/>
    • Datos de la empresa (NIT, razón social, dirección, régimen tributario)<br/>
    • Actividad económica CIIU (Clasificación Industrial Internacional Uniforme)<br/>
    • Resolución de facturación DIAN (prefijo, rango y vigencia)<br/>
    • Centros de costo por ciudad y departamento<br/>
    • Catálogo de cuentas PUC (personalizable dentro del estándar)<br/>
    • Usuarios y roles (Contador, Auxiliar, Gerente, Auditor)<br/>
    • Período contable actual<br/>
    • Tasas de retención configurables por tipo de tercero<br/>
    • Tarifas ICA por municipio (Bogotá, Medellín, Cali, Barranquilla, etc.)<br/>
    • Configuración de bancos y cuentas bancarias<br/>
    • TRM (Tasa Representativa del Mercado) actualización automática Banco de la República<br/>
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
    • Estilos con Tailwind CSS + CSS personalizado (colores Colombia)<br/>
    • Animaciones con Framer Motion<br/>
    • Iconos con Fluent UI<br/><br/>

    <b>Backend (Lógica de Negocio):</b><br/>
    • FastAPI (Python) en servidor<br/>
    • Endpoints REST en /api/v1/<br/>
    • Base de datos PostgreSQL<br/>
    • Servicio de integridad: Hash Chain (SHA-256)<br/>
    • Orquestador de asientos: LedgerPostingService (PUC Colombia)<br/>
    • Adaptador DIAN: Facturación Electrónica vía SOAP/REST<br/><br/>

    <b>Flujo de una transacción (Ej: Venta Factura Electrónica FEV-0001-8421):</b><br/>
    1. Usuario ingresa datos de venta en formulario<br/>
    2. Frontend envía POST /api/v1/orchestrator/sync-sale<br/>
    3. Backend valida: NIT cliente (DIAN), montos, resolución DIAN vigente<br/>
    4. Sistema genera XML de factura electrónica y lo firma con certificado digital<br/>
    5. Se envía a DIAN y se recibe CUFE (Código Único de Factura Electrónica)<br/>
    6. Se crea asiento contable automático con cuentas PUC<br/>
    7. Se genera hash SHA-256 para auditoría de integridad<br/>
    8. Si DIAN acepta, estado = "DIAN-ACEPTADA"<br/>
    9. Frontend actualiza tabla con nueva fila y CUFE<br/>
    10. Usuario ve cambio en tiempo real con estado de la factura<br/>
    <br/>
    <b>Seguridad y Cumplimiento:</b><br/>
    • Hash Chain: Cada asiento contiene hash del anterior (inmutable)<br/>
    • Certificado digital: Firma electrónica para facturas DIAN<br/>
    • Detecta automáticamente manipulaciones en libros<br/>
    • Cumplimiento Decreto 2420/2015 y normativa DIAN vigente<br/>
    """
    story.append(Paragraph(arquitectura_text, body_style))
    story.append(PageBreak())

    # 18. Ledger Engine
    story.append(Paragraph("1️⃣8️⃣ LEDGER ENGINE - VALIDACIÓN EXPERTA ANTES DE GUARDAR", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    ledger_engine_text = """
    El Ledger Engine es un flujo inteligente que valida legal y contablemente cada
    transacción antes de permitir su guardado en la base de datos, bajo normativa colombiana.
    <br/><br/>
    <b>Objetivo:</b><br/>
    • Evitar asientos inválidos o incompletos bajo el PUC colombiano<br/>
    • Cumplir normativa DIAN y Estatuto Tributario automáticamente<br/>
    • Garantizar integridad de partida doble y centros de costo<br/><br/>

    <b>Controles automáticos clave para Colombia:</b><br/>
    • Partida doble obligatoria: Débito = Crédito<br/>
    • IVA: verificación de tarifa correcta (19%, 5%, 0%) según bien/servicio<br/>
    • Retención en la fuente automática según tipo de proveedor y concepto<br/>
    • ReteIVA aplicada cuando el comprador es Gran Contribuyente o agente retenedor<br/>
    • ICA calculado automáticamente según municipio del servicio<br/>
    • Bancarización obligatoria para pagos > $1.000.000 COP (Art. 771-5 ET)<br/>
    • Centro de costo obligatorio en gastos clase 5<br/>
    • NIT del tercero validado contra RUT DIAN en tiempo real<br/>
    • GMF (4x1000) registrado automáticamente en movimientos bancarios<br/><br/>

    <b>Qué ve el usuario en pantalla:</b><br/>
    • Asiento diario propuesto con cuentas PUC<br/>
    • Resultado de cumplimiento legal y tributario colombiano<br/>
    • Acciones requeridas (ej: aplicar retención, verificar NIT en DIAN)<br/>
    • Estado final: "Aprobado" o "Bloqueado" con motivo<br/><br/>

    <b>Beneficio operativo:</b><br/>
    Se reducen errores de registro, observaciones en auditoría DIAN y riesgos de sanción
    por incumplimiento de las obligaciones tributarias colombianas.
    """
    story.append(Paragraph(ledger_engine_text, body_style))
    story.append(PageBreak())

    # Resumen final
    story.append(Paragraph("📋 RESUMEN DE FLUJOS CONTABLES COLOMBIA", heading_style))
    story.append(Spacer(1, 0.1 * inch))

    resumen_text = """
    <b>Flujo Diario Típico:</b><br/>
    1. Mañana: Revisar Dashboard (métricas del día en COP)<br/>
    2. Registrar Ventas del día con Factura Electrónica DIAN<br/>
    3. Registrar Compras del día (con validación NIT y CUFE)<br/>
    4. Aplicar Retenciones en la Fuente y ReteIVA según corresponda<br/>
    5. Movimientos de Tesorería (Nequi, PSE, transferencia bancaria)<br/>
    6. Ajustes manuales si es necesario (módulo Contabilidad PUC)<br/>
    7. Fin de día: Verificar integridad (Escanear hash SHA-256)<br/><br/>

    <b>Flujo Mensual / Bimestral (Declaraciones DIAN):</b><br/>
    1. Hacer cierre del período en Configuración<br/>
    2. Validar todos los asientos están cuadrados (Débito = Crédito)<br/>
    3. Generar pre-declaración de IVA (Formulario 300) — bimestral/cuatrimestral<br/>
    4. Generar pre-declaración Retención en la Fuente (Formulario 350) — mensual<br/>
    5. Cargar archivos en portal Muisca DIAN y presentar declaraciones<br/>
    6. Pagar tributos por PSE o banco antes del vencimiento DIAN<br/>
    7. Generar Reportes Financieros para gerencia<br/><br/>

    <b>Flujo Anual:</b><br/>
    1. Declaración de Renta Personas Jurídicas — Formulario 110 (abril)<br/>
    2. Medios Magnéticos / Exógena DIAN — Formatos 1001/1007/1008/1009 (mayo)<br/>
    3. Conciliación contable-fiscal para ajustes NIIF vs. declaración fiscal<br/>
    4. Elaboración de notas a los estados financieros<br/>
    5. Revisión de activos fijos y depreciaciones acumuladas<br/><br/>

    <b>Flujo de Riesgos Tributarios:</b><br/>
    1. Sistema detecta anomalía (ej: NIT proveedor inhabilitado en DIAN)<br/>
    2. IA genera "Hallazgo Forense" con base legal colombiana<br/>
    3. Se muestra en Log de Hallazgos en módulo Compras<br/>
    4. Usuario analiza y toma acción correctiva<br/>
    5. Se marca como resuelto y se archiva evidencia<br/>
    """
    story.append(Paragraph(resumen_text, body_style))
    story.append(Spacer(1, 0.3 * inch))

    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey,
    )
    story.append(Paragraph(
        f"<br/><br/>© 2026 CONTA_COLPRO Enterprise — Colombia. Manual versión 1.5. "
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}<br/>"
        f"Cumplimiento DIAN · PUC · NIIF · Estatuto Tributario Colombiano.<br/>"
        f"Todos los derechos reservados.",
        footer_style
    ))

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"✅ PDF generado exitosamente: {OUTPUT_PATH}")

if __name__ == '__main__':
    create_manual()
