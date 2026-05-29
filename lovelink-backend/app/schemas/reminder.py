# app/schemas/reminder.py
from pydantic import BaseModel
from datetime import datetime

class ReminderCreate(BaseModel):
    title: str
    message: str
    remind_time: datetime
    send_email: bool = True

class ReminderResponse(BaseModel):
    id: str
    title: str
    message: str
    remind_time: datetime
    send_email: bool
    created_at: datetime
    is_triggered: bool

    class Config:
        # Hỗ trợ tự động map dữ liệu từ Beanie Document sang Schema
        orm_mode = True 
        from_attributes = True