# File: app/db/postgres.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Tạo engine kết nối từ chuỗi POSTGRES_URL trong file .env
engine = create_async_engine(settings.POSTGRES_URL, echo=True)

# Tạo session factory
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Dependency để sử dụng trong các API (lấy database session)
async def get_db():
    async with async_session() as session:
        yield session