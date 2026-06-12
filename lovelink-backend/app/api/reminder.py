from fastapi import APIRouter, Depends, HTTPException
from typing import List
from bson import ObjectId
from datetime import datetime
import asyncio
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.notifications import manager
from app.api.email_sender import send_reminder_email
from app.api.deps import get_current_user, get_db
from app.models.nosql import Reminder, Notification
from app.schemas.reminder import ReminderCreate, ReminderResponse
from app.models.Users import Users
from app.models.Couples import Couples

router = APIRouter()

# HÀM TÌM ID CẶP ĐÔI
async def get_couple_id(db: AsyncSession, user_id):
    stmt = select(Couples).where(
        or_(Couples.user1_id == user_id, Couples.user2_id == user_id)
    )
    result = await db.execute(stmt)
    couple = result.scalars().first()
    return str(couple.id) if couple else None


# LẤY DANH SÁCH LỜI NHẮC
@router.get("/reminders", response_model=List[ReminderResponse])
async def get_reminders(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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


# 🌟 TẠO LỜI NHẮC MỚI (VÀ GỬI EMAIL NGAY LẬP TỨC)
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

    # 🌟 3. XỬ LÝ GỬI EMAIL BÁO THỨC (.ICS)
    if reminder_in.send_email:
        try:
            # Ép kiểu thời gian chuẩn bị cho thư viện Email
            time_val = reminder_in.remind_time
            if isinstance(time_val, str):
                clean_time = time_val.replace("Z", "+00:00")
                dt_object = datetime.fromisoformat(clean_time)
            else:
                dt_object = time_val

            stmt_couple = select(Couples).where(Couples.id == couple_id)
            couple_obj = (await db.execute(stmt_couple)).scalars().first()

            if couple_obj:
                partner_id = str(couple_obj.user1_id) if str(couple_obj.user1_id) != str(current_user.id) else str(couple_obj.user2_id)
                
                stmt_partner = select(Users).where(Users.id == partner_id)
                partner_obj = (await db.execute(stmt_partner)).scalars().first()

                # Gửi Email cho Nửa kia
                if partner_obj and partner_obj.email and "@" in partner_obj.email:
                    asyncio.create_task(send_reminder_email(
                        to_email=partner_obj.email, 
                        title=reminder_in.title, 
                        message_content=reminder_in.message,
                        remind_time=dt_object # Khớp biến thời gian
                    ))
                
                # Gửi Email cho Chính mình
                if current_user.email and "@" in current_user.email:
                    asyncio.create_task(send_reminder_email(
                        to_email=current_user.email, 
                        title=reminder_in.title, 
                        message_content=reminder_in.message,
                        remind_time=dt_object # Khớp biến thời gian
                    ))
        except Exception as e:
            print("Lỗi khi xử lý gửi email báo thức:", e)

    # 4. GỬI THÔNG BÁO WEBSOCKET CHO ĐỐI PHƯƠNG
    try:
        if 'partner_id' in locals():
            time_str = dt_object.isoformat() if 'dt_object' in locals() else str(reminder_in.remind_time)
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


# XÓA LỜI NHẮC
@router.delete("/reminders/{reminder_id}")
async def delete_reminder(
    reminder_id: str, 
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    couple_id = await get_couple_id(db, current_user.id)
    reminder = await Reminder.get(ObjectId(reminder_id))
    
    if not reminder:
        raise HTTPException(status_code=404, detail="Không tìm thấy lời nhắc")
        
    if str(reminder.couple_id) != couple_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa lời nhắc này")

    await reminder.delete()
    return {"message": "Đã xóa thành công"}


# ĐÁNH DẤU LỜI NHẮC ĐÃ KÊU
@router.patch("/reminders/{reminder_id}/trigger")
async def trigger_reminder(
    reminder_id: str, 
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    couple_id = await get_couple_id(db, current_user.id)
    reminder = await Reminder.get(ObjectId(reminder_id))
    
    if not reminder or str(reminder.couple_id) != couple_id:
        raise HTTPException(status_code=404, detail="Không tìm thấy lời nhắc")
        
    if not getattr(reminder, "is_triggered", False):
        
        # 1. Đánh dấu đã kêu trên giao diện
        reminder.is_triggered = True
        await reminder.save() 
        
        # 2. KHÔI PHỤC TÍNH NĂNG: GỬI EMAIL BÁO ĐỘNG (LÚC CHUÔNG REO)
        if getattr(reminder, "send_email", False):
            stmt_couple = select(Couples).where(Couples.id == couple_id)
            couple_obj = (await db.execute(stmt_couple)).scalars().first()
            
            if couple_obj:
                partner_id = couple_obj.user1_id if str(couple_obj.user1_id) != str(current_user.id) else couple_obj.user2_id
                stmt_partner = select(Users).where(Users.id == partner_id)
                partner_obj = (await db.execute(stmt_partner)).scalars().first()
                
                # Gửi cho Nửa kia (Chú ý: remind_time=None)
                if partner_obj and partner_obj.email and "@" in partner_obj.email:
                    asyncio.create_task(send_reminder_email(
                        partner_obj.email, reminder.title, reminder.message, None
                    ))
                
                # Gửi cho Mình (Chú ý: remind_time=None)
                if current_user.email and "@" in current_user.email:
                    asyncio.create_task(send_reminder_email(
                        current_user.email, reminder.title, reminder.message, None
                    ))

    return {"message": "Đã tắt chuông và báo động Email thành công!"}


# KIỂM TRA QUYỀN GỬI EMAIL
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
        
        my_email_ok = current_user.email and "@" in current_user.email
        partner_email_ok = partner_obj and partner_obj.email and "@" in partner_obj.email
        
        return {"can_use_email": bool(my_email_ok and partner_email_ok)}
    
    return {"can_use_email": False}