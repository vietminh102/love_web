# File: app/models/nosql.py
from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime
from typing import List

class Diary(Document):
    title: str
    content: str
    date: str
    location: Optional[str] = None
    image_url: Optional[str] = None
    
    # Tự động lấy thời gian tạo
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    author_id: str  
    visibility: str = "couple"
    liked_by: List[str] = []

    class Settings:
        name = "diaries"  # Tên Collection trong MongoDB

class Gallery(Document):
    
    user_id: str
    couple_id: Optional[str] = None # Cho phép null nếu user đang độc thân
    image_url: str
    created_at: datetime = Field(default_factory=datetime.now)
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
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "notifications"
class WheelData(Document):
    couple_id: str
    prizes: list

    class Settings:
        name = "wheel_configs"