from src.infrastructure.adapters.sunat.ple_generator import LibroDiarioGenerator


class InvoiceGenerator:
    """DIAN-facing wrapper for audit-log generators.

    The legacy SUNAT PLE generator is reused for book generation, but
    the public interface is preserved for DIAN-specific routes.
    """

    def __init__(self, xsd_dir: str | None = None):
        self._generator = LibroDiarioGenerator()

    def generate_audit_log_diario(self, company_nit: str, period: str, operations: list[dict]) -> bytes:
        return self._generator.generate_daily_book(company_nit, period, operations)

    def generate_audit_log_mayor(self, company_nit: str, period: str, operations: list[dict]) -> bytes:
        return self._generator.generate_general_ledger(company_nit, period, operations)
