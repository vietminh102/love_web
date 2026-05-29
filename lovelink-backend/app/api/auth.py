import os
import random
import string
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import date

# Import từ các module của bạn
from app.db.sql import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.Users import Users
from app.models.Couples import Couples
from app.api.deps import get_current_user
from app.schemas.auth import UserRegister, UserLogin, Token, UserResponse, UpdateResponse,EmailUpdate


from app.api.cloudinary_utils import upload_image_to_cloud

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Đã xóa phần khởi tạo thư mục UPLOAD_DIR vì không còn lưu ổ cứng nữa!

def generate_pairing_code(length=8):
    """Sinh mã ghép đôi ngẫu nhiên"""
    chars = string.ascii_uppercase + string.digits
    return "VYL-" + "".join(random.choices(chars, k=length-4))

class OnboardingUpdate(BaseModel):
    display_name: str
    gender: str
    dob: date # Định dạng dạng: YYYY-MM-DD

# Khai báo schema nhận Token từ Frontend
class GoogleToken(BaseModel):
    token: str

GOOGLE_CLIENT_ID = "337450123524-tuj4ps93vtb43nd79joar6rnj8rrue4u.apps.googleusercontent.com"

@router.get("/me")
async def get_current_user_info(current_user: Users = Depends(get_current_user)):
    """API để Frontend tự động kéo thông tin mới nhất mỗi khi load web"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "gender": current_user.gender,
        "dob": current_user.dob.isoformat() if current_user.dob else None
    }

@router.put("/update-onboarding")
async def update_onboarding(
    data: OnboardingUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: Users = Depends(get_current_user)
):
    # Kiểm tra không cho phép để tên trống
    if not data.display_name.strip():
        raise HTTPException(status_code=400, detail="Tên hiển thị không được để trống")
        
    # Cập nhật thông tin vào tài khoản hiện tại
    current_user.display_name = data.display_name.strip()
    current_user.gender = data.gender
    current_user.dob = data.dob
    
    await db.commit()
    await db.refresh(current_user)
    
    return {"success": True, "message": "Cập nhật hồ sơ thành công", "user": current_user}

@router.post("/google-login")
async def google_login(data: GoogleToken, db: AsyncSession = Depends(get_db)):
    try:
        # 1. Xác thực Token với server của Google
        idinfo = id_token.verify_oauth2_token(
            data.token, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )

        # 2. Lấy thông tin user từ Google
        user_email = idinfo['email']
        user_name = idinfo.get('name', 'Google User')
        avatar_url = idinfo.get('picture', None)

        # 3. Kiểm tra xem user này đã có trong Database chưa
        result = await db.execute(select(Users).where(Users.email == user_email))
        user = result.scalars().first()

        if not user:
            # 4. Nếu chưa có -> Tự động tạo tài khoản mới (Đăng ký ngầm)
            new_user = Users(
                email=user_email,
                display_name=user_name,
                avatar_url=avatar_url,
                password_hash="GOOGLE_ACCOUNT", # Đánh dấu nick Google
            )
            db.add(new_user)
            await db.flush() 

            new_couple = Couples(
                user1_id=new_user.id,
                pairing_code=generate_pairing_code() # Sinh mã VYL-XXXX
            )
            db.add(new_couple)
            
            # Commit lưu cả User và Couple chính thức vào Database
            await db.commit()
            await db.refresh(new_user)
            user = new_user

        # 5. Cấp Access Token của App
        access_token = create_access_token(data={"sub": str(user.id)})

        return {"access_token": access_token, "token_type": "bearer"}

    except ValueError:
        raise HTTPException(status_code=400, detail="Xác thực Google thất bại")

@router.post("/register", response_model=Token)
async def register_user(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    # 1. Kiểm tra Email
    result = await db.execute(select(Users).where(Users.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký!")
        
    parsed_dob = None
    if user_data.dob:
        try:
            parsed_dob = datetime.strptime(user_data.dob, "%Y-%m-%d").date()
        except ValueError:
            pass # Hoặc báo lỗi tùy bạn
            
    # 2. Tạo User
    hashed_password = get_password_hash(user_data.password)
    new_user = Users(
        email=user_data.email,
        password_hash=hashed_password,
        display_name=user_data.name,
        gender=user_data.gender,
        dob=parsed_dob
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
    new_couple = Couples(
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
    result = await db.execute(select(Users).where(Users.email == user_data.email))
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


@router.put("/update-profile")
async def update_profile(
    display_name: Optional[str] = Form(None),
    gender: Optional[str] = Form("other"),
    dob: Optional[str] = Form(None),
    old_password: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    avatar: UploadFile = File(None),
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Cập nhật Tên hiển thị (Kiểm tra an toàn)
    if not display_name or not display_name.strip():
        raise HTTPException(status_code=400, detail="Tên hiển thị không được để trống")
    current_user.display_name = display_name.strip()
    
    if gender:
        current_user.gender = gender
    
    if dob:
        try:
            current_user.dob = datetime.strptime(dob, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Sai định dạng ngày sinh")
            
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

    # 3. 🌟 LÊN MÂY: Xử lý Upload Ảnh (Sử dụng avatar.file chuẩn)
    if avatar:
        # Giao trực tiếp avatar.file cho Cloudinary (giống như ta đã làm rất tốt ở Gallery)
        cloud_url = upload_image_to_cloud(avatar.file, folder_name="lovelink/avatars")
        
        if not cloud_url:
            raise HTTPException(status_code=400, detail="Không thể tải ảnh đại diện lên mây lúc này!")
        current_user.avatar_url = cloud_url

    # 4. Lưu thay đổi vào Database
    try:
        await db.commit()
        await db.refresh(current_user)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Không thể cập nhật cơ sở dữ liệu")

    # 5. Ép kiểu JSON an toàn
    return {
        "message": "Cập nhật thông tin thành công! 💕",
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "display_name": current_user.display_name,
            "avatar_url": current_user.avatar_url,
            "gender": current_user.gender,
            "dob": current_user.dob.isoformat() if current_user.dob else None
        }
    }

@router.delete("/delete-account")
async def delete_account(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Xóa tài khoản vĩnh viễn (Yêu cầu phải đang độc thân)"""
    # 1. Kiểm tra trạng thái ghép đôi
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    # 2. Chặn nếu đang ghép đôi
    if couple and couple.user1_id is not None and couple.user2_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn phải hủy ghép đôi trước khi có thể xóa tài khoản!"
        )

    try:
        # 3. Xóa bản ghi chứa mã ghép đôi FA của người này
        if couple:
            await db.delete(couple)
        
        # 4. Xóa tài khoản chính
        await db.delete(current_user)
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi xóa tài khoản: {str(e)}")

    return {"message": "Tài khoản của bạn đã được xóa vĩnh viễn."}

@router.post("/update-avatar")
async def update_user_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Users = Depends(get_current_user)
):
    """API riêng biệt để xử lý upload ảnh từ màn hình Onboarding"""
    
    # 🌟 LÊN MÂY: Xử lý Upload Ảnh Đại Diện (Onboarding)
    cloud_url = upload_image_to_cloud(file.file, folder_name="lovelink/avatars")
    if not cloud_url:
        raise HTTPException(status_code=400, detail="Không thể tải ảnh lên mây lúc này!")

    try:
        current_user.avatar_url = cloud_url
        await db.commit()
        await db.refresh(current_user)
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu DB: {str(e)}")

    return {"success": True, "avatar_url": current_user.avatar_url, "user": current_user}

@router.patch("/update-email")
async def update_my_email(
    request: EmailUpdate,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_email = request.new_email.strip()
    
    if "@" not in new_email:
        raise HTTPException(status_code=400, detail="Email không hợp lệ! (Phải chứa dấu @)")
        
    if new_email == current_user.email:
        return {"message": "Đây đã là email hiện tại của bạn rồi!"}

    result = await db.execute(select(Users).where(Users.email == new_email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email này đã được sử dụng bởi tài khoản khác!")
        
    # Cập nhật DB
    current_user.email = new_email
    try:
        await db.commit()
        await db.refresh(current_user)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi khi lưu dữ liệu cập nhật Email")
    
    # 🌟 BÍ KÍP CHỐNG F5: TẠO NGAY TOKEN MỚI CHỨA EMAIL MỚI
    new_token = create_access_token(data={"sub": str(current_user.id), "email": current_user.email})

    return {
        "success": True,
        "new_token": new_token, # 👈 Ném cái vé mới về cho Frontend
        "message": "Đã cập nhật Email thành công!", 
        "user": {
            "id": str(current_user.id),
            "email": current_user.email
        }
    }