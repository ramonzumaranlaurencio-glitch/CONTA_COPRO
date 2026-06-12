from src.ai.expert_system_prompt import INTELLIGENCE_UNITS, SYSTEM_ROLE_PROMPT


class AuditCopilot:
    def __init__(self, ledger_reader, vector_store, gemini_client):
        self.ledger_reader = ledger_reader
        self.vector_store = vector_store
        self.gemini = gemini_client
        self.system_prompt = SYSTEM_ROLE_PROMPT
        self.intelligence_units = [
            {
                "name": unit.name,
                "function": unit.primary_function,
                "support_docs": unit.support_docs,
            }
            for unit in INTELLIGENCE_UNITS
        ]

    async def perform_pre_closure_audit(self, tenant_id: str, month: int, year: int):
        context = await self.vector_store.get_context(tenant_id=tenant_id, query="cierres anomalias IVA duplicidad CUFE DIAN")
        summary = await self.ledger_reader.get_month_summary(tenant_id, month, year)
        prompt = {
            "system_prompt": self.system_prompt,
            "role": "Auditor Senior DIAN/NIIF Colombia",
            "tasks": [
                "Detectar duplicidad por NIT, prefijo, consecutivo y monto",
                "Evaluar IVA descontable contra ventas y compras (cuenta 2408)",
                "Detectar gastos sin CUFE/PDF mayores a $1.000.000 COP sin bancarizacion",
                "Detectar asientos atipicos en cuentas 513, 519, 529, 240",
            ],
            "rules": ["NIIF Pymes Colombia", "DIAN", "PUC", "Estatuto Tributario", "Medios Magneticos"],
            "intelligence_units": self.intelligence_units,
            "summary": summary,
            "historical_context": context,
        }
        return await self.gemini.analyze(prompt)

    async def diagnose_sunat_failure(self, payload: dict, error: str):
        invoice = payload.get("invoice", {})
        return {
            "classification": "XML_SCHEMA_OR_DIAN_SERVICE_FAILURE",
            "error": error,
            "checklist": ["XSD UBL 2.1 DIAN", "firma P12 certificado digital", "NIT", "prefijo/consecutivo", "tipo documento", "disponibilidad DIAN"],
            "invoice": {
                "nit": invoice.get("customer_nit"),
                "serie": invoice.get("serie"),
                "number": invoice.get("number"),
                "total": str(invoice.get("total")),
            },
        }

    async def detect_anomalies(self, tenant_id: str, year: int, month: int | None = None):
        query = "anomalias contables fraude duplicidad diferencias cambio provisiones cierre"
        context = await self.vector_store.get_context(tenant_id=tenant_id, query=query)
        summary = await self.ledger_reader.get_month_summary(tenant_id, month, year)
        prompt = {
            "system_prompt": self.system_prompt,
            "role": "Controller financiero enterprise",
            "tasks": [
                "Identificar asientos fuera de patron historico",
                "Detectar facturas duplicadas por NIT serie numero monto",
                "Resaltar cuentas con saldos contrarios a su naturaleza",
                "Priorizar hallazgos por impacto material y trazabilidad",
            ],
            "intelligence_units": self.intelligence_units,
            "summary": summary,
            "context": context,
        }
        return await self.gemini.analyze(prompt)

    async def answer_contextual_question(self, tenant_id: str, question: str):
        context = await self.vector_store.get_context(tenant_id=tenant_id, query=question)
        prompt = {
            "role": "Copiloto contextual CONTA_PRO",
            "question": question,
            "context": context,
            "guardrails": ["No inventar documentos", "Citar IDs o hashes disponibles", "Separar hechos de inferencias"],
        }
        return await self.gemini.analyze(prompt)
