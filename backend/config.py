"""
Configuration from environment variables.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Media folder: where uploaded files (profile photos, documents) are stored.
# Default: project_root/frontend/src/media (same as Angular assets).
# Override with MEDIA_FOLDER env var if your files live elsewhere (e.g. backend/frontend/src/media).
def get_media_folder() -> str:
    path = os.environ.get("MEDIA_FOLDER")
    if path and os.path.isdir(path):
        return os.path.abspath(path)
    # Anchor from this file: backend/config.py -> backend/ -> project root
    backend_root = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(backend_root)
    default = os.path.join(project_root, "frontend", "src", "media")
    return default


def get_db_url() -> str:
    db_host = os.environ.get("DB_HOST", "localhost")
    db_user = os.environ.get("DB_USER", "root")
    db_password = os.environ.get("DB_PASSWORD", "")
    db_name = os.environ.get("DB_NAME", "csr_db")
    db_port = os.environ.get("DB_PORT", "3306")
    return f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me")
    SQLALCHEMY_DATABASE_URI = get_db_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
