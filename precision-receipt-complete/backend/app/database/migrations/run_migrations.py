#!/usr/bin/env python
"""
Database Migration Runner
Applies SQL migrations to add new columns to existing tables
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy import text
from app.core.database import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration(migration_file: str):
    """Run a single SQL migration file"""
    migrations_dir = Path(__file__).parent
    sql_file = migrations_dir / migration_file

    if not sql_file.exists():
        logger.error(f"Migration file not found: {sql_file}")
        return False

    logger.info(f"Running migration: {migration_file}")

    with open(sql_file, 'r') as f:
        sql_content = f.read()

    # Split by semicolon and execute each statement
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]

    with engine.connect() as conn:
        for statement in statements:
            if statement:
                try:
                    conn.execute(text(statement))
                    logger.info(f"Executed: {statement[:60]}...")
                except Exception as e:
                    logger.warning(f"Statement may have already been applied: {e}")
        conn.commit()

    logger.info(f"Migration completed: {migration_file}")
    return True


def run_all_migrations():
    """Run all pending migrations"""
    migrations = [
        'add_receipt_signature_columns.sql',
    ]

    for migration in migrations:
        run_migration(migration)


if __name__ == "__main__":
    logger.info("Starting database migrations...")
    run_all_migrations()
    logger.info("All migrations completed")
