# File: app/api/diary.py
from fastapi import APIRouter, UploadFile, File, Form
from app.models.nosql import Diary  # Import Model Beanie
import shutil
import uuid
import os
from typing import List

router = APIRouter()

@router.post("/diaries")
async def create_diary(
    title: str = Form(...),
    content: str = Form(...),
    date: str = Form(...),
    location: str = Form(None),
    image: UploadFile = File(None)
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
            
        image_url = f"http://localhost:8000/static/diaries/{file_name}"

    # 2. TẠO VÀ LƯU NHẬT KÝ BẰNG BEANIE (Siêu sạch sẽ)
    new_diary = Diary(
        title=title,
        content=content,
        date=date,
        location=location,
        image_url=image_url
    )
    
    # Lưu thẳng vào Database chỉ với 1 dòng lệnh
    await new_diary.insert()
    
    return {
        "message": "Đã lưu nhật ký tình yêu!", 
        "id": str(new_diary.id), # Beanie tự động xử lý ObjectId giúp bạn
        "image_url": image_url
    }
@router.get("/diaries")
async def get_all_diaries():
    # Lấy toàn bộ nhật ký từ MongoDB, sắp xếp theo thời gian mới nhất (giảm dần)
    diaries = await Diary.find_all().sort("-created_at").to_list()
    return diaries