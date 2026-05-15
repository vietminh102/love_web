import os
import shutil
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete

from app.db.sql import get_db
from app.models.Users import Users
from app.models.Couples import Couples
from app.api.deps import get_current_user
from app.schemas.couple import PairRequest
from app.api.auth import generate_pairing_code
from app.schemas.couple import UpdateStartDateRequest

router = APIRouter(prefix="/couple", tags=["Couple"])

@router.get("/info")
async def get_couple_info(
    current_user: Users = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Lấy thông tin ghép đôi của User hiện tại (Lấy mã Code để chia sẻ)
    """
    # Tìm record Couple mà user này là user1 HOẶC user2
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    
    if not couple:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin ghép đôi")
        
    return couple


@router.put("/start-date")
async def update_start_date(
    request: UpdateStartDateRequest,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cập nhật ngày bắt đầu hẹn hò"""
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    if not couple or couple.user2_id is None:
        raise HTTPException(status_code=400, detail="Bạn chưa ghép đôi!")

    try:
        couple.start_date = request.new_start_date
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi cập nhật ngày")
        
    return {"message": "Đã cập nhật ngày kỉ niệm!", "new_start_date": couple.start_date.isoformat()}


@router.post("/pair")
async def pair_with_partner(
    request: PairRequest, 
    current_user: Users = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Nhập mã để ghép đôi với người ấy
    """
    # Xử lý chuỗi (Xóa dấu cách thừa, in hoa)
    code = request.pairing_code.strip().upper()

    # 1. Kiểm tra xem MÌNH đã ghép đôi chưa
    my_couple_result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    my_couples = my_couple_result.scalars().all()
    
    for c in my_couples:
        if c.user1_id is not None and c.user2_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Bạn đã được ghép đôi với người khác rồi! Cần hủy ghép đôi trước."
            )

    # 2. Tìm mã ghép đôi của ĐỐI PHƯƠNG
    target_result = await db.execute(select(Couples).where(Couples.pairing_code == code))
    target_couple = target_result.scalars().first()

    if not target_couple:
        raise HTTPException(status_code=404, detail="Mã ghép đôi không tồn tại hoặc đã sai!")

    if target_couple.user1_id == current_user.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự ghép đôi với chính mình được!")

    if target_couple.user2_id is not None:
        raise HTTPException(status_code=400, detail="Người này đã hoa có chủ rồi!")

    # 3. TIẾN HÀNH GHÉP ĐÔI 💕
    try:
        # Cập nhật ID của mình vào hồ sơ của đối phương
        target_couple.user2_id = current_user.id
        # Ghi nhận chính xác số giây hai bạn bắt đầu yêu
        target_couple.start_date = datetime.now(timezone.utc)
        print(f"DEBUG: Bat dau ghep doi luc {target_couple.start_date}")
        # Xóa các record "độc thân" cũ của mình để tránh rác Database
        for c in my_couples:
            if c.id != target_couple.id:
                await db.delete(c)

        await db.commit()
        await db.refresh(target_couple)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi ghép đôi")

    return {
        "message": "Ghép đôi thành công! Chúc hai bạn hạnh phúc 💕", 
        "couple": target_couple
    }


@router.get("/partner")
async def get_partner_info(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lấy thông tin hiển thị của Người ấy (Tên, Ảnh, Ảnh nền chung)"""
    
    # 1. Tìm bản ghi ghép đôi của mình
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    # Nếu chưa ghép đôi (user2_id là None) thì báo về false
    if not couple or couple.user1_id is None or couple.user2_id is None:
        return {"has_partner": False}

    # 2. Xác định ID của đối phương
    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id

    # 3. Chui vào bảng Users để lấy Tên và Ảnh của đối phương
    partner_result = await db.execute(select(Users).where(Users.id == partner_id))
    partner = partner_result.scalars().first()

    if partner:
        return {
            "has_partner": True,
            "display_name": partner.display_name,
            "avatar_url": partner.avatar_url,
            "start_date": couple.start_date.isoformat() if couple.start_date else None,
            "gender": partner.gender,
            "dob": partner.dob.isoformat() if partner.dob else None,
            "background_url": couple.background_url  # Đã bổ sung link ảnh nền
        }
        
    return {"has_partner": False}


@router.post("/unpair")
async def unpair_partner(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Hủy ghép đôi và xóa mọi dữ liệu liên quan"""
    # 1. Tìm ID của đối phương trước khi xóa
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    if not couple:
        raise HTTPException(status_code=400, detail="Bạn không có cặp đôi nào để hủy.")
    
    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id

    try:
        # 2. CHIẾN THUẬT "DỌN SẠCH": Xóa tất cả record liên quan đến 2 người này
        await db.execute(
            delete(Couples).where(
                (Couples.user1_id == current_user.id) | 
                (Couples.user2_id == current_user.id) |
                (Couples.user1_id == partner_id) |
                (Couples.user2_id == partner_id)
            )
        )
        await db.flush() # Đẩy lệnh xóa xuống DB ngay lập tức

        # 3. Cấp mã Độc thân (FA) mới tinh
        new_couples = [
            Couples(user1_id=current_user.id, pairing_code=generate_pairing_code(), start_date=None, background_url=None),
            Couples(user1_id=partner_id, pairing_code=generate_pairing_code(), start_date=None, background_url=None)
        ]
        db.add_all(new_couples)
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(e)}")

    return {"message": "Đã dọn sạch dữ liệu cũ và trở về trạng thái độc thân!"}


@router.post("/background")
async def upload_couple_background(
    file: UploadFile = File(...),
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Tải lên ảnh nền chung cho cặp đôi"""
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    if not couple or couple.user2_id is None:
        raise HTTPException(status_code=400, detail="Bạn chưa ghép đôi nên không thể cài ảnh nền!")

    try:
        # Tạo file và thư mục
        file_extension = file.filename.split(".")[-1]
        file_name = f"bg_{uuid.uuid4()}.{file_extension}"
        file_path = f"static/backgrounds/{file_name}"
        
        os.makedirs("static/backgrounds", exist_ok=True)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Cập nhật DB
        background_url = f"http://localhost:8000/{file_path}"
        couple.background_url = background_url
        
        await db.commit()
        await db.refresh(couple)
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tải ảnh lên")
        
    return {
        "message": "Cập nhật ảnh nền thành công!", 
        "background_url": background_url
    }


@router.delete("/background")
async def delete_couple_background(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Xóa ảnh nền của cặp đôi, quay về mặc định"""
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    if not couple or couple.user2_id is None:
        raise HTTPException(status_code=400, detail="Bạn chưa ghép đôi!")

    try:
        couple.background_url = None
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi xóa ảnh")
        
    return {"message": "Đã xóa ảnh nền, trở về giao diện mặc định!"}