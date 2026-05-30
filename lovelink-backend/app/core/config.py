# File: D:\Personal Project\lovelink\lovelink-backend\app\core\config.py
from pydantic_settings import BaseSettings,SettingsConfigDict
from dotenv import load_dotenv
import os
from typing import Optional

load_dotenv()

class Settings(BaseSettings):
    # Các thông số PostgreSQL
    POSTGRES_URL: str = os.getenv("POSTGRES_URL", "postgresql+asyncpg://postgres:password@localhost:5432/lovelink_core")
    
    # Các thông số MongoDB
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_NAME: str = os.getenv("MONGODB_NAME", "lovelink_content")
    
    # JWT & Bảo mật
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-mee")
    brevo_api_key: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 ngày
    redis_url: str = "redis://localhost:6379"
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # DAM MAY
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str

# ĐÂY LÀ DÒNG QUAN TRỌNG NHẤT: Khởi tạo biến settings để các file khác import
settings = Settings()