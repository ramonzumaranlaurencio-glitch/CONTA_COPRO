def test_contract_payload_shape():
    payload = {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "year": 2026,
        "month": 5,
        "invoice_id": "inv-001",
        "serie": "F001",
        "number": "1",
        "subtotal": "100.00",
        "igv": "18.00",
        "total": "118.00",
        "user_id": "22222222-2222-2222-2222-222222222222",
        "trace_id": "trace-001"
    }
    required = {"tenant_id", "year", "month", "subtotal", "igv", "total", "user_id", "trace_id"}
    assert required.issubset(payload)
