from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.main import create_app


def main():
    app = create_app()
    target = Path("openapi.json")
    target.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {target.resolve()}")


if __name__ == "__main__":
    main()
