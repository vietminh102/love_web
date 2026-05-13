# File: D:\Personal Project\lovelink\lovelink-backend\app\core\config.py
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    # Các thông số PostgreSQL
    POSTGRES_URL: str = os.getenv("POSTGRES_URL", "postgresql+asyncpg://postgres:password@localhost:5432/lovelink_core")
    
    # Các thông số MongoDB
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_NAME: str = os.getenv("MONGODB_NAME", "lovelink_content")
    
    # JWT & Bảo mật
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 ngày

    class Config:
        case_sensitive = True

# ĐÂY LÀ DÒNG QUAN TRỌNG NHẤT: Khởi tạo biến settings để các file khác import
settings = Settings()