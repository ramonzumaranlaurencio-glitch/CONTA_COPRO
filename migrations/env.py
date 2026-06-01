from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy import engine_from_config
from alembic import context
from src.config import settings
from src.domain.models.accounting import Base

config = context.config
# Alembic runs better with a synchronous driver for raw SQL migration files.
migration_url = settings.database_url.replace("+asyncpg", "+psycopg")
config.set_main_option("sqlalchemy.url", migration_url)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=migration_url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        do_run_migrations(connection)

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
