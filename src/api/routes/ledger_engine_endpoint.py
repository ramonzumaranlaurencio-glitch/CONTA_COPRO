"""
The Ledger Engine - API Endpoint
POST /api/v1/ledger/engine - Flujo integrado de validación antes de persistir
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from src.api.dependencies import get_current_context
from src.application.dto.ledger_engine_output import LedgerEngineOutput
from src.application.services.ledger_engine_orchestrator import (
    LedgerEngineOrchestrator,
)
from src.application.services.ledger_command_registry import ModuleCommand
from src.domain.exceptions import ExpertValidationException

router = APIRouter(prefix="/ledger", tags=["Ledger Engine"])


class LedgerEngineRequest(BaseModel):
    """Solicitud al Ledger Engine"""
    module_command: str = Field(
        ...,
        description="Módulo: ingreso_gasto, tramite_bancario, documento_legal, anticipo, etc",
    )
    transaction_type: str = Field(..., description="Tipo: FACTURA, RECIBO, TRANSFERENCIA, etc")
    amount: Decimal = Field(..., gt=0, description="Monto de la transacción")
    currency: str = Field(default="PEN", description="PEN o USD")
    igv_included: bool = Field(default=True, description="Si el monto incluye IGV")
    cost_center: str | None = Field(None, description="Centro de costo")
    supplier_ruc: str | None = Field(None, description="RUC del proveedor (para compras)")
    customer_ruc: str | None = Field(None, description="RUC del cliente (para ventas)")
    payment_method: str | None = Field(None, description="TRANSFERENCIA, CHEQUE, EFECTIVO, etc")
    service_code: str | None = Field(None, description="Código de servicio para detracciones")
    doc_type_code: str | None = Field(None, description="01=Factura, 03=Boleta, 07=NC, 08=ND")
    due_date: str | None = Field(None, description="Fecha de vencimiento (YYYY-MM-DD)")
    reference_id: str | None = Field(None, description="ID de referencia (factura anterior, etc)")


@router.post("/engine", response_model=dict)
async def process_ledger_engine(
    request_body: LedgerEngineRequest,
    http_request: Request,
    ctx=Depends(get_current_context),
) -> dict:
    """
    The Ledger Engine: Procesamiento integrado de validación legal y contable.
    
    Flujo:
    1. Unit A (Clasificación): Genera asientos contables según PCGE
    2. Unit B (Cumplimiento): Valida contra SUNAT, Código Tributario, D. Leg. 728
    3. JSON Output: Retorna asientos, compliance checks y acciones requeridas
    4. Bloqueo: Si hay incumplimiento, lanza excepción (safe-by-default)
    
    Respuesta (200 OK):
    {
        "header": {...},
        "accounting_logic": {...},
        "compliance_check": {...},
        "action_required": {...},
        "bloquea_persistencia": false,
        "razon_bloqueo": null
    }
    
    Respuesta (422 Unprocessable Entity):
    Si hay bloqueo en validación, retorna error con motivo.
    """
    try:
        module_cmd = ModuleCommand(request_body.module_command)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Módulo inválido: {request_body.module_command}. "
                   f"Válidos: ingreso_gasto, tramite_bancario, documento_legal, anticipo, devolucion, retencion, ajuste_cierre",
        ) from None

    orchestrator = LedgerEngineOrchestrator()

    try:
        output: LedgerEngineOutput = orchestrator.validate_and_get_output(
            module_command=module_cmd,
            transaction_type=request_body.transaction_type,
            amount=request_body.amount,
            currency=request_body.currency,
            igv_included=request_body.igv_included,
            cost_center=request_body.cost_center,
            supplier_ruc=request_body.supplier_ruc,
            customer_ruc=request_body.customer_ruc,
            payment_method=request_body.payment_method,
            service_code=request_body.service_code,
            doc_type_code=request_body.doc_type_code,
            due_date=request_body.due_date,
            reference_id=request_body.reference_id,
        )

        # Si llegó aquí sin excepción, output es válido
        return {
            "status": "OK",
            "bloquea_persistencia": output.bloquea_persistencia,
            "operacion_id": output.header.operacion_id,
            "accounting_logic": output.accounting_logic.model_dump(),
            "compliance_check": output.compliance_check.model_dump(),
            "action_required": output.action_required.model_dump(),
            "header": output.header.model_dump(),
        }

    except ExpertValidationException as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(exc),
                "checks": exc.checks,
                "bloqueante": True,
            },
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"Error en conversión de datos: {str(exc)}",
                "bloqueante": False,
            },
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Error interno en Ledger Engine: {str(exc)}",
                "bloqueante": False,
            },
        ) from exc
