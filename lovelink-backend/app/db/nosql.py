from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
# Tạm thời comment dòng này nếu bạn chưa tạo file models/nosql.py
from app.models.nosql import Diary, Gallery 

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

mongodb = MongoDB()

async def connect_to_mongo():
    try:
        # 1. Khởi tạo Client
        mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
        
        # 2. Khởi tạo Database (Dùng ngoặc vuông [])
        mongodb.db = mongodb.client[settings.MONGODB_NAME]
        
        # 3. Kích hoạt Beanie (Đảm bảo truyền mongodb.db vào chữ database)
        await init_beanie(database=mongodb.db, document_models=[Diary, Gallery])
        
        print("✅ Đã kết nối MongoDB và khởi tạo Beanie thành công!")
    except Exception as e:
        print(f"❌ Lỗi kết nối MongoDB: {e}")

async def close_mongo_connection():
    if mongodb.client:
        mongodb.client.close()
        print("🔌 Đã ngắt kết nối MongoDB")