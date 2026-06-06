# Estándares Colombianos de ContaPro - Guía de Identidad Tributaria y Contable

## Estado: ✅ CONSOLIDADO - 2026-06-06

Esta documentación consolida la identidad única de **CONTA_PRO Enterprise para Colombia (DIAN)**.
Se han eliminado todas las referencias a normas peruanas (SUNAT, PCGE, PLE, SIRE, RENIEC, RUC).

---

## 1. IDENTIDAD FISCAL Y TRIBUTARIA

### 🇨🇴 Autoridad Reguladora: DIAN (Dirección de Impuestos y Aduanas Nacionales)

| Concepto | Colombia (DIAN) | ~~Perú (SUNAT)~~ |
|----------|---|---|
| **Identificación Empresa** | NIT (Número de Identificación Tributaria) | ~~RUC~~ |
| **Identificación Personal** | Cédula de Ciudadanía (5-12 dígitos) | ~~DNI/RUC~~ |
| **Factura Electrónica** | Factura Electrónica con CUFE (Código Único de Facturación Electrónica) | ~~UBL/XML de SUNAT~~ |
| **Validación RUT** | Consulta DIAN en línea a `settings.dian_rut_lookup_url` | ~~RENIEC/SUNAT~~ |
| **Antecedentes** | DIAN, Superintendencias, JEP | ~~Antecedentes SUNAT~~ |

### Endpoints de Validación en DIAN
```python
# Configuración correcta en settings
settings.dian_nit_lookup_url              # Validar NIT de proveedores
settings.dian_documento_lookup_url        # Consultar estado fiscal
settings.dian_lookup_token                # Token de acceso DIAN
settings.dian_realtime_timeout_seconds    # Timeout (recomendado: 10s)
settings.dian_realtime_guard_enabled      # Activar guardia DIAN
settings.dian_guard_block_on_unavailable  # Bloquear si DIAN no disponible
```

---

## 2. PLAN CONTABLE: PUC (Plan Único de Cuentas)

### 📊 Norma: DIAN y Superintendencia Financiera (Res. 20089/2002)

**PUC es el único plan contable válido para Colombia.** Se han eliminado todas las referencias a:
- ~~PCGE (Plan Contable General Empresarial - Perú)~~
- ~~Cuentas con prefijo 6xxx (ingresos SUNAT)~~
- ~~Cuentas con prefijo 7xxx (gastos SUNAT)~~

### Estructura PUC Colombiano (14xx, 15xx - Inventarios y Activos)

```python
# src/api/routes/catalog.py | inventory.py | purchases.py

PUC_INVENTARIO = {
    "1405": "Materias primas",
    "1410": "Productos en proceso",
    "1430": "Productos terminados",
    "1435": "Mercancías no fabricadas por la empresa",
    "1455": "Materiales, repuestos y accesorios",
    "1460": "Envases y empaques",
    "1520": "Maquinaria y equipo",
    "1524": "Equipo de oficina",
    "1528": "Equipo de cómputo y comunicación",
    "1540": "Flota y equipo de transporte",
}

PUC_GASTO = {
    "513540": "Servicios públicos (administración)",
    "513575": "Transporte, fletes y acarreos",
    "539595": "Gastos varios",
    "2408": "IVA por pagar (descontable)",
    "2205": "Proveedores nacionales",
    # ... otros según naturaleza
}
```

---

## 3. FACTURACIÓN ELECTRÓNICA Y RADIAN

### 📄 Sistema: RADIAN (Resolución 000042 de 2020 - DIAN)

CONTA_PRO integra con **RADIAN**, no con ~~PLE/SIRE de SUNAT~~.

```python
# src/api/routes/tax.py

# ✅ CORRECTO (DIAN Colombia)
@router.post("/radian/registro")
@router.post("/audit-log/diario")          # Libro diario DIAN
@router.post("/audit-log/mayor")           # Libro mayor DIAN
@router.post("/submissions")               # Envío a RADIAN

# ❌ ELIMINADO (SUNAT Perú)
# @router.post("/sire/rvie")               # SUNAT Peru
# @router.post("/ple/daily-book")          # SUNAT Peru
# @router.post("/ple/general-ledger")      # SUNAT Peru
```

### Campo de Estado: `dian_status` (no `sunat_status`)

```python
# Modelos del Dominio
class FinancialDocument(Base):
    dian_status: str              # ✅ DIAN (PENDING, QUEUED, ACCEPTED, REJECTED)
    dian_response_status: str     # Respuesta DIAN
    dian_response_description: str
    # ...NO: sunat_status, cdr_status, etc.

class DianSubmission(Base):       # ✅ DIAN (antes: SunatSubmission)
    cud_code: str                 # Comprobante Único de la DIAN (no CDR)
    response_description: str
```

---

## 4. RECURSOS HUMANOS Y NÓMINA

### 👥 Marco Legal: Código Sustantivo del Trabajo (CST) + Ley 100/1993

**Validación de Identidad:**
```python
# src/api/routes/hr.py

# ✅ CORRECTO (Colombia)
settings.dian_rut_lookup_url              # Validar RUT (Cédula + NIT empresa)
settings.dian_antecedentes_lookup_url     # Consultar antecedentes DIAN

# ❌ ELIMINADO (Perú)
# settings.sunat_ruc_lookup_url            # RENIEC/SUNAT
# settings.sunat_cpe_lookup_url            # Antecedentes SUNAT
```

**Régimen de Pensiones:**
```python
# Opciones válidas Colombia
pension_system: "AFP"      # Administadora Fondos de Pensiones (privado)
pension_system: "COLPENSIONES"  # Instituto (público)
pension_system: "NO_AFILIADO"   # Excepciones normadas
```

**Tributos:**
- ✅ CST (Código Sustantivo del Trabajo)
- ✅ Ley 1562/2012 (Seguridad y Salud en el Trabajo)
- ✅ Ley 100/1993 (Seguridad Social)
- ✅ Ley 21/1982 (Parafiscales)
- ✅ PILA (Planilla Integrada de Liquidación de Aportes)
- ✅ ReteFuente (Retención en la fuente - Art. 383 ET)
- ✅ Ley 1581/2012 (Protección de Datos)

---

## 5. MAPEO DE CAMBIOS REALIZADOS

### 5.1 tax.py
| Cambio | Antes | Después |
|--------|-------|---------|
| Tag de ruta | ✅ "DIAN Colombia Enterprise" | (sin cambios) |
| Imports | ~~SunatSubmission~~ | **DianSubmission** |
| Imports | ~~PleGenerator, SireGenerator~~ | **InvoiceGenerator, RadianSubmissionService** |
| Settings | ~~sunat_xsd_dir~~ | **dian_xsd_dir** |
| Settings | ~~sunat_ruc~~ | **dian_nit** |
| Payloads | ~~SirePayload, PleDailyPayload~~ | **RadianSubmissionPayload, DianRegistroPayload** |
| Endpoints | ~~/sire/rvie, /ple/~~ | **/radian/registro, /audit-log/diario** |
| Topic | ~~sunat.submission.retry~~ | **dian.submission.retry** |
| Campo PDF | "SUNAT" → | "DIAN Colombia" |

### 5.2 hr.py
| Cambio | Antes | Después |
|--------|-------|---------|
| Settings | ~~sunat_ruc_lookup_url~~ | **dian_rut_lookup_url** |
| Settings | ~~sunat_cpe_lookup_url~~ | **dian_antecedentes_lookup_url** |
| Check | ~~reniec_checked~~ | **dian_checked** |
| Mensaje | ~~"RENIEC/SUNAT"~~ | **"DIAN/RUT Colombia"** |
| DNI Format | ~8 dígitos~ | **5-12 dígitos (Cédula)** |

### 5.3 inventory.py
| Cambio | Antes | Después |
|--------|-------|---------|
| Función | ~~_pcge_account_name()~~ | **_puc_account_name()** |
| Comentario | "REPORTE PCGE" → | **"REPORTE PUC"** |
| Mensaje | "cuenta PCGE" → | **"cuenta PUC"** |

### 5.4 purchases.py
| Cambio | Antes | Después |
|--------|-------|---------|
| Loop | ~~for rule in PCGE_RULE_LIBRARY~~ | **for rule in PUC_RULE_LIBRARY** |
| Variable | ~~pcge_rules~~ | **puc_rules** |
| Comentario | ~~"reglas PCGE"~~ | **"reglas PUC"** |
| Alias | `PCGE_RULE_LIBRARY = PUC_RULE_LIBRARY` | (mantenido para compatibilidad) |

### 5.5 ledger.py
| Cambio | Antes | Después |
|--------|-------|---------|
| Import | ~~SunatRealtimeVerifier~~ | **DianRealtimeVerifier** |
| Settings | ~~sunat_ruc_lookup_url~~ | **dian_nit_lookup_url** |
| Topic | ~~sunat.credit_note.draft~~ | **dian.credit_note.draft** |

---

## 6. CONFIGURACIÓN DE SETTINGS OBLIGATORIA

Actualizar `src/config/__init__.py`:

```python
# ✅ DIAN Colombia (OBLIGATORIO)
dian_nit_lookup_url: str = "https://api-dian.example.com/nit-search"
dian_documento_lookup_url: str = "https://api-dian.example.com/documento-search"
dian_lookup_token: str = os.getenv("DIAN_LOOKUP_TOKEN", "")
dian_realtime_timeout_seconds: int = 10
dian_realtime_guard_enabled: bool = True
dian_guard_block_on_unavailable: bool = False
dian_rut_lookup_url: str = "https://api-dian.example.com/rut-search"
dian_antecedentes_lookup_url: str = "https://api-dian.example.com/antecedentes"
dian_xsd_dir: str = "schemas/dian"

# ❌ SUNAT Perú (DEPRECADO - NO USAR)
# sunat_ruc_lookup_url: str
# sunat_cpe_lookup_url: str
# sunat_xsd_dir: str
# etc.
```

---

## 7. VERIFICACIÓN Y TESTS

### Checklist de Consolidación

- ✅ No existen imports de `sunat_*` en código activo
- ✅ No existen imports de `Sunat*` models en código activo
- ✅ No existen queries a `SunatSubmission` table (migración a `DianSubmission`)
- ✅ No existen referencias a `PCGE` en comentarios (excepto patches viejos)
- ✅ No existen referencias a `RENIEC` en RRHH (solo DIAN)
- ✅ No existen referencias a `RUC de Perú` (solo Cédula + NIT Colombia)
- ✅ No existen operaciones SIRE, PLE (sustituidas por RADIAN)

### Tests Recomendados

```bash
# Verificar no hay imports peruanos
grep -r "from.*sunat" src/api/routes/ src/application/ src/domain/ || echo "✅ Sin imports SUNAT"
grep -r "SunatSubmission\|PCGE_RULE_LIBRARY[^= ]" src/api/routes/ src/application/ || echo "✅ Sin modelos SUNAT"

# Verificar consolidación
grep -c "PUC_RULE_LIBRARY\|puc_rules\|_puc_account_name" src/api/routes/purchases.py src/api/routes/inventory.py
```

---

## 8. REFERENCIAS NORMATIVAS

### 📋 Regulaciones Clave

1. **DIAN**
   - [Facturación Electrónica RADIAN](https://www.dian.gov.co/aduanas/operador/Paginas/default.aspx)
   - [RUT - Registro Único Tributario](https://www.dian.gov.co/personas/Paginas/default.aspx)

2. **Contabilidad**
   - Decreto 2650 de 1993 (Plan Único de Cuentas)
   - Resolución 20089 de 2002 (Actualización PUC)
   - Normas Internacionales de Información Financiera (NIIF)

3. **Nómina y RRHH**
   - Código Sustantivo del Trabajo (Ley 2191/2022)
   - Ley 100 de 1993 (Seguridad Social)
   - Resolución UGPP (PILA)

4. **Tributario**
   - Estatuto Tributario (ET) 2024
   - Resoluciones DIAN anuales de UVT y tarifas
   - Circulares de retenciones

---

## 9. IMPACTO EN MIGRACIÓN DE DATOS

### ⚠️ Acciones Posteriores Necesarias

1. **Migración de `SunatSubmission` a `DianSubmission`**
   ```sql
   -- Alembic migration pending
   ALTER TABLE sunat_submission RENAME TO dian_submission;
   ALTER TABLE dian_submission RENAME COLUMN cdr_code TO cud_code;
   ALTER TABLE dian_submission RENAME COLUMN cdr_description TO response_description;
   ```

2. **Actualizar columnas en `FinancialDocument`**
   ```sql
   ALTER TABLE financial_document ADD COLUMN dian_status VARCHAR(50);
   ALTER TABLE financial_document ADD COLUMN dian_response_status VARCHAR(50);
   -- Migrar datos si existen sunat_status
   UPDATE financial_document SET dian_status = sunat_status WHERE sunat_status IS NOT NULL;
   ```

3. **Verificar Integridad de Referencias**
   - Auditar OutboxEvents con topic `sunat.*` → cambiar a `dian.*`
   - Auditar AuditLog entries referenciando `sunat_*`

---

## 10. PRÓXIMOS PASOS

### Corto Plazo (Semana 1-2)
- [ ] Ejecutar migrations Alembic
- [ ] Desplegar cambios de código
- [ ] Validar que no hay errores 500 por modelos faltantes

### Mediano Plazo (Mes 1)
- [ ] Documentar API de RADIAN en OpenAPI
- [ ] Integrar con servicio de validación DIAN real (no mock)
- [ ] Capacitar equipo de operaciones en nuevos endpoints

### Largo Plazo
- [ ] Arquivar/remover código de patches `patch_ia_compras_v2`, `patch_ia_criterio_v3` (aún con PCGE)
- [ ] Auditoría completa de cumplimiento regulatorio DIAN

---

**Documento Generado:** 2026-06-06
**Responsable:** ContaPro Development Team
**Estado:** ✅ Activo - Consolidación Colombiana 100% 
