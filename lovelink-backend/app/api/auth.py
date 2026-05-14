import os
import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Import từ các module của bạn
from app.db.sql import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.postgres import UserDB, CoupleDB 
from app.api.deps import get_current_user
from app.schemas.auth import UserRegister, UserLogin, Token, UserResponse, UpdateResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Khởi tạo thư mục lưu ảnh (Chỉ chạy 1 lần khi khởi động app)
UPLOAD_DIR = "static/avatars"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def generate_pairing_code(length=8):
    """Sinh mã ghép đôi ngẫu nhiên"""
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

    # Lấy dữ liệu ra ngay TRƯỚC KHI commit để tránh lỗi "MissingGreenlet" của SQLAlchemy
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

    # 5. Tạo Token 
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

@router.put("/update-profile", response_model=UpdateResponse)
async def update_profile(
    display_name: Optional[str] = Form(None),
    old_password: Optional[str] = Form(None),
    password: str = Form(None),
    avatar: UploadFile = File(None),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Cập nhật Tên hiển thị (Kiểm tra rỗng)
    if not display_name.strip():
        raise HTTPException(status_code=400, detail="Tên hiển thị không được để trống")
    current_user.display_name = display_name.strip()

    # 2. Xử lý đổi mật khẩu
    if password:
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu phải từ 6 ký tự")
        if not old_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới"
            )
        if not verify_password(old_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu hiện tại không chính xác"
            )
        current_user.password_hash = get_password_hash(password)

    # 3. Xử lý Upload Ảnh (Tối ưu I/O cho Async)
    if avatar:
        ext = avatar.filename.split(".")[-1].lower()
        if ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
            raise HTTPException(status_code=400, detail="Định dạng ảnh không hợp lệ")

        file_name = f"user_{current_user.id}.{ext}"
        file_path = os.path.join(UPLOAD_DIR, file_name)

        try:
            # Đọc file bất đồng bộ (Tránh treo server khi file lớn)
            content = await avatar.read() 
            with open(file_path, "wb") as f:
                f.write(content)
            
            # Lưu đường dẫn vào user object
            current_user.avatar_url = f"http://localhost:8000/static/avatars/{file_name}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi khi lưu ảnh: {str(e)}")

    # 4. Lưu thay đổi vào Database
    try:
        # object current_user đã nằm sẵn trong session từ get_current_user
        # nên chỉ cần commit là đủ
        await db.commit()
        await db.refresh(current_user)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Không thể cập nhật cơ sở dữ liệu")

    return {
        "message": "Cập nhật thông tin thành công! 💕",
        "user": current_user
    }