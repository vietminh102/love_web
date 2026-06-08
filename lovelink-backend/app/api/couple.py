import os
import shutil
import uuid
from datetime import datetime, timezone
from app.api.cloudinary_utils import upload_image_to_cloud


from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from app.models.nosql import Notification
from app.api.notifications import manager

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
    # Tìm record Couple mà user này là user1 HOẶC user2
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    
    if not couple:
    
        return None
        
    return couple


@router.put("/start-date")
async def update_start_date(
    request: UpdateStartDateRequest,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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
    # Xử lý chuỗi
    code = request.pairing_code.strip().upper()

    # Kiểm tra xem đã ghép đôi chưa
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

    # Tìm mã ghép đôi của ĐỐI PHƯƠNG
    target_result = await db.execute(select(Couples).where(Couples.pairing_code == code))
    target_couple = target_result.scalars().first()

    if not target_couple:
        raise HTTPException(status_code=404, detail="Mã ghép đôi không tồn tại hoặc đã sai!")

    if target_couple.user1_id == current_user.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự ghép đôi với chính mình được!")

    if target_couple.user2_id is not None:
        raise HTTPException(status_code=400, detail="Người này đã hoa có chủ rồi!")

    #  GHÉP ĐÔI 
    try:
        # Cập nhật ID của mình vào hồ sơ của đối phương
        target_couple.user2_id = current_user.id
        # Ghi nhận chính xác số giây bắt đầu yêu
        target_couple.start_date = datetime.now(timezone.utc)
        print(f"DEBUG: Bat dau ghep doi luc {target_couple.start_date}")
        

        for c in my_couples:
            if c.id != target_couple.id:
                await db.delete(c)

        # Lưu mọi thay đổi 
        await db.commit()
        await db.refresh(target_couple)
        
        
        # Gửi thông báo 
        notif_me = Notification(
            user_id=str(current_user.id),
            actor_name="LoveLink",
            type="couple_paired",
            message="Bạn và người ấy đã ghép đôi thành công. Chúc hai bạn có những khoảnh khắc thật ngon ngào bên nhau🥂",
            link="/home"
        )
        await notif_me.insert()
        await manager.send_personal_message({
            "id": str(notif_me.id), 
            "actor_name": notif_me.actor_name, 
            "message": notif_me.message,
            "type": notif_me.type, 
            "is_read": False, 
            "link": notif_me.link, 
            "created_at": notif_me.created_at.isoformat()
        }, str(current_user.id))

        # Gửi thông báo 
        notif_partner = Notification(
            user_id=str(target_couple.user1_id),
            actor_name="LoveLink",
            type="couple_paired",
            message="Tuyệt vời! Người ấy đã đồng ý ghép đôi với bạn.Chúc hai bạn có những khoảnh khắc thật ngon ngào bên nhau🥂",
            link="/home"
        )
        await notif_partner.insert()
        await manager.send_personal_message({
            "id": str(notif_partner.id), 
            "actor_name": notif_partner.actor_name, 
            "message": notif_partner.message,
            "type": notif_partner.type, 
            "is_read": False, 
            "link": notif_partner.link, 
            "created_at": notif_partner.created_at.isoformat()
        }, str(target_couple.user1_id))

    except Exception as e:
        await db.rollback()
        print(f"LỖI HỆ THỐNG KHI GHÉP ĐÔI: {str(e)}")
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
    
    
    # Tìm bản ghi ghép đôi của mình
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    # Nếu chưa ghép đôi (user2_id là None) thì báo về false
    if not couple or couple.user1_id is None or couple.user2_id is None:
        return {"has_partner": False}

    # Xác định ID của đối phương
    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id

    #  Chui vào bảng Users để lấy Tên và Ảnh của đối phương
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

    # Tìm ID của đối phương trước khi xóa
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
        #  Xóa tất cả record liên quan đến 2 người này
        await db.execute(
            delete(Couples).where(
                (Couples.user1_id == current_user.id) | 
                (Couples.user2_id == current_user.id) |
                (Couples.user1_id == partner_id) |
                (Couples.user2_id == partner_id)
            )
        )
        await db.flush() 

        # Cấp mã Độc thân 
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
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    if not couple or couple.user2_id is None:
        raise HTTPException(status_code=400, detail="Bạn chưa ghép đôi nên không thể cài ảnh nền!")

    try:

        cloud_url = upload_image_to_cloud(file.file, folder_name="lovelink/backgrounds")
        
        if not cloud_url:
            raise HTTPException(status_code=400, detail="Không thể tải ảnh lên mây lúc này!")
            

        couple.background_url = cloud_url
        
        await db.commit()
        await db.refresh(couple)
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")
        
    return {
        "message": "Cập nhật ảnh nền mây thành công!", 
        "background_url": cloud_url
    }


@router.delete("/background")
async def delete_couple_background(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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