import faulthandler
import importlib
import sys

modules = [
    "fastapi",
    "opentelemetry.instrumentation.fastapi",
    "src.config",
    "src.api.routes.auth",
    "src.api.routes.health",
    "src.ai.expert_system_prompt",
    "src.ai.reasoning_engine",
    "src.ai.vector_store",
    "src.infrastructure.db.session",
    "src.api.routes.ai",
    "src.api.routes.ledger",
    "src.main",
]

faulthandler.enable()
faulthandler.dump_traceback_later(12, repeat=True)

for mod in modules:
    print(f"IMPORTING {mod}", flush=True)
    importlib.import_module(mod)
    print(f"OK {mod}", flush=True)

print("ALL_OK", flush=True)
