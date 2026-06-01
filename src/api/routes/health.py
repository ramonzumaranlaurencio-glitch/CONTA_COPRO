from fastapi import APIRouter, Response
router = APIRouter(tags=["Health"])

@router.get("/health")
@router.get("/salud")
async def health():
    return {"status": "ok", "service": "CONTA_PRO Enterprise"}

@router.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@router.get("/metrics")
async def metrics():
    body = "\n".join([
        "# HELP contapro_up CONTA_PRO API availability",
        "# TYPE contapro_up gauge",
        "contapro_up 1",
        "# HELP contapro_enterprise_build Enterprise foundation build marker",
        "# TYPE contapro_enterprise_build gauge",
        "contapro_enterprise_build 1",
    ]) + "\n"
    return Response(content=body, media_type="text/plain; version=0.0.4")
