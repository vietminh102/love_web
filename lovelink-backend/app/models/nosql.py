# File: app/models/nosql.py
from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime

class Diary(Document):
    title: str
    content: str
    date: str
    location: Optional[str] = None
    image_url: Optional[str] = None
    
    # Tự động lấy thời gian tạo
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # couple_id: str  <-- Sau này bạn sẽ dùng trường này để biết nhật ký này của cặp đôi nào

    class Settings:
        name = "diaries"  # Tên Collection trong MongoDB

class Gallery(Document):
    image_url: str
    caption: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    # couple_id: str

    class Settings:
        name = "galleries"