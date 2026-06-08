from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from app.models.nosql import Diary  
from app.models.Users import Users
from app.api.deps import get_current_user 
from beanie import PydanticObjectId
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.sql import get_db
from app.models.Couples import Couples
from app.api.notifications import manager
from app.models.nosql import Notification
from app.api.cloudinary_utils import upload_image_to_cloud




router = APIRouter()



@router.get("/diaries")
async def get_all_diaries(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db) 
):

    my_id = str(current_user.id)
    partner_id = None

    #  Tìm thông tin cặp đôi 
    stmt = select(Couples).where(
        (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
    )
    result = await db.execute(stmt)
    couple = result.scalars().first()

    # Xác định ID của đối phương
    if couple and couple.user1_id and couple.user2_id:
        partner_id = str(couple.user2_id if couple.user1_id == current_user.id else couple.user1_id)


    if partner_id:
        # Nếu ĐÃ CÓ BỒ: Được xem tất cả bài của mình + bài 'couple' của bồ
        query = {
            "$or": [
                {"author_id": my_id}, 
                {"author_id": partner_id, "visibility": "couple"}
            ]
        }
    else:
        query = {"author_id": my_id}

    #  Lấy dữ liệu và sắp xếp theo ngày mới nhất
    diaries = await Diary.find(query).sort("-created_at").to_list()
    
    return diaries

@router.post("/diaries")
async def create_diary(
    title: str = Form(...),
    content: str = Form(...),
    date: str = Form(...),
    location: str = Form(None),
    visibility: str = Form("couple"), 
    image: UploadFile = File(None),
    current_user: Users = Depends(get_current_user), 
    db_sql: AsyncSession = Depends(get_db) 
):
    image_url = None
    
    if image:
        cloud_url = upload_image_to_cloud(image.file, folder_name="lovelink/diaries")
        if not cloud_url:
            raise HTTPException(status_code=400, detail="Không thể tải ảnh đính kèm lên mây lúc này!")
        image_url = cloud_url

    # Tạo nhật ký
    new_diary = Diary(
        title=title,
        content=content,
        date=date,
        location=location,
        image_url=image_url,
        author_id=str(current_user.id),
        visibility=visibility
    )
    
    await new_diary.insert()
    
    #  THÔNG BÁO 
    if visibility == "couple":
        result = await db_sql.execute(
            select(Couples).where(
                (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
            )
        )
        couple = result.scalars().first()

        if couple and couple.user1_id and couple.user2_id:
            current_user_id_str = str(current_user.id)
            user1_id_str = str(couple.user1_id)
            user2_id_str = str(couple.user2_id)
            
            partner_id = user2_id_str if current_user_id_str == user1_id_str else user1_id_str

            notif = Notification(
                user_id=partner_id,
                actor_name=current_user.display_name,
                type="diary",
                message="vừa viết một nhật ký mới đầy ngọt ngào 📝",
                link="/diary"
            )
            await notif.insert()

            await manager.send_personal_message({
                "id": str(notif.id),
                "actor_name": notif.actor_name,
                "message": notif.message,
                "type": notif.type,
                "link": notif.link,
                "created_at": notif.created_at.isoformat()
            }, partner_id)

    return {
        "message": "Đã lưu nhật ký tình yêu!", 
        "id": str(new_diary.id),
        "image_url": image_url
    }

@router.put("/diaries/{diary_id}")
async def update_diary(
    diary_id: str,
    title: str = Form(None),
    content: str = Form(None),
    date: str = Form(None),
    location: str = Form(None),
    visibility: str = Form(None),
    image: UploadFile = File(None),
    current_user: Users = Depends(get_current_user)
):
    # Tìm bài viết theo ID
    diary = await Diary.get(PydanticObjectId(diary_id))
    if not diary:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký")

    # Kiểm tra quyền
    if diary.author_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa bài viết của người ấy!")

    #Cập nhật ảnh mới
    if image:
        cloud_url = upload_image_to_cloud(image.file, folder_name="lovelink/diaries")
        if not cloud_url:
            raise HTTPException(status_code=400, detail="Không thể cập nhật ảnh lên mây lúc này!")
        diary.image_url = cloud_url

    # Cập nhật các trường text
    if title: diary.title = title
    if content: diary.content = content
    if date: diary.date = date
    if location is not None: diary.location = location
    if visibility: diary.visibility = visibility

    await diary.save()
    return {"message": "Đã cập nhật nhật ký thành công!"}

@router.delete("/diaries/{diary_id}")
async def delete_diary(
    diary_id: str,
    current_user: Users = Depends(get_current_user)
):
    diary = await Diary.get(PydanticObjectId(diary_id))
    if not diary:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký")

    if diary.author_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài viết này!")
    await diary.delete()
    
    return {"message": "Đã xóa nhật ký!"}
@router.post("/diaries/{diary_id}/like")
async def toggle_like_diary(
    diary_id: str,
    current_user: Users = Depends(get_current_user)
):
    # Tìm bài nhật ký
    diary = await Diary.get(PydanticObjectId(diary_id))
    if not diary:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký")

    user_id_str = str(current_user.id)
    
    # Xử lý thả tim / bỏ tim
    if user_id_str in diary.liked_by:
        diary.liked_by.remove(user_id_str) 
        is_liked = False
    else:
        diary.liked_by.append(user_id_str) 
        is_liked = True
        
        #Thông báo
        if diary.author_id != user_id_str:
            
            # Lưu vào MongoDB
            notif = Notification(
                user_id=diary.author_id,
                actor_name=current_user.display_name,
                type="diary_like",
                message="đã thả tim bài nhật ký của bạn ❤️",
                link=f"/diary?diaryId={diary_id}" 
            )
            await notif.insert()

            # Bắn tín hiệu WebSocket
            await manager.send_personal_message({
                "id": str(notif.id),
                "actor_name": notif.actor_name,
                "message": notif.message,
                "type": notif.type,
                "is_read": notif.is_read,
                "link": notif.link,
                "created_at": notif.created_at.isoformat()
            }, diary.author_id)

    await diary.save()
    
    return {
        "message": "Thành công", 
        "is_liked": is_liked, 
        "total_likes": len(diary.liked_by)
    }