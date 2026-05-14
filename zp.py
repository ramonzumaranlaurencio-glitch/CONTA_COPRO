#!/usr/bin/env python3
from pathlib import Path
import argparse, shutil

ROOT = Path(__file__).resolve().parent
INCLUDE = [
    "src", "sql", "alembic", "tests", "k8s", "scripts", "config", "terraform", "frontend", "grafana", "docs",
    "pyproject.toml", "alembic.ini", "Dockerfile", "docker-compose.yml",
    "package.json", "tsconfig.json", "vite.config.ts", "index.html", "openapi.json", "uv.lock",
    "otel-collector.yml", "prometheus.yml", ".env.example", "README_MASTER.md"
]

def copy_item(src: Path, dst: Path, force: bool):
    if src.is_dir():
        for f in src.rglob("*"):
            if f.is_file() and "__pycache__" not in f.parts:
                rel = f.relative_to(src)
                out = dst / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                if out.exists() and not force:
                    print(f"SKIP {out}")
                    continue
                shutil.copy2(f, out)
                print(f"COPY {out}")
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists() and not force:
            print(f"SKIP {dst}")
            return
        shutil.copy2(src, dst)
        print(f"COPY {dst}")

def main():
    parser = argparse.ArgumentParser(description="Aplicar CONTA_PRO Enterprise Master al programa existente")
    parser.add_argument("--target", required=True, help="Ruta del proyecto CONTA_PRO")
    parser.add_argument("--no-force", action="store_true")
    args = parser.parse_args()
    target = Path(args.target).resolve()
    for name in INCLUDE:
        src = ROOT / name
        if src.exists():
            copy_item(src, target / name, force=not args.no_force)
    print("\nOK: overlay master aplicado. Ejecuta alembic upgrade head y revisa .env.")

if __name__ == "__main__":
    main()
