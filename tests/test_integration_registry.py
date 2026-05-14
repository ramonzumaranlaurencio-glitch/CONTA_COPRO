from src.application.services.integration_registry import IntegrationRegistry


def test_integration_registry_exposes_enterprise_targets():
    providers = {item.provider for item in IntegrationRegistry().list_connectors()}

    assert {"SUNAT", "BANKS", "GEMINI", "FEDEX", "DHL", "ODOO", "SAP", "EMAIL", "WHATSAPP", "S3"}.issubset(providers)
