from src.application.services.tax_compliance_service import TaxComplianceService


def test_ubl_invoice_builder_returns_digest_and_xml():
    service = TaxComplianceService()
    result = service.build_invoice_xml({
        "serie": "F001",
        "number": "1",
        "entry_date": "2026-05-10",
        "doc_type": "01",
        "currency": "PEN",
        "subtotal": "100.00",
        "igv": "18.00",
        "total": "118.00",
        "customer_ruc": "20555555555",
    })

    assert result["digest"]
    assert "Invoice" in result["xml"]
    assert result["validation"]["document_type"] == "01"


def test_cdr_parser_handles_plain_xml():
    service = TaxComplianceService()
    result = service.parse_cdr("<ApplicationResponse><ResponseCode>0</ResponseCode><Description>Aceptado</Description></ApplicationResponse>")

    assert result["status"] == "ACCEPTED"
    assert result["code"] == "0"
