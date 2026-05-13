# File: app/schemas/auth.py

from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID

# ---------------------------------------------------------
# 1. SCHEMAS REQUEST (Hứng dữ liệu từ Frontend gửi lên)
# ---------------------------------------------------------

class UserRegister(BaseModel):
    """
    Schema nhận dữ liệu khi người dùng submit form Đăng ký.
    Dùng tên biến khớp với payload từ file AuthPage.tsx của React.
    """
    email: EmailStr
    password: str
    
    # React form gửi lên là 'name', mình sẽ map nó vào 'display_name' lúc tạo DB
    name: str = Field(..., min_length=2, max_length=100) 
    
    # Các trường mở rộng (Optional) cho lúc mới đăng ký
    partnerName: Optional[str] = None
    anniversaryDate: Optional[date] = None

class UserLogin(BaseModel):
    """Schema nhận dữ liệu khi người dùng submit form Đăng nhập"""
    email: EmailStr
    password: str


# ---------------------------------------------------------
# 2. SCHEMAS RESPONSE (Trả dữ liệu từ Backend về Frontend)
# ---------------------------------------------------------

class UserResponse(BaseModel):
    """
    Schema định dạng thông tin User trả về.
    Lưu ý: Tuyệt đối KHÔNG trả về password_hash.
    """
    id: UUID
    email: EmailStr
    display_name: str
    avatar_url: Optional[str] = None
    created_at: datetime
    
    # ConfigDict(from_attributes=True) báo cho Pydantic biết cách đọc dữ liệu
    # trực tiếp từ object UserDB (SQLAlchemy) thay vì một Dictionary.
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    """
    Schema trả về cho Frontend khi đăng nhập/đăng ký thành công.
    Bao gồm JWT Token và toàn bộ thông tin User.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse