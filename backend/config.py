"""
Configuration - reads settings from environment variables or .env file.

This file loads database URL, secret key, and media folder path. Create a .env
file in the backend folder with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, etc.
"""
import os
from dotenv import load_dotenv

load_dotenv()

def get_media_folder() -> str:
    """
    Return the folder where uploaded files (profile photos, documents) are stored.

    Uses MEDIA_FOLDER env var if set, otherwise defaults to frontend/src/media
    so the Angular app can serve them as static assets.
    """
    path = os.environ.get("MEDIA_FOLDER")
    if path and os.path.isdir(path):
        return os.path.abspath(path)
    # Anchor from this file: backend/config.py -> backend/ -> project root
    backend_root = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(backend_root)
    default = os.path.join(project_root, "frontend", "src", "media")
    return default


def get_db_url() -> str:
    """
    Build the MySQL connection URL from environment variables.

    Required in .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.
    Optional: DB_PORT (default 3306).
    """
    db_host = os.environ.get("DB_HOST", "localhost")
    db_user = os.environ.get("DB_USER", "root")
    db_password = os.environ.get("DB_PASSWORD", "")
    db_name = os.environ.get("DB_NAME", "csr_db")
    db_port = os.environ.get("DB_PORT", "3306")
    return f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"


class Config:
    """Flask app configuration - used by app.config.from_object(Config)."""
    # Secret key for signing sessions/tokens - must be changed in production
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me")
    # Database connection string (MySQL)
    SQLALCHEMY_DATABASE_URI = get_db_url()
    # Disable SQLAlchemy change tracking (not needed, saves memory)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
