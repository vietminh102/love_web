import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv

# Tải biến môi trường từ file .env
load_dotenv()

# Cấu hình Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

def upload_image_to_cloud(file_obj, folder_name="lovelink"):
    """
    Hàm đẩy ảnh lên Cloudinary
    - file_obj: file nhận được từ FastAPI (UploadFile.file)
    - folder_name: Tên thư mục trên Cloudinary để dễ quản lý (vd: lovelink/avatars)
    """
    try:
        # Gửi ảnh bay lên mây
        result = cloudinary.uploader.upload(
            file_obj, 
            folder=folder_name
        )
       
        return result.get("secure_url")
    except Exception as e:
        print(f"❌ Lỗi up ảnh Cloudinary: {e}")
        return None