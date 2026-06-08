from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
# Tạm thời comment dòng này nếu bạn chưa tạo file models/nosql.py
from app.models.nosql import Diary, Gallery, Notification, WheelData, Reminder, ChatMessage

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

mongodb = MongoDB()

async def connect_to_mongo():
    try:
        # Khởi tạo Client
        mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
        
        # Khởi tạo Database
        mongodb.db = mongodb.client[settings.MONGODB_NAME]
        
        # Kích hoạt Beanie 
        await init_beanie(database=mongodb.db, document_models=[Diary, Gallery, Notification,WheelData,Reminder, ChatMessage])
        
        print("✅ Đã kết nối MongoDB và khởi tạo Beanie thành công!")
    except Exception as e:
        print(f"❌ Lỗi kết nối MongoDB: {e}")

async def close_mongo_connection():
    if mongodb.client:
        mongodb.client.close()
        print("🔌 Đã ngắt kết nối MongoDB")