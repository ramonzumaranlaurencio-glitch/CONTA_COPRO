import asyncio
import sys
import os

# Esto permite que el script encuentre la carpeta 'src'
sys.path.append(os.getcwd())

from src.infrastructure.db.base import Base
from src.infrastructure.db.session import engine

async def setup():
    print(">>> Conectando a PostgreSQL en Trujillo...")
    try:
        async with engine.begin() as conn:
            # Esta es la línea que DEBE ejecutarse (no ser un comentario)
            await conn.run_sync(Base.metadata.create_all)
        print(">>> ¡Tablas creadas con éxito!")
    except Exception as e:
        print(f">>> ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(setup())