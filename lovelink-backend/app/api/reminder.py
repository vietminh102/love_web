from fastapi import APIRouter, Depends, HTTPException
from typing import List
from bson import ObjectId
from app.api.notifications import manager


from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
from app.api.email_sender import send_reminder_email

# Import từ project của bạn
from app.api.deps import get_current_user
from app.models.nosql import Reminder
from app.schemas.reminder import ReminderCreate, ReminderResponse
from app.models.nosql import Notification
from app.models.Users import Users

# Import DB và Model Couples của bạn
from app.api.deps import get_db 
from app.models.Couples import Couples # Chú ý tên model của bạn có chữ 's'

router = APIRouter()

# ==========================================
# 🌟 HÀM TÌM ID CẶP ĐÔI (CHUẨN ASYNC)
# ==========================================
async def get_couple_id(db: AsyncSession, user_id):
    # Dùng cú pháp select mới của SQLAlchemy 2.0+
    stmt = select(Couples).where(
        or_(Couples.user1_id == user_id, Couples.user2_id == user_id)
    )
    # Thực thi lệnh chờ (await)
    result = await db.execute(stmt)
    couple = result.scalars().first()
    
    return str(couple.id) if couple else None

# ==========================================
# 1. LẤY DANH SÁCH LỜI NHẮC
# ==========================================
@router.get("/reminders", response_model=List[ReminderResponse])
async def get_reminders(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 🌟 Thêm chữ await ở đây
    couple_id = await get_couple_id(db, current_user.id)
    
    if not couple_id:
        raise HTTPException(status_code=400, detail="Bạn chưa ghép đôi!")

    reminders = await Reminder.find({"couple_id": couple_id}).sort("+remind_time").to_list()
    
    result = []
    for r in reminders:
        r_dict = r.dict()
        r_dict["id"] = str(r.id)
        result.append(r_dict)
        
    return result

# ==========================================
# 2. TẠO LỜI NHẮC MỚI
# ==========================================
@router.post("/reminders", response_model=ReminderResponse)
async def create_reminder(
    reminder_in: ReminderCreate, 
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Tìm ID cặp đôi
    couple_id = await get_couple_id(db, current_user.id)
    if not couple_id:
        raise HTTPException(status_code=400, detail="Bạn chưa ghép đôi!")

    # 2. Tạo lời nhắc lưu vào DB
    new_reminder = Reminder(
        **reminder_in.dict(),
        couple_id=couple_id,
        created_by=str(current_user.id)
    )
    await new_reminder.insert()
    
    result = new_reminder.dict()
    result["id"] = str(new_reminder.id)

    # ==========================================
    # 🌟 GỬI THÔNG BÁO WEBSOCKET CHO ĐỐI PHƯƠNG
    # ==========================================
    try:
        stmt = select(Couples).where(Couples.id == couple_id)
        db_result = await db.execute(stmt)
        couple_obj = db_result.scalars().first()

        if couple_obj:
            partner_id = str(couple_obj.user1_id) if str(couple_obj.user1_id) != str(current_user.id) else str(couple_obj.user2_id)
            
            # 🌟 XỬ LÝ ÉP KIỂU THỜI GIAN TRƯỚC KHI GỬI
            time_val = result["remind_time"]
            time_str = time_val.isoformat() if hasattr(time_val, "isoformat") else str(time_val)
            
            # Gửi thẳng tín hiệu cài báo thức sang máy đối phương (Không tạo Notification rác)
            await manager.send_personal_message({
                "type": "sync_alarm",
                "id": result["id"],
                "title": result["title"],
                "message": result["message"],
                "time": time_str 
            }, partner_id)
            
    except Exception as e:
        print("Lỗi khi gửi báo thức WebSocket:", e)

    return result

# ==========================================
# 3. XÓA LỜI NHẮC
# ==========================================
@router.delete("/reminders/{reminder_id}")
async def delete_reminder(
    reminder_id: str, 
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 🌟 Thêm chữ await ở đây
    couple_id = await get_couple_id(db, current_user.id)
    
    reminder = await Reminder.get(ObjectId(reminder_id))
    
    if not reminder:
        raise HTTPException(status_code=404, detail="Không tìm thấy lời nhắc")
        
    if str(reminder.couple_id) != couple_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa lời nhắc này")

    await reminder.delete()
    return {"message": "Đã xóa thành công"}

@router.patch("/reminders/{reminder_id}/trigger")
async def trigger_reminder(
    reminder_id: str, 
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Lấy thông tin cặp đôi và báo thức
    couple_id = await get_couple_id(db, current_user.id)
    reminder = await Reminder.get(ObjectId(reminder_id))
    
    if not reminder or str(reminder.couple_id) != couple_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy lời nhắc")
        
    # 2. Xử lý tắt chuông và gửi Email
    if not getattr(reminder, "is_triggered", False):
        
        # Đánh dấu đã kêu
        reminder.is_triggered = True
        await reminder.save() 
        
        # NẾU CÓ YÊU CẦU GỬI MAIL
        if getattr(reminder, "send_email", False):
            
            # Bước A: Tìm xem đối phương là ai (Lấy ID)
            stmt_couple = select(Couples).where(Couples.id == couple_id)
            couple_obj = (await db.execute(stmt_couple)).scalars().first()
            
            if couple_obj:
                partner_id = couple_obj.user1_id if str(couple_obj.user1_id) != str(current_user.id) else couple_obj.user2_id
                
                # Bước B: Chạy vào bảng User để lấy thông tin đối phương
                stmt_partner = select(Users).where(Users.id == partner_id)
                partner_obj = (await db.execute(stmt_partner)).scalars().first()
                
                # Bước C: KIỂM TRA BẢO MẬT (Chỉ gửi nếu có email và email có chữ @)
                if partner_obj and partner_obj.email and "@" in partner_obj.email:
                    # Gửi mail cho đối phương
                    asyncio.create_task(send_reminder_email(
                        partner_obj.email, 
                        reminder.title, 
                        reminder.message
                    ))
                else:
                    print(f"Bỏ qua gửi mail vì user {partner_id} không có Email hợp lệ.")
                
                # Gửi thêm cho chính bạn (Nếu tài khoản của bạn cũng có email)
                if current_user.email and "@" in current_user.email:
                    asyncio.create_task(send_reminder_email(
                        current_user.email, 
                        reminder.title, 
                        reminder.message
                    ))

    return {"message": "Đã xử lý xong"}

@router.get("/reminders/check-email-status")
async def check_email_status(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    couple_id = await get_couple_id(db, current_user.id)
    if not couple_id:
        return {"can_use_email": False}

    stmt = select(Couples).where(Couples.id == couple_id)
    couple_obj = (await db.execute(stmt)).scalars().first()
    
    if couple_obj:
        partner_id = couple_obj.user1_id if str(couple_obj.user1_id) != str(current_user.id) else couple_obj.user2_id
        
        stmt_partner = select(Users).where(Users.id == partner_id)
        partner_obj = (await db.execute(stmt_partner)).scalars().first()
        
        # Kiểm tra xem cột email của cả 2 có chứa dấu "@" không
        my_email_ok = current_user.email and "@" in current_user.email
        partner_email_ok = partner_obj and partner_obj.email and "@" in partner_obj.email
        
        return {"can_use_email": bool(my_email_ok and partner_email_ok)}
    
    return {"can_use_email": False}