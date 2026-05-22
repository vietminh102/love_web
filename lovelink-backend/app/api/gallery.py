import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from beanie import PydanticObjectId

from app.db.sql import get_db
from app.api.deps import get_current_user
from app.models.Users import Users
from app.models.Couples import Couples
from app.models.nosql import Gallery
from app.api.notifications import manager
from app.models.nosql import Notification

router = APIRouter(prefix="/gallery", tags=["Gallery"])

UPLOAD_DIR = "static/gallery"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

async def get_user_couple(db_sql: AsyncSession, user_id: int):
    result = await db_sql.execute(
        select(Couples).where((Couples.user1_id == user_id) | (Couples.user2_id == user_id))
    )
    couple = result.scalars().first()
    if couple and couple.user2_id is not None:
        return couple
    return None

@router.post("/upload")
async def upload_photo(
    file: UploadFile = File(...),
    db_sql: AsyncSession = Depends(get_db),
    current_user: Users = Depends(get_current_user)
):
    # 1. Lưu file ảnh thực tế
    ext = file.filename.split(".")[-1].lower()
    file_name = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    image_url = f"/static/gallery/{file_name}"

    # 2. Xử lý logic Độc thân/Cặp đôi
    couple = await get_user_couple(db_sql, current_user.id)
    
    # 3. 🌟 LƯU BẰNG BEANIE (Cực kỳ ngắn gọn)
    new_photo = Gallery(
        user_id=str(current_user.id), 
        couple_id=str(couple.id) if couple else None, 
        image_url=image_url
    )
    await new_photo.insert()

    #  4. THÊM LOGIC: BẮN THÔNG BÁO CHO ĐỐI PHƯƠNG KHI ĐĂNG ẢNH MỚI
    if couple and couple.user1_id and couple.user2_id:
        current_user_id_str = str(current_user.id)
        user1_id_str = str(couple.user1_id)
        user2_id_str = str(couple.user2_id)
        
        # Xác định ID của người yêu
        partner_id = user2_id_str if current_user_id_str == user1_id_str else user1_id_str

        # Lưu bản ghi thông báo vào MongoDB
        notif = Notification(
            user_id=partner_id,
            actor_name=current_user.display_name,
            type="gallery_upload", # Loại thông báo mới
            message="vừa tải lên một khoảnh khắc mới 📸",
            link=f"/gallery?photoId={str(new_photo.id)}" # Nhấn vào sẽ tự bung ảnh này lên
        )
        await notif.insert()

        # Bắn tín hiệu Realtime qua WebSocket cho người yêu đang online
        await manager.send_personal_message({
            "id": str(notif.id),
            "actor_name": notif.actor_name,
            "message": notif.message,
            "type": notif.type,
            "is_read": notif.is_read,
            "link": notif.link,
            "created_at": notif.created_at.isoformat()
        }, partner_id)

    return {
        "success": True, 
        "photo": {
            "id": str(new_photo.id),
            "image_url": new_photo.image_url,
            "created_at": new_photo.created_at.isoformat(),
            "likes": []
        }
    }

@router.get("/")
async def get_photos(
    db_sql: AsyncSession = Depends(get_db),
    current_user: Users = Depends(get_current_user)
):
    couple = await get_user_couple(db_sql, current_user.id)
    
    # 🌟 TÌM KIẾM BẰNG BEANIE
    if couple:
        # Nếu có người yêu:
        photos = await Gallery.find(Gallery.couple_id == str(couple.id)).sort("-created_at").to_list()
    else:
        # Nếu FA:
        photos = await Gallery.find(
            Gallery.user_id == str(current_user.id), 
            Gallery.couple_id == None
        ).sort("-created_at").to_list()
        
    # Format lại ID cho Frontend
    formatted_photos = [
        {
            "id": str(p.id),
            "image_url": p.image_url,
            "created_at": p.created_at.isoformat(),
            "likes": getattr(p, "likes", [])
        }
        for p in photos
    ]
        
    return formatted_photos 
# XOA ANH
@router.delete("/{photo_id}")
async def delete_photo(
    photo_id: str, 
    db_sql: AsyncSession = Depends(get_db), 
    current_user: Users = Depends(get_current_user)
):
    try:
        photo = await Gallery.get(PydanticObjectId(photo_id))
        if not photo:
            raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
        
        # Kiểm tra quyền: Chỉ cho xóa nếu là ảnh của mình hoặc ảnh chung của couple
        couple = await get_user_couple(db_sql, current_user.id)
        if str(photo.user_id) != str(current_user.id):
            if not couple or str(photo.couple_id) != str(couple.id):
                raise HTTPException(status_code=403, detail="Bạn không có quyền xóa ảnh này")

        # Có thể thêm logic dùng os.remove() để xóa file vật lý trong folder static ở đây

        await photo.delete()
        return {"success": True, "message": "Đã xóa ảnh"}
    except Exception:
        raise HTTPException(status_code=400, detail="ID ảnh không hợp lệ")

# THẢ TIM / BỎ TIM
@router.post("/{photo_id}/like")
async def toggle_like(
    photo_id: str, 
    current_user: Users = Depends(get_current_user)
):
    photo = await Gallery.get(PydanticObjectId(photo_id))
    if not photo:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    
    user_id_str = str(current_user.id)
    
    # Nếu đã tim rồi thì gỡ tim, chưa có thì thả tim
    if user_id_str in photo.likes:
        photo.likes.remove(user_id_str)
    else:
        photo.likes.append(user_id_str)
        
        # XỬ LÝ BẮN THÔNG BÁO REALTIME
        # Chỉ thông báo khi thả tim (không báo khi bỏ tim) 
        # và KHÔNG tự thông báo cho chính mình
        if photo.user_id != user_id_str:
            
            # 1. Lưu bản ghi thông báo vào MongoDB
            notif = Notification(
                user_id=photo.user_id, # Gửi cho chủ nhân bức ảnh
                actor_name=current_user.display_name,
                type="like",
                message="đã thả tim khoảnh khắc của hai bạn ❤️",
                link="/gallery"
            )
            await notif.insert()

            # 2. Bắn tín hiệu WebSocket cho người kia
            await manager.send_personal_message({
                "id": str(notif.id),
                "actor_name": notif.actor_name,
                "message": notif.message,
                "type": notif.type,
                "link": notif.link,
                "created_at": notif.created_at.isoformat()
            }, photo.user_id)
    
    await photo.save()
    return {"success": True, "likes": photo.likes}
