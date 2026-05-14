import uuid
from sqlalchemy import Column, String, Boolean, Date, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.postgres import Base



class Users(Base):
    """
    Model tương ứng với bảng 'users' trong PostgreSQL
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Ở database của bạn tên cột là display_name
    display_name = Column(String(100), nullable=False)
    
    avatar_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    gender = Column(String(20), nullable=True, default="other")
    dob = Column(Date, nullable=True)