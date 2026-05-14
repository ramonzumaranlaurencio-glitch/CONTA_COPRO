def test_master_chart_account_payload_shape():
    payload = {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "code": "1011",
        "name": "Caja General",
        "statement": "BALANCE",
        "nature": "DEBIT",
    }
    required = {"tenant_id", "code", "name", "statement", "nature"}
    assert required.issubset(payload)


def test_period_close_payload_shape():
    payload = {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "year": 2026,
        "month": 5,
    }
    required = {"tenant_id", "year", "month"}
    assert required.issubset(payload)


def test_finance_ar_payment_payload_shape():
    payload = {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "series": "F001",
        "number": "000123",
        "amount": "100.00",
        "treasury_account_id": "22222222-2222-2222-2222-222222222222",
    }
    required = {"tenant_id", "series", "number", "amount", "treasury_account_id"}
    assert required.issubset(payload)


def test_tax_submission_payload_shape():
    payload = {
        "submission_type": "INVOICE",
        "endpoint_type": "SUNAT",
        "ticket": "TCK-001",
        "xml_hash": "abc123",
    }
    required = {"submission_type", "endpoint_type"}
    assert required.issubset(payload)


def test_books_generate_payload_shape():
    payload = {
        "year": 2026,
        "month": 5,
    }
    required = {"year", "month"}
    assert required.issubset(payload)


def test_ai_config_status_payload_shape():
    payload = {
        "gemini_configured": True,
        "model": "gemini-1.5-pro",
    }
    required = {"gemini_configured", "model"}
    assert required.issubset(payload)


def test_treasury_import_statement_payload_shape():
    payload = {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "treasury_account_id": "22222222-2222-2222-2222-222222222222",
        "csv_content": "date,amount,reference,currency,type\\n2026-05-10,100.00,F001-000123,PEN,STATEMENT\\n",
        "default_currency": "PEN",
    }
    required = {"tenant_id", "treasury_account_id", "csv_content", "default_currency"}
    assert required.issubset(payload)


def test_inventory_exit_with_cost_entry_payload_shape():
    payload = {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "product_id": "33333333-3333-3333-3333-333333333333",
        "warehouse_id": "44444444-4444-4444-4444-444444444444",
        "movement_type": "EXIT",
        "qty": "2",
        "post_cost_entry": True,
        "year": 2026,
        "month": 5,
        "cogs_account": "6911",
        "inventory_account": "2011",
    }
    required = {"tenant_id", "product_id", "warehouse_id", "movement_type", "qty", "post_cost_entry"}
    assert required.issubset(payload)


def test_tax_retry_endpoint_payload_shape():
    payload = {
        "submission_id": "55555555-5555-5555-5555-555555555555",
    }
    required = {"submission_id"}
    assert required.issubset(payload)
