from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.db.nosql import connect_to_mongo, close_mongo_connection
from app.api import auth, diary, gallery, notifications
from fastapi.staticfiles import StaticFiles
from app.api import  couple
from app.db.sql import get_db
import asyncio
from contextlib import asynccontextmanager
from app.api.notifications import check_and_send_milestones

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
    # Chạy khi server khởi động
    await connect_to_mongo()
    print("🚀 Server đang chạy...")
    asyncio.create_task(run_milestone_scheduler())
    yield
    # Chạy khi server tắt
    await close_mongo_connection()

app = FastAPI(lifespan=lifespan)


app.mount("/static", StaticFiles(directory="static"), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"], # Cho phép GET, POST, PUT, DELETE...
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api")
app.include_router(couple.router, prefix="/api")
app.include_router(diary.router, prefix="/api")
app.include_router(gallery.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
@app.get("/")
async def root():
    return {"message": "Welcome to Lovelink API!"}

# uvicorn app.main:app --reload