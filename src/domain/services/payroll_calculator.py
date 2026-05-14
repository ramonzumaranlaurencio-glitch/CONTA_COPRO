from __future__ import annotations

from decimal import Decimal


class PayrollCalculator:
    """Calculadora de remuneraciones bajo legislacion peruana (D.L. 728)."""

    def calculate_liquid(self, salary: Decimal, afp_rate: Decimal, has_asig_fam: bool):
        rmv = Decimal("1025.00")
        asig_fam = (rmv * Decimal("0.10")) if has_asig_fam else Decimal("0.00")

        rem_bruta = salary + asig_fam

        afp_total = rem_bruta * afp_rate
        quinta_categoria = self._calculate_5ta(rem_bruta)

        rem_neta = rem_bruta - afp_total - quinta_categoria

        essalud = rem_bruta * Decimal("0.09")

        return {
            "bruta": rem_bruta,
            "neta": rem_neta,
            "essalud": essalud,
            "afp": afp_total,
        }

    @staticmethod
    def _calculate_5ta(rem_bruta: Decimal) -> Decimal:
        tramo = Decimal("0.08")
        return (rem_bruta * tramo).quantize(Decimal("0.01"))
