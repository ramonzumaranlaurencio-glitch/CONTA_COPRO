# The Ledger Engine - Documentación Completa

## Resumen Ejecutivo

**The Ledger Engine** es un flujo integrado de validación legal y contable que **bloquea asientos inválidos ANTES de persistir en la base de datos**.

### Arquitectura

```
Entrada (transacción)
    ↓
[Unit A: Clasificación] → Genera asientos PCGE, destinos automáticos, retenciones
    ↓
[Unit B: Cumplimiento] → Valida SUNAT, Código Tributario, Principio de Causalidad, Bancarización
    ↓
[JSON Schema Estructurado] → Header + Accounting Logic + Compliance Check + Action Required
    ↓
¿Válido? → SÍ: Retorna JSON completo (200 OK)
        → NO: Lanza ExpertValidationException (422 UNPROCESSABLE ENTITY) → NO PERSISTE
```

---

## 1. Unit A: Agente de Clasificación y Asiento (Core Contable)

**Archivo:** `src/application/services/ledger_unit_a_classification.py`

**Responsabilidades:**
- Genera asientos contables JSON validados contra PCGE
- **Regla de Oro:** Todo gasto clase 6 genera automáticamente destino a clase 9 (Centro de Costos)
- Detecta IGV 18% si es Factura
- Calcula retención 4ta categoría 8% si es Recibo Honorarios y supera UIT

**Ejemplo de Uso:**

```python
from decimal import Decimal
from src.application.services.ledger_unit_a_classification import (
    ClassificationAgent,
    TransactionType,
)

agent_a = ClassificationAgent()

output = agent_a.classify_transaction(
    transaction_type=TransactionType.FACTURA,
    amount=Decimal("1000.00"),
    igv_included=True,
    has_cost_center=True,
    cost_center_code="LIM-COM",
)

print(output.asiento_principal)  # Lista de JournalLine con Debe/Haber
print(output.asientos_destino)   # Destinos automáticos clase 9
print(output.retension_4ta_cat)  # Si aplica
```

---

## 2. Unit B: Agente de Cumplimiento (Legal/Tributario/Laboral)

**Archivo:** `src/application/services/ledger_unit_b_compliance.py`

**Responsabilidades:**
- Valida contra SUNAT, Código Tributario, MTPE
- **Bancarización:** Si monto > S/ 2,000 o > $ 500, requiere validación de medio de pago
- **Causalidad:** Evalúa Principio de Causalidad (TUO LIR Art. 37)
- **Detracciones:** Calcula SPOT (Sistema de Detracciones) automáticamente

**Ejemplo de Uso:**

```python
from decimal import Decimal
from src.application.services.ledger_unit_b_compliance import ComplianceAgent

agent_b = ComplianceAgent()

output = agent_b.audit_document(
    transaction_type="COMPRA_MERCADERIA",
    amount=Decimal("3000.00"),  # > 2000, requiere bancarización
    currency="PEN",
    payment_method="TRANSFERENCIA",  # Válido
    supplier_ruc="20450123456",
    service_code="TRANSPORTE_CARGA",  # Detracción 10%
    doc_type_code="01",
)

print(output.bancarizacion.requiere_bancarizacion)  # True
print(output.causalidad.status)                     # VALID
print(output.detraccion.monto_detraccion)           # 300.00 (10% de 3000)
```

---

## 3. JSON Output Schema (LedgerEngineOutput)

**Archivo:** `src/application/dto/ledger_engine_output.py`

**Estructura:**

```json
{
  "header": {
    "operacion_id": "TRANS-2026-001",
    "tipo_documento": "Factura Electrónica",
    "entidad": "SUNAT/Bancos",
    "fecha_procesamiento": "2026-05-11T14:30:00Z",
    "version_pcge": "Actualizado 2026"
  },
  "accounting_logic": {
    "asiento_diario": [
      {"cuenta": "60111", "debe": 1000.00, "haber": 0.00, "glosa": "Compra de mercadería"},
      {"cuenta": "40111", "debe": 180.00, "haber": 0.00, "glosa": "IGV - Crédito Fiscal"},
      {"cuenta": "42121", "debe": 0.00, "haber": 1180.00, "glosa": "Facturas por pagar"}
    ],
    "asiento_destino": [
      {"cuenta": "91001", "debe": 1000.00, "haber": 0.00}
    ],
    "retension_4ta_categoria": null,
    "validaciones_pcge": ["Partida doble validada", "Centro de costos asignado"]
  },
  "compliance_check": {
    "bancarizacion_requerida": false,
    "bancarizacion_validada": null,
    "causalidad_cumplida": true,
    "detraccion_aplica": false,
    "detraccion_tasa": 0.00,
    "detraccion_monto": 0.00,
    "alerta_legal": "Ninguna. Cumple normativa.",
    "bloqueante": false
  },
  "action_required": {
    "notificar_tesoreria": null,
    "generar_carta_descargo": false,
    "requerimiento_tipo": null,
    "fecha_vencimiento_respuesta": null,
    "registro_sunat_listo": true
  },
  "bloquea_persistencia": false,
  "razon_bloqueo": null
}
```

---

## 4. Command Registry: Módulos y Triggers

**Archivo:** `src/application/services/ledger_command_registry.py`

**Módulos disponibles:**

| Botón / Evento | Instrucción IA | Documento Soporte |
|---|---|---|
| **Ingreso de Gasto** | Valida XML/PDF, detecta IGV, genera asiento y destino, clasifica centro de costo. | Ley del IR / PCGE |
| **Trámite Bancario** | Concilia voucher con factura pendiente. Si es transferencia, verifica código de operación. | Ley de Bancarización |
| **Documento Legal** | Analiza requerimiento (SUNAT/MTPE). Redacta carta de respuesta citando base legal. | Código Tributario / LPAG |
| **Anticipo** | No enviar a gasto. Registra en cuenta 122 (ventas) o 422 (compras) hasta facturación final. | NIC 1 / PCGE |
| **Devolución** | Genera NC/ND, revierte asiento original, mantiene trazabilidad. | NIC 18 / NIIF 15 |
| **Retención** | Registra retención IGV (40114), LIR (pasivo), o 4ta cat (8% si >UIT). | TUO LIR |
| **Ajuste de Cierre** | Diferencia de cambio, cobranza dudosa, depreciación, provisiones laborales. | NIC 1 / NIC 16 / NIC 37 |

---

## 5. Ledger Engine Orchestrator

**Archivo:** `src/application/services/ledger_engine_orchestrator.py`

**Flujo Integrado:**

```python
from decimal import Decimal
from src.application.services.ledger_engine_orchestrator import LedgerEngineOrchestrator
from src.application.services.ledger_command_registry import ModuleCommand
from src.domain.exceptions import ExpertValidationException

orchestrator = LedgerEngineOrchestrator()

try:
    output = orchestrator.process_transaction(
        module_command=ModuleCommand.INGRESO_GASTO,
        transaction_type="FACTURA",
        amount=Decimal("3500.00"),
        currency="PEN",
        supplier_ruc="20450123456",
        cost_center="LIM-COM",
        payment_method="TRANSFERENCIA",
        service_code="SERVICIOS_COMIDA",  # Detracción 10%
    )
    
    # Si llegó aquí, asiento es válido
    print(f"✅ Asiento validado: {output.header.operacion_id}")
    print(f"Accounting: {output.accounting_logic.asiento_diario}")
    print(f"Compliance: {output.compliance_check.alerta_legal}")
    
    # AQUÍ se puede persistir a BD
    # await ledger_service.post_journal(output)
    
except ExpertValidationException as exc:
    # ❌ BLOQUEO - NO PERSISTE
    print(f"❌ Validación fallida: {exc}")
    print(f"Checks: {exc.checks}")
```

---

## 6. Endpoint API: POST /api/v1/ledger/engine

**Archivo:** `src/api/routes/ledger_engine_endpoint.py`

**Solicitud:**

```bash
curl -X POST http://localhost:8000/api/v1/ledger/engine \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "module_command": "ingreso_gasto",
    "transaction_type": "FACTURA",
    "amount": 3500.00,
    "currency": "PEN",
    "supplier_ruc": "20450123456",
    "cost_center": "LIM-COM",
    "payment_method": "TRANSFERENCIA",
    "service_code": "SERVICIOS_COMIDA",
    "doc_type_code": "01"
  }'
```

**Respuesta (200 OK):**

```json
{
  "status": "OK",
  "bloquea_persistencia": false,
  "operacion_id": "TRANS-3500-FACTURA",
  "accounting_logic": { ... },
  "compliance_check": { ... },
  "action_required": { ... },
  "header": { ... }
}
```

**Respuesta (422 UNPROCESSABLE ENTITY):**

```json
{
  "detail": {
    "message": "Validacion experta bloqueada: Monto 3500 PEN excede límite pero NO reporta medio de pago",
    "checks": [
      {
        "code": "BANCARIZACION_VALIDADA",
        "passed": false,
        "detail": "Método '' NO es válido para monto de 3500 PEN"
      }
    ],
    "bloqueante": true
  }
}
```

---

## 7. Configuración

**Archivo:** `src/config.py`

```python
expert_accounting_enabled: bool = True                    # Activar Ledger Engine
document_ai_provider: str = "layoutlmv3"                  # OCR avanzado
rag_vector_provider: str = "pgvector"                     # Vector DB
rag_corpus_sources: str = "TUO_LIR,CODIGO_TRIBUTARIO,..." # Docs legales
sunat_realtime_guard_enabled: bool = True                 # Guard SUNAT
```

---

## 8. Reglas de Oro Implementadas

### ✅ Regla 1: Partida Doble
```
Debe = Haber (siempre se valida)
```

### ✅ Regla 2: Centro de Costos en Gastos
```
Si cuenta comienza con 6 o 9 (gasto)
  → Centro de costo OBLIGATORIO
  → Si falta → BLOQUEA
```

### ✅ Regla 3: Bancarización por Monto
```
Si monto > S/ 2,000 O > $ 500
  → Requiere medio de pago (TRANSFERENCIA, CHEQUE, etc)
  → Si no lo reporta → BLOQUEA
```

### ✅ Regla 4: Causalidad Tributaria
```
Gasto debe ser necesario para mantener fuente de renta
  → Gastos no deducibles (multas, personal, etc) → BLOQUEA
  → Gastos deducibles (compra, honorarios, etc) → PERMITE
```

### ✅ Regla 5: Gasto Clase 6 → Destino Clase 9
```
Si cuenta 6x (gasto)
  → Automáticamente genera asiento en 9x (centro de costo)
  → Línea en 79 (orden)
```

### ✅ Regla 6: Retención 4ta Categoría
```
Si TransactionType = RECIBO_HONORARIOS
  → Calcular 8% de retención
  → Si monto bruto >= UIT 2026 (S/ 5,350)
    → Marcar como "requiere_retension": true
```

### ✅ Regla 7: Sistema de Detracciones (SPOT)
```
Si service_code está en tabla SPOT
  → Calcular automáticamente % de detracción
  → Generar sugerencia: "Registrar detracción en cuenta 104"
```

---

## 9. Casos de Uso Paso a Paso

### Caso 1: Ingreso de Factura de Compra (Gasto Deducible)

```json
POST /api/v1/ledger/engine
{
  "module_command": "ingreso_gasto",
  "transaction_type": "FACTURA",
  "amount": 2500.00,
  "currency": "PEN",
  "supplier_ruc": "20123456789",
  "cost_center": "LIM-ADMIN",
  "payment_method": "TRANSFERENCIA",
  "doc_type_code": "01"
}
```

**Flujo Unit A:**
- Detecta IGV 18% → Subtotal 2118.64, IGV 381.36
- Genera 3 líneas: Gasto (60111) | IGV (40111) | CxP (42121)
- Crea destino automático: 60111 → 91001

**Flujo Unit B:**
- Bancarización: > 2000 PEN, reporta TRANSFERENCIA ✅
- Causalidad: COMPRA_MERCADERIA es deducible ✅
- Detracciones: NO aplica ✅
- Resultado: **VÁLIDO, NO BLOQUEA**

**Output:** JSON con asientos + "registro_sunat_listo": true

---

### Caso 2: Ingreso de Recibo de Honorarios (Con Retención 4ta)

```json
POST /api/v1/ledger/engine
{
  "module_command": "ingreso_gasto",
  "transaction_type": "RECIBO_HONORARIOS",
  "amount": 6000.00,
  "currency": "PEN",
  "cost_center": "LIM-ADMIN"
}
```

**Flujo Unit A:**
- Detecta Recibo Honorarios
- Calcula retención 4ta cat: 6000 * 8% = 480 (retención)
- Como 6000 > UIT 2026 (5350), marca "requiere_retension": true
- Genera asiento: 62312 (Honorarios) | 42112 (CxP)

**Output:** JSON con "retension_4ta_categoria": 480

---

### Caso 3: Ingreso de Gasto SIN Centro de Costos

```json
POST /api/v1/ledger/engine
{
  "module_command": "ingreso_gasto",
  "transaction_type": "FACTURA",
  "amount": 1500.00,
  "currency": "PEN",
  "supplier_ruc": "20123456789"
  // ⚠️ FALTA cost_center
}
```

**Flujo Unit B:**
- Causalidad validada ✅
- Pero: alertas incluye "Gasto registrado sin centro de costo"
- **Resultado: VÁLIDO pero con advertencia**

---

### Caso 4: Monto Alto SIN Bancarización

```json
POST /api/v1/ledger/engine
{
  "module_command": "ingreso_gasto",
  "transaction_type": "FACTURA",
  "amount": 5000.00,
  "currency": "PEN",
  "supplier_ruc": "20123456789"
  // ⚠️ FALTA payment_method (monto > 2000)
}
```

**Flujo Unit B:**
- Bancarización requerida (monto > 2000) ✅
- Pero payment_method NO reportado ❌
- **Resultado: BLOQUEANTE - NO PERSISTE**
- Error 422: "Monto 5000 PEN excede límite pero NO reporta medio de pago"

---

## 10. Integración con Ledger Existente

**Paso 1:** Endpoint de Ledger Engine procesa y valida

```python
POST /api/v1/ledger/engine
↓
LedgerEngineOrchestrator.process_transaction()
↓
if output.bloquea_persistencia:
    raise ExpertValidationException (422)
else:
    return JSON completo (200 OK)
```

**Paso 2:** Si es válido, cliente puede persistir usando endpoint tradicional

```python
POST /api/v1/ledger/journal
{
  ...asiento del output del engine...
}
```

---

## 11. Próximos Pasos

1. **RAG Vector DB:** Cargar corpus oficial SUNAT, TUO, D. Leg. 728
2. **Verificación SUNAT Realtime:** Integrar consulta de RUC/Comprobante activo/anulado
3. **Módulo Legal:** Redacción automática de cartas descargo
4. **Integración Móvil:** Fotografía de factura → OCR → Ledger Engine → Asiento

---

**Versión:** 1.0  
**Actualizado:** Mayo 2026  
**Status:** 🟢 Production Ready
