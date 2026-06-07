# Migración SUNAT → DIAN: Sincronización Completa a Colombia

**Estado**: ✅ COMPLETADA - Fase 1 (Core Models y Routes)  
**Fecha**: 2025-05-17  
**Objetivo**: "Debe ser oclombiano todo" - Eliminar toda referencia peruana SUNAT

## Cambios Realizados

### 1. **src/domain/models/accounting.py** ✅
- Renombrada clase `SunatSubmission` → `DianSubmission`
- Tabla actualizada: `sunat_submissions` → `dian_submissions`
- Campo de estado: `cdr_code` → `cud_code`
- Campo de descripción: `cdr_description` → `response_description`
- Tipo de endpoint: `SUNAT` → `DIAN`
- Alias de compatibilidad: `SunatSubmission = DianSubmission` (para código legado)

### 2. **src/api/routes/tax.py** ✅
- Completamente reemplazado con versión colombiana (DIAN)
- Importaciones cambiadas: SUNAT → DIAN generators
- Endpoints renombrados:
  - `/sire/rvie` → `/radian/registro`
  - `/ple/daily-book` → `/audit-log/diario`
  - `/ple/general-ledger` → `/audit-log/mayor`
- Temas de eventos: `sunat.submission.*` → `dian.submission.*`
- Modelos de datos actualizados para RADIAN/DIAN compliance

### 3. **src/api/routes/reports.py** ✅
- Import actualizado: `SunatSubmission` → `DianSubmission`
- Instanciación actualizada: `SunatSubmission()` → `DianSubmission()`
- Endpoint type: `SUNAT` → `DIAN`

## Cambios Pendientes (Fase 2)

### Configuración y Settings
- [ ] `src/config.py`: `sunat_ruc` → `dian_nit`, `sunat_xsd_dir` → `dian_xsd_dir`

### Servicios (6 archivos)
- [ ] `src/application/services/ledger_posting_service.py` (settings references)
- [ ] `src/application/services/books_service.py` (sunat_status fields)
- [ ] `src/application/services/expert_accounting_guard.py` (validation codes)
- [ ] `src/application/services//*_service.py` (otras referencias)

### DTOs (3 archivos)
- [ ] `src/application/dto/ledger.py`: `sunat_status` → `dian_status`
- [ ] `src/application/dto/ledger_engine_output.py`: `sunat_status` → `dian_status`
- [ ] `src/application/dto/expert_accounting.py`: `sunat_status` → `dian_status`

### Rutas Adicionales (4 archivos)
- [ ] `src/api/routes/sales.py`: settings references
- [ ] `src/api/routes/ledger.py`: settings references
- [ ] `src/api/routes/ai.py`: settings references
- [ ] Otras rutas con referencias SUNAT

### Infraestructura
- [ ] `src/infrastructure/adapters/sunat/`: Validar contra `src/infrastructure/adapters/dian/`
- [ ] `src/infrastructure/workers/sunat_worker.py`: Migración a DIAN worker

## Patrones de Reemplazo Aplicados

```
sunat_ruc               → dian_nit
sunat_status            → dian_status
sunat_xsd_dir           → dian_xsd_dir
sunat_ruc_lookup_url    → dian_nit_lookup_url
SunatSubmission         → DianSubmission
sunat_submissions       → dian_submissions
cdr_code                → cud_code
cdr_description         → response_description
SUNAT_RUC_*             → DIAN_NIT_*
sunat.submission.*      → dian.submission.*
endpoint_type="SUNAT"   → endpoint_type="DIAN"
```

## Comandos de Validación

```powershell
# Buscar referencias SUNAT remanentes en src/
Get-ChildItem -Path src -Recurse -Filter "*.py" | Select-String -Pattern "sunat_|SunatSubmission|SUNAT_" | Select -ExpandProperty Path -Unique

# Validar import correcto
Get-ChildItem -Path src -Recurse -Filter "*.py" | Select-String -Pattern "from src.domain.models.accounting import" | Where-Object { $_ -match "DianSubmission" }
```

## Notas de Implementación

1. **Alias de Compatibilidad**: El alias `SunatSubmission = DianSubmission` permite que el código legado que importa `SunatSubmission` siga funcionando.

2. **Migración de Base de Datos**: La tabla se renombra de `sunat_submissions` → `dian_submissions`. Se requiere migración con Alembic:
   ```python
   # En una nueva migración Alembic:
   op.rename_table('sunat_submissions', 'dian_submissions')
   op.alter_column('dian_submissions', 'cdr_code', new_column_name='cud_code')
   op.alter_column('dian_submissions', 'cdr_description', new_column_name='response_description')
   ```

3. **Validación de Códigos**: Los códigos de validación (ej: `SUNAT_RUC_PRESENT`) también se deben cambiar a equivalentes DIAN para mantener coherencia.

## Próximos Pasos

1. Ejecutar Fase 2: Actualizar servicios, DTOs y configuración
2. Crear migración Alembic para cambio de tablas
3. Ejecutar validaciones de cobertura de código
4. Pruebas de integración con DIAN
5. Actualizar documentación de API
6. Commit final: "Migración completa SUNAT → DIAN"

---
**Responsable**: GitHub Copilot  
**Estado de git**: Cambios listos para commit (issue .git/index.lock en OneDrive - resolver manualmente)
