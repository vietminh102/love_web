from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from app.models.nosql import Diary  # Import Model Beanie
from app.models.Users import Users
from app.api.deps import get_current_user # Để biết ai đang đăng bài
from beanie import PydanticObjectId
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.sql import get_db
from app.models.Couples import Couples
import shutil
import uuid
import os

router = APIRouter()

@router.post("/diaries")
async def create_diary(
    title: str = Form(...),
    content: str = Form(...),
    date: str = Form(...),
    location: str = Form(None),
    visibility: str = Form("couple"), # Mặc định là cả hai cùng xem
    image: UploadFile = File(None),
    current_user: Users = Depends(get_current_user) # BẮT BUỘC ĐĂNG NHẬP
):
    image_url = None
    
    # 1. Xử lý lưu file ảnh
    if image:
        os.makedirs("static/diaries", exist_ok=True)
        file_ext = image.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = f"static/diaries/{file_name}"
        
        with open(file_path, "wb+") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        image_url = f"http://localhost:8000/{file_path}"

    # 2. Tạo nhật ký
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
    
    return {
        "message": "Đã lưu nhật ký tình yêu!", 
        "id": str(new_diary.id),
        "image_url": image_url
    }

@router.get("/diaries")
async def get_all_diaries(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db) # Bổ sung db session của Postgres
):
    """
    Lấy nhật ký CHUẨN BẢO MẬT: 
    Chỉ lấy bài của mình (tất cả) và bài của người yêu (chế độ couple).
    Tuyệt đối không lọt bài của cặp đôi khác vào.
    """
    my_id = str(current_user.id)
    partner_id = None

    # 1. Tìm thông tin cặp đôi trong PostgreSQL để lấy ID người yêu
    stmt = select(Couples).where(
        (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
    )
    result = await db.execute(stmt)
    couple = result.scalars().first()

    # Xác định ID của đối phương (nếu đã ghép đôi)
    if couple and couple.user1_id and couple.user2_id:
        partner_id = str(couple.user2_id if couple.user1_id == current_user.id else couple.user1_id)

    # 2. Xây dựng câu lệnh truy vấn MongoDB an toàn
    if partner_id:
        # Nếu ĐÃ CÓ BỒ: Được xem tất cả bài của mình + bài 'couple' của bồ
        query = {
            "$or": [
                {"author_id": my_id}, # Bài của mình (kể cả private hay couple)
                {"author_id": partner_id, "visibility": "couple"} # Bài của bồ (phải là couple mới được xem)
            ]
        }
    else:
        # Nếu ĐANG FA: Chỉ được xem bài của chính mình (chặn đứng mọi truy cập khác)
        query = {"author_id": my_id}

    # 3. Lấy dữ liệu và sắp xếp theo ngày mới nhất
    diaries = await Diary.find(query).sort("-created_at").to_list()
    
    return diaries

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
    # 1. Tìm bài viết theo ID
    diary = await Diary.get(PydanticObjectId(diary_id))
    if not diary:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký")

    # 2. Kiểm tra quyền (Chỉ người viết mới được sửa)
    if diary.author_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa bài viết của người ấy!")

    # 3. Cập nhật ảnh mới (nếu có)
    if image:
        file_ext = image.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = f"static/diaries/{file_name}"
        
        with open(file_path, "wb+") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        diary.image_url = f"http://localhost:8000/{file_path}"

    # 4. Cập nhật các trường text
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

    # Chỉ người viết mới được quyền xóa
    if diary.author_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài viết này!")

    await diary.delete()
    return {"message": "Đã xóa nhật ký!"}
@router.post("/diaries/{diary_id}/like")
async def toggle_like_diary(
    diary_id: str,
    current_user: Users = Depends(get_current_user)
):
    # 1. Tìm bài nhật ký
    diary = await Diary.get(PydanticObjectId(diary_id))
    if not diary:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhật ký")

    user_id_str = str(current_user.id)
    
    # 2. Xử lý thả tim / bỏ tim
    if user_id_str in diary.liked_by:
        diary.liked_by.remove(user_id_str) # Nếu đã tim rồi -> Bỏ tim
        is_liked = False
    else:
        diary.liked_by.append(user_id_str) # Nếu chưa tim -> Thêm tim
        is_liked = True

    await diary.save()
    
    return {
        "message": "Thành công", 
        "is_liked": is_liked, 
        "total_likes": len(diary.liked_by)
    }