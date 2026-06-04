from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict

# ─── PARÁMETROS LEGALES COLOMBIA 2026 ────────────────────────────────────────
SMMLV = Decimal("1_520_000")        # Estimado — actualizar con decreto enero 2026
AUX_TRANSPORTE = Decimal("212_000") # Estimado 2026 (2025: $200.000)
UVT = Decimal("47_065")             # UVT 2026 DIAN

# Tasas seguridad social (Ley 100/1993)
AFP_EMPLEADO   = Decimal("0.04")    # Art. 20: 4%
AFP_EMPLEADOR  = Decimal("0.12")    # Art. 20: 12%
EPS_EMPLEADO   = Decimal("0.04")    # Art. 204: 4%
EPS_EMPLEADOR  = Decimal("0.085")   # Art. 204: 8.5%

# Parafiscales (Ley 21/1982)
CCF_EMPLEADOR  = Decimal("0.04")    # 4%
SENA_EMPLEADOR = Decimal("0.02")    # 2% (exonerado si < 10 SMMLV — Ley 1607/2012 Art. 65)
ICBF_EMPLEADOR = Decimal("0.03")    # 3% (ídem)
LIMITE_EXONERACION = 10             # < 10 SMMLV = exonerado SENA+ICBF+EPS empleador

# ARL por clase de riesgo (Decreto 1607/2002)
ARL_CLASES: Dict[str, Decimal] = {
    "I":   Decimal("0.00348"),  # Oficinas, comercio, servicios
    "II":  Decimal("0.00435"),  # Manufactura leve
    "III": Decimal("0.00783"),  # Transporte, construcción leve
    "IV":  Decimal("0.01044"),  # Construcción, agricultura
    "V":   Decimal("0.08700"),  # Minería, explosivos
}

# Prestaciones sociales (CST)
TASA_CESANTIAS     = Decimal("1") / Decimal("12")      # 8.33% — Art. 249 CST
TASA_INT_CESANTIAS = Decimal("0.12") / Decimal("12")   # 1% mensual — Art. 99 Ley 50/1990
TASA_PRIMA         = Decimal("1") / Decimal("12")       # 8.33% — Art. 306 CST
TASA_VACACIONES    = Decimal("15") / Decimal("360")     # 4.17% — Art. 186 CST


def _round(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), ROUND_HALF_UP)


class ColombianPayrollCalculator:
    """Calculadora de nómina — Colombia.

    Normas: CST · Ley 100/1993 · Ley 21/1982 · Ley 1607/2012 · Decreto 1072/2015
    SMMLV 2026: $1.520.000 (estimado). UVT 2026: $47.065.
    """

    def calcular_retefuente(self, devengado_mensual: Decimal) -> Decimal:
        """ReteFuente rentas laborales Art. 383 ET — Procedimiento 1."""
        renta_exenta = min(devengado_mensual * Decimal("0.25"), 240 * UVT)
        ded_dep = min(devengado_mensual * Decimal("0.10"), 32 * UVT)
        ing_gravable = max(devengado_mensual - renta_exenta - ded_dep, Decimal("0"))
        ing_uvt = ing_gravable / UVT

        rangos = [
            (Decimal("95"),   Decimal("0"),    Decimal("0")),
            (Decimal("150"),  Decimal("0.19"), Decimal("18.05")),
            (Decimal("360"),  Decimal("0.28"), Decimal("31.55")),
            (Decimal("640"),  Decimal("0.33"), Decimal("49.55")),
            (Decimal("945"),  Decimal("0.35"), Decimal("62.35")),
            (Decimal("2300"), Decimal("0.37"), Decimal("81.26")),
            (None,            Decimal("0.39"), Decimal("127.26")),
        ]

        prev_hasta = Decimal("0")
        for hasta, tarifa, descuento in rangos:
            if hasta is None or ing_uvt <= hasta:
                if tarifa == 0:
                    return Decimal("0")
                retef = (ing_uvt * tarifa - descuento) * UVT
                return max(_round(retef), Decimal("0"))
            prev_hasta = hasta

        return Decimal("0")

    def calcular_fondo_solidaridad(self, base_ss: Decimal, dias: int = 30) -> Decimal:
        """Fondo Solidaridad Pensional (Art. 27 Ley 100/1993)."""
        if base_ss < SMMLV * 4:
            return Decimal("0")
        tasa = Decimal("0.01")
        if base_ss >= SMMLV * 16:
            tasa += Decimal("0.005")
        if base_ss >= SMMLV * 17:
            tasa += Decimal("0.010")
        if base_ss >= SMMLV * 18:
            tasa += Decimal("0.012")
        if base_ss >= SMMLV * 19:
            tasa += Decimal("0.014")
        if base_ss >= SMMLV * 20:
            tasa += Decimal("0.016")
        return _round(base_ss * tasa * Decimal(dias) / 30)

    def liquidar(self, worker: Any, dias_trabajados: int = 30) -> Dict[str, Any]:
        """Liquidación mensual completa de nómina colombiana."""
        salario = Decimal(str(worker.sueldo_pactado or 0))
        tipo_salario = getattr(worker, "tipo_salario", "ORDINARIO") or "ORDINARIO"
        clase_arl = str(getattr(worker, "clase_riesgo_arl", "I") or "I").upper()
        es_integral = tipo_salario.upper() == "INTEGRAL"
        dias = Decimal(str(dias_trabajados))

        # Salario integral: base SS = 70% (Art. 132 CST)
        base_ss = salario * Decimal("0.70") if es_integral else salario

        # Salario proporcional a días trabajados
        salario_prop = _round(salario * dias / 30)

        # Auxilio de transporte (solo ordinario ≤ 2 SMMLV, proporcional)
        aplica_aux = not es_integral and salario <= SMMLV * 2
        aux_transporte = _round(AUX_TRANSPORTE * dias / 30) if aplica_aux else Decimal("0")

        total_devengado = salario_prop + aux_transporte

        # ── Deducciones empleado ─────────────────────────────────────────
        afp_emp = _round(base_ss * AFP_EMPLEADO * dias / 30)
        eps_emp = _round(base_ss * EPS_EMPLEADO * dias / 30)
        fondo_sol = self.calcular_fondo_solidaridad(base_ss, dias_trabajados)
        retefuente = self.calcular_retefuente(total_devengado)
        total_descuentos = afp_emp + eps_emp + fondo_sol + retefuente
        neto_pagar = total_devengado - total_descuentos

        # ── Aportes empleador ────────────────────────────────────────────
        exonerado = base_ss < SMMLV * LIMITE_EXONERACION
        afp_empr = _round(base_ss * AFP_EMPLEADOR * dias / 30)
        eps_empr = Decimal("0") if exonerado else _round(base_ss * EPS_EMPLEADOR * dias / 30)
        tasa_arl = ARL_CLASES.get(clase_arl, ARL_CLASES["I"])
        arl = _round(base_ss * tasa_arl * dias / 30)
        ccf = _round(salario_prop * CCF_EMPLEADOR)
        sena = Decimal("0") if exonerado else _round(salario_prop * SENA_EMPLEADOR)
        icbf = Decimal("0") if exonerado else _round(salario_prop * ICBF_EMPLEADOR)
        total_empr = afp_empr + eps_empr + arl + ccf + sena + icbf

        # ── Provisiones mensuales ────────────────────────────────────────
        base_prov = salario_prop + aux_transporte
        prov_ces = _round(base_prov * TASA_CESANTIAS)
        prov_int = _round(prov_ces * TASA_INT_CESANTIAS)
        prov_prima = _round(base_prov * TASA_PRIMA)
        prov_vac = _round(salario_prop * TASA_VACACIONES)
        total_prov = prov_ces + prov_int + prov_prima + prov_vac

        return {
            "comprobante": {
                "salario_basico": salario,
                "salario_proporcional": salario_prop,
                "auxilio_transporte": aux_transporte,
                "total_devengado": total_devengado,
                "afp_empleado": afp_emp,
                "eps_empleado": eps_emp,
                "fondo_solidaridad": fondo_sol,
                "retefuente": retefuente,
                "total_descuentos": total_descuentos,
                "neto_pagar": neto_pagar,
                "aplica_auxilio_transporte": aplica_aux,
                "exonerado_sena_icbf": exonerado,
                "dias_trabajados": dias_trabajados,
                "tipo_salario": tipo_salario,
            },
            "aportes_empleador": {
                "afp_empleador": afp_empr,
                "eps_empleador": eps_empr,
                "arl": arl,
                "ccf": ccf,
                "sena": sena,
                "icbf": icbf,
                "total": total_empr,
            },
            "provisiones": {
                "cesantias": prov_ces,
                "int_cesantias": prov_int,
                "prima": prov_prima,
                "vacaciones": prov_vac,
                "total": total_prov,
            },
            "costo_total_empleador": total_devengado + total_empr + total_prov,
            "base_seguridad_social": base_ss,
        }
