# =============================================================================
#  src/config/plan_features.py
#  Archivo NUEVO — crear en src/config/plan_features.py
#
#  Fuente única de verdad para los permisos por plan.
#  Todos los endpoints lo importan. No tocar lógica de módulos existentes.
# =============================================================================

from fastapi import HTTPException

PLAN_FEATURES: dict[str, dict[str, bool]] = {
    "BASIC": {
        "accounting":   True,
        "sales":        True,
        "purchases":    True,
        "reports":      True,
        "dashboard":    True,
        "inventory":    False,
        "payroll":      False,
        "ocr":          False,
        "ai":           False,
        "tool_tokens":  False,
        "advanced_bi":  False,
        "dian":         False,
        "audit":        False,
        "integrations": False,
    },
    "PLUS": {
        "accounting":   True,
        "sales":        True,
        "purchases":    True,
        "reports":      True,
        "dashboard":    True,
        "inventory":    True,
        "payroll":      True,
        "ocr":          True,
        "ai":           True,
        "tool_tokens":  False,
        "advanced_bi":  True,
        "dian":         False,
        "audit":        False,
        "integrations": False,
    },
    "PREMIUM": {
        "accounting":   True,
        "sales":        True,
        "purchases":    True,
        "reports":      True,
        "dashboard":    True,
        "inventory":    True,
        "payroll":      True,
        "ocr":          True,
        "ai":           True,
        "tool_tokens":  True,
        "advanced_bi":  True,
        "dian":         True,
        "audit":        True,
        "integrations": True,
    },
}


def require_feature(ctx: dict, feature: str) -> None:
    """
    Llama esto al inicio de cualquier endpoint protegido.

    Uso:
        @router.get("/products")
        async def list_products(ctx=Depends(get_current_context)):
            require_feature(ctx, "inventory")
            ...

    Si el plan del tenant no incluye la feature, lanza HTTP 403.
    """
    plan = ctx.get("plan", "BASIC")
    allowed = PLAN_FEATURES.get(plan, {}).get(feature, False)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Esta función requiere un plan superior. "
                f"Plan actual: {plan}. "
                f"Feature requerida: {feature}."
            ),
        )


def get_plan_features(plan: str) -> dict[str, bool]:
    """Devuelve el dict de features para un plan dado."""
    return PLAN_FEATURES.get(plan, PLAN_FEATURES["BASIC"])
