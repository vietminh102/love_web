import uuid
from sqlalchemy import Column, String, Boolean, Date, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.postgres import Base



class Couples(Base):
    """
    Model tương ứng với bảng 'couples' trong PostgreSQL
    """
    __tablename__ = "couples"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user1_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Có thể null nếu người kia chưa nhập mã pairing_code
    user2_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True) 
    
    start_date = Column(DateTime(timezone=True), nullable=True) # Ngày kỷ niệm
    pairing_code = Column(String(10), unique=True, nullable=True, index=True) # Mã để kết nối cặp đôi
    background_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    background_url = Column(String, nullable=True)