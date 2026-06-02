from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.db.nosql import connect_to_mongo, close_mongo_connection
from app.api import auth, diary, gallery, notifications, lucky_wheel,video_sync,reminder,music,chat
from app.api import couple
import asyncio
from sqlalchemy import select
from datetime import datetime, timezone
from app.api.notifications import check_and_send_milestones
from app.models.nosql import Reminder
from app.api.email_sender import send_reminder_email

from app.db.sql import get_db, engine
from app.models.postgres import Base
from app.models.Couples import Couples 
from app.models.Users import Users


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

async def background_alarm_worker():
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            
            # Tìm các báo thức quá hạn chưa kích hoạt
            overdue_reminders = await Reminder.find(
                {"is_triggered": False, "remind_time": {"$lte": now_utc}}
            ).to_list()

            if overdue_reminders:
                async for db in get_db():
                    for r in overdue_reminders:
                        # Đánh dấu đã kích hoạt lập tức để tránh trùng lặp
                        r.is_triggered = True
                        await r.save()
                        
                        if getattr(r, "send_email", False):
                            stmt_couple = select(Couples).where(Couples.id == str(r.couple_id))
                            couple_obj = (await db.execute(stmt_couple)).scalars().first()
                            
                            if couple_obj:
                                # 1. Xác định ID người nhận (đối phương)
                                partner_id = couple_obj.user1_id if str(couple_obj.user1_id) != str(r.created_by) else couple_obj.user2_id
                                
                                # 2. Truy vấn lấy thông tin đối phương
                                stmt_partner = select(Users).where(Users.id == partner_id)
                                partner_obj = (await db.execute(stmt_partner)).scalars().first()
                                
                                # 3. Truy vấn lấy thông tin người tạo (chính bạn)
                                stmt_creator = select(Users).where(Users.id == r.created_by)
                                creator_obj = (await db.execute(stmt_creator)).scalars().first()
                                
                                email_tasks = []
                                
                                # Kiểm tra và thêm tác vụ gửi mail cho đối phương
                                if partner_obj and partner_obj.email and "@" in partner_obj.email:
                                    email_tasks.append(send_reminder_email(partner_obj.email, r.title, r.message))
                                    
                                # Kiểm tra và thêm tác vụ gửi mail cho chính bạn
                                if creator_obj and creator_obj.email and "@" in creator_obj.email:
                                    email_tasks.append(send_reminder_email(creator_obj.email, r.title, r.message))
                                
                                # Đồng thời kích hoạt gửi email cho cả hai tài khoản hợp lệ
                                if email_tasks:
                                    await asyncio.gather(*email_tasks)
                    break 
        except Exception as e:
            print(f"❌ Lỗi Bác bảo vệ chạy ngầm: {e}")
            
        # Hệ thống đi tuần định kỳ mỗi 1 phút (60 giây)
        await asyncio.sleep(60)
# KÍCH HOẠT BÁC BẢO VỆ KHI SERVER VỪA BẬT LÊN
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(background_alarm_worker())
    print("🚀 Bác bảo vệ canh báo thức Email đã thức dậy!")

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
app.include_router(video_sync.router)
app.include_router(music.router)
app.include_router(chat.router)
app.include_router(reminder.router)

@app.get("/")
async def root():
    return {"message": "Welcome to Lovelink API!"}

# uvicorn app.main:app --reload