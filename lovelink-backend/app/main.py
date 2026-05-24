from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.db.nosql import connect_to_mongo, close_mongo_connection
from app.api import auth, diary, gallery, notifications, lucky_wheel
from fastapi.staticfiles import StaticFiles
from app.api import couple
import asyncio
from app.api.notifications import check_and_send_milestones

from app.db.sql import get_db, engine
from app.models.postgres import Base

get_db_context = asynccontextmanager(get_db)

# Hàm lặp ngầm định kỳ
async def run_milestone_scheduler():
    while True:
        try:
            async with get_db_context() as db_session:
                await check_and_send_milestones(db_session)
                
        except Exception as e:
            print(f"Lỗi khi chạy quét ngày kỷ niệm: {e}")
            
        # Nghỉ ngơi 12 tiếng rồi quét lại tiếp (12 * 60 * 60 giây = 43200)
        await asyncio.sleep(43200)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 👇 Ra lệnh cho Postgres xây nhà dựa trên bản vẽ (Base)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Đã kiểm tra và tạo các bảng Postgres thành công!")
    except Exception as e:
        print(f"Lỗi khi tạo bảng Postgres: {e}")

    # Chạy khi server khởi động
    await connect_to_mongo()
    print("✅ Đã kết nối MongoDB và khởi tạo Beanie thành công!")
    print("🚀 Server đang chạy...")
    
    asyncio.create_task(run_milestone_scheduler())
    yield
    # Chạy khi server tắt
    await close_mongo_connection()

app = FastAPI(lifespan=lifespan)

# app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://love-web-steel.vercel.app"], 
    allow_credentials=True,
    allow_methods=["*"], # Cho phép GET, POST, PUT, DELETE...
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(couple.router)
app.include_router(diary.router)
app.include_router(gallery.router)
app.include_router(notifications.router)
app.include_router(lucky_wheel.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Lovelink API!"}

# uvicorn app.main:app --reload