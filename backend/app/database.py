from contextlib import contextmanager

from sqlalchemy import Connection, create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings

settings = get_settings()

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

_pool_args = (
    {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True}
    if not settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, connect_args=_connect_args, **_pool_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import user, listing, message, category, favorite, report, admin, category_alert, rating, blocked_email  # noqa: F401
    Base.metadata.create_all(bind=engine)


# ── Cross-worker coordination ─────────────────────────────────────────────────
# Production runs several uvicorn workers. Postgres advisory locks keep startup
# migrations from racing and make exactly one worker run the scheduler.
# SQLite (tests) has a single process, so both are no-ops there.

_STARTUP_LOCK = 72_001
_SCHEDULER_LOCK = 72_002


def _is_postgres() -> bool:
    return engine.dialect.name == "postgresql"


@contextmanager
def startup_lock():
    """Run the enclosed block in one worker at a time."""
    if not _is_postgres():
        yield
        return
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": _STARTUP_LOCK})
        try:
            yield
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _STARTUP_LOCK})


def try_scheduler_leadership() -> Connection | None:
    """Return a connection holding the scheduler lock, or None if another worker has it.

    The lock lives as long as the connection; keep it open while leading.
    """
    if not _is_postgres():
        return engine.connect()
    conn = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
    if conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": _SCHEDULER_LOCK}).scalar():
        return conn
    conn.close()
    return None
