import os
from logging.config import fileConfig

from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy import pool

from alembic import context

from app.database import Base

# Import models so SQLAlchemy registers all tables
from app import models


# Load .env
load_dotenv()


DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)


# Alembic configuration
config = context.config


# Configure logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Tell Alembic about our SQLAlchemy models
target_metadata = Base.metadata


def run_migrations_offline():
    """
    Run migrations without a live database connection.
    """

    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named"
        },
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """
    Run migrations using a live database connection.
    """

    connectable = create_engine(
        DATABASE_URL,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():

    run_migrations_offline()

else:

    run_migrations_online()
    