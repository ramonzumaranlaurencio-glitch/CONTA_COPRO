# ============================================================
#  CONTA_PRO Enterprise — Dockerfile (Railway / Production)
# ============================================================
FROM python:3.11-slim

# Sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev libssl-dev libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Instalar dependencias Python primero (capa cacheada)
COPY pyproject.toml README_MASTER.md ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copiar código fuente (sin archivos sensibles — ver .dockerignore)
COPY . .

# Puerto configurable por Railway ($PORT)
EXPOSE 8000

# Correr migraciones y luego levantar el servidor
CMD alembic upgrade head; uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --log-level info
