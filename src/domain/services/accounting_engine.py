class AccountingEngine:
    def __init__(self, ledger_posting_service):
        self.ledger_posting_service = ledger_posting_service

    async def create_invoice_entry(self, invoice_data: dict):
        return await self.ledger_posting_service.post_invoice(invoice_data)
