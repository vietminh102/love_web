# File: app/models/nosql.py
from beanie import Document
from pydantic import Field,model_validator
from typing import Optional
from datetime import datetime, timezone
from typing import List
from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from app.models.postgres import Base

class Diary(Document):
    title: str
    content: str
    date: str
    location: Optional[str] = None
    image_url: Optional[str] = None
    
    # Tự động lấy thời gian tạo
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    author_id: str  
    visibility: str = "couple"
    liked_by: List[str] = []

    class Settings:
        name = "diaries"  # Tên Collection trong MongoDB

class Gallery(Document):
    
    user_id: str
    couple_id: Optional[str] = None # Cho phép null nếu user đang độc thân
    image_url: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    likes: List[str] = Field(default_factory=list)

    class Settings:
        name = "galleries"
class Notification(Document):
    user_id: str          # ID của người NHẬN thông báo
    actor_name: str       # Tên của người GÂY RA hành động (ví dụ: "Người ấy")
    type: str             # Loại: 'like', 'diary'
    message: str          # Nội dung: "đã thả tim ảnh của bạn", "vừa viết nhật ký mới"
    is_read: bool = False # Đã đọc chưa?
    link: Optional[str] = None # Link để bấm vào (ví dụ link tới bài nhật ký/ảnh)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    @model_validator(mode="after")
    def ensure_utc_timezone(self):
        """
        Mỗi khi lấy dữ liệu từ MongoDB lên, nếu thời gian bị mất múi giờ,
        hàm này sẽ tự động ép lại múi giờ UTC chuẩn vào đối tượng.
        """
        if self.created_at and self.created_at.tzinfo is None:
            self.created_at = self.created_at.replace(tzinfo=timezone.utc)
        return self

    class Settings:
        name = "notifications"
class WheelData(Document):
    couple_id: str
    prizes: list

    class Settings:
        name = "wheel_configs"

class Reminder(Document):
    title: str
    message: str
    remind_time: datetime
    send_email: bool = True
    couple_id: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_triggered: bool = False

    class Settings:
        name = "reminders" 

class ChatMessage(Document):
    couple_id: str
    sender_id: str
    msg_id: str
    text: str
    timestamp: int

    class Settings:
        # Tên collection trong MongoDB
        name = "couple_chats"

class ChatStatus(Base):
    __tablename__ = "chat_status"

    id = Column(Integer, primary_key=True, index=True)
    couple_id = Column(UUID(as_uuid=True), ForeignKey("couples.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    last_read_time = Column(BigInteger, default=0, nullable=False)  # Lưu timestamp epoch ms

    # Đảm bảo mỗi user trong một couple chỉ có duy nhất một dòng trạng thái
    __table_args__ = (UniqueConstraint('couple_id', 'user_id', name='_couple_user_uc'),)