from decimal import Decimal
from types import SimpleNamespace

from src.application.services.treasury_service import TreasuryService


def test_tax_alerts_detect_retencion_and_detraccion():
    document = SimpleNamespace(
        detraccion_amount=Decimal("12.00"),
        retencion_amount=Decimal("8.00"),
        metadata_json={},
    )

    alerts = TreasuryService.tax_alerts_for_document(document)

    assert any("detraccion" in alert for alert in alerts)
    assert any("retencion" in alert for alert in alerts)
