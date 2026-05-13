# File: app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import random
import string
from datetime import datetime
from app.db.sql import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.postgres import UserDB, CoupleDB 
from app.schemas.auth import UserRegister, UserLogin, Token, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

def generate_pairing_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return "LVE-" + "".join(random.choices(chars, k=length-4))

@router.post("/register", response_model=Token)
async def register_user(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    # 1. Kiểm tra Email
    result = await db.execute(select(UserDB).where(UserDB.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký!")

    # 2. Tạo User
    hashed_password = get_password_hash(user_data.password)
    new_user = UserDB(
        email=user_data.email,
        password_hash=hashed_password,
        display_name=user_data.name
    )
    db.add(new_user)
    await db.flush() # Lưu tạm vào DB để sinh ra ID

    # QUAN TRỌNG: Lấy dữ liệu ra ngay TRƯỚC KHI commit để tránh lỗi "gkpj"
    user_id = new_user.id
    user_email = new_user.email
    user_name = new_user.display_name
    user_avatar = new_user.avatar_url
    user_created_at = new_user.created_at

    # 3. Tạo Couple
    new_couple = CoupleDB(
        user1_id=user_id,
        pairing_code=generate_pairing_code()
    )
    db.add(new_couple)
    
    # 4. Commit lưu chính thức
    await db.commit()

    # 5. Tạo Token trả về bằng dữ liệu đã lưu tạm (Không dùng model_validate)
    access_token = create_access_token(data={"sub": str(user_id), "email": user_email})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user_id,
            email=user_email,
            display_name=user_name,
            avatar_url=user_avatar,
            created_at=user_created_at or datetime.now()
        )
    )

@router.post("/login", response_model=Token)
async def login_user(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == user_data.email))
    user = result.scalars().first()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    # Thay thế model_validate bằng việc gán tay để an toàn 100%
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            created_at=user.created_at
        )
    )