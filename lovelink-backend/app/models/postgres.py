import uuid
from sqlalchemy import Column, String, Boolean, Date, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class UserDB(Base):
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

class CoupleDB(Base):
    """
    Model tương ứng với bảng 'couples' trong PostgreSQL
    """
    __tablename__ = "couples"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user1_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Có thể null nếu người kia chưa nhập mã pairing_code
    user2_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True) 
    
    start_date = Column(Date, nullable=True) # Ngày kỷ niệm
    pairing_code = Column(String(10), unique=True, nullable=True, index=True) # Mã để kết nối cặp đôi
    background_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())