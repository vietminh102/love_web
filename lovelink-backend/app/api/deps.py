from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import jwt # Sử dụng PyJWT đồng bộ với security.py

from app.db.sql import get_db
from app.models.Users import Users
from app.core.config import settings  # SỬA: Import settings từ config thay vì security

# Khai báo cấu hình bắt Token từ Header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập (Token hết hạn hoặc không hợp lệ)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # SỬA: Gọi biến thông qua settings.SECRET_KEY và settings.ALGORITHM
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
    except jwt.PyJWTError: # SỬA: Bắt lỗi chuẩn của thư viện PyJWT
        raise credentials_exception

    # Truy vấn User từ CSDL
    result = await db.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
        
    return user