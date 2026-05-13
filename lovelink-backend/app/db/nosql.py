# File: D:\Personal Project\lovelink\lovelink-backend\app\db\nosql.py

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
# Tạm thời comment dòng này nếu bạn chưa tạo file models/nosql.py
# from app.models.nosql import Diary, Message 

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

mongodb = MongoDB()

async def connect_to_mongo():
    try:
        mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
        mongodb.db = mongodb.client[settings.MONGODB_NAME]
        
        # Nếu chưa có models thì comment dòng init_beanie này lại để test kết nối trước
        # await init_beanie(database=mongodb.db, document_models=[Diary, Message])
        
        print("✅ Đã kết nối MongoDB thành công!")
    except Exception as e:
        print(f"❌ Lỗi kết nối MongoDB: {e}")

async def close_mongo_connection():
    if mongodb.client:
        mongodb.client.close()
        print("🔌 Đã ngắt kết nối MongoDB")