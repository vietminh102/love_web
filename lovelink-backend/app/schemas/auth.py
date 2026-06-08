from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from datetime import date


class UserRegister(BaseModel):
    """
    Schema nhận dữ liệu khi người dùng submit form Đăng ký.
    """
    email: str
    password: str = Field(..., min_length=6, description="Mật khẩu phải từ 6 ký tự")
    name: str = Field(..., min_length=2, max_length=100, description="Tên hiển thị của người dùng") 
    gender: Optional[str] = "other"
    dob: Optional[str] = None

class UserLogin(BaseModel):
    """
    Schema nhận dữ liệu khi người dùng submit form Đăng nhập.
    """
    email: str
    password: str



class UserResponse(BaseModel):
    """
    Schema chuẩn hóa thông tin User trả về cho Client.
    """
    id: UUID
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    created_at: datetime
    
   
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

class EmailUpdate(BaseModel):
    new_email: str

class OnboardingUpdate(BaseModel):
    display_name: str
    gender: str
    dob: date

#nhận Token từ Frontend
class GoogleToken(BaseModel):
    token: str