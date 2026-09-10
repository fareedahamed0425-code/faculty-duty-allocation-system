from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# pool_pre_ping=True makes SQLAlchemy test every connection before use.
# If PostgreSQL closed it (idle timeout, restart, etc.) it discards the stale
# connection and checks out a fresh one — preventing "server closed the
# connection unexpectedly" errors from ever reaching the API layer.
_is_sqlite = "sqlite" in settings.DATABASE_URL

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,           # auto-reconnect on stale connections
    pool_recycle=1800,            # recycle connections every 30 min
    pool_size=10,                 # keep up to 10 connections in pool
    max_overflow=20,              # allow 20 extra connections under load
    echo=False
) if not _is_sqlite else create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
