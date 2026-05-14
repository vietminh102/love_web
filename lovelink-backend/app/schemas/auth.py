from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

# =====================================================================
# 1. SCHEMAS REQUEST (Hứng dữ liệu từ Frontend gửi lên)
# =====================================================================

class UserRegister(BaseModel):
    """
    Schema nhận dữ liệu khi người dùng submit form Đăng ký.
    """
    email: EmailStr
    password: str = Field(..., min_length=6, description="Mật khẩu phải từ 6 ký tự")
    name: str = Field(..., min_length=2, max_length=100, description="Tên hiển thị của người dùng") 

class UserLogin(BaseModel):
    """
    Schema nhận dữ liệu khi người dùng submit form Đăng nhập.
    """
    email: EmailStr
    password: str

# =====================================================================
# 2. SCHEMAS RESPONSE (Trả dữ liệu từ Backend về Frontend)
# =====================================================================

class UserResponse(BaseModel):
    """
    Schema chuẩn hóa thông tin User trả về cho Client.
    Tuyệt đối KHÔNG chứa các trường nhạy cảm như password_hash.
    """
    id: UUID
    email: EmailStr
    display_name: str
    avatar_url: Optional[str] = None
    created_at: datetime
    
    # Cho phép Pydantic đọc dữ liệu trực tiếp từ Model SQLAlchemy (ORM)
    model_config = ConfigDict(from_attributes=True)

class UpdateResponse(BaseModel):
    """
    Schema trả về sau khi cập nhật Profile thành công.
    """
    message: str = "Cập nhật thông tin thành công! 💕"
    user: UserResponse

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    """
    Schema chuẩn trả về JWT Token và thông tin User khi đăng nhập/đăng ký.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse