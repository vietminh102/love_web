from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
import jwt
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.sql import get_db
from app.core.config import settings
from app.models.Users import Users
from app.models.Couples import Couples
from app.api.deps import get_current_user
from app.models.nosql import Notification
from beanie import PydanticObjectId
from fastapi import HTTPException
from datetime import datetime, date, timedelta, timezone
import json

router = APIRouter(prefix="/notifications", tags=["Notifications"])

async def check_and_send_milestones(db_sql):
    # XỬ LÝ THỜI GIAN CHUẨN MỰC
    VN_TZ = timezone(timedelta(hours=7))
    now_vn = datetime.now(VN_TZ)
    today = now_vn.date()
    
   
    start_of_today_vn = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_today_utc = start_of_today_vn.astimezone(timezone.utc)
    
    result = await db_sql.execute(select(Couples))
    couples = result.scalars().all()
    
    for couple in couples:
        if not couple.user1_id or not couple.user2_id:
            continue
            
        u1_id = str(couple.user1_id)
        u2_id = str(couple.user2_id)
        
        u1 = await db_sql.get(Users, couple.user1_id)
        u2 = await db_sql.get(Users, couple.user2_id)
        if not u1 or not u2:
            continue

        # KIỂM TRA & GỬI THÔNG BÁO SINH NHẬT
        for user_chinh, doi_phuong in [(u1, u2), (u2, u1)]:
            bday_raw = getattr(user_chinh, 'dob', None)
            if bday_raw:
                if isinstance(bday_raw, datetime):
                    if bday_raw.tzinfo is None:
                        bday_raw = bday_raw.replace(tzinfo=timezone.utc)
                    bday = bday_raw.astimezone(VN_TZ).date()
                else:
                    bday = bday_raw

                if bday.month == today.month and bday.day == today.day:
                    exists = await Notification.find(
                        Notification.user_id == str(doi_phuong.id),
                        Notification.type == "birthday_milestone",
                        Notification.created_at >= start_of_today_utc
                    ).first_or_none()
                    
                    if not exists:
                        notif = Notification(
                            user_id=str(doi_phuong.id),
                            actor_name=user_chinh.display_name,
                            type="birthday_milestone",
                            message="Hôm nay là sinh nhật của người ấy đó! Đừng quên gửi lời chúc ngọt ngào nhé 🎂",
                            link="/diary"
                        )
                        await notif.insert()
                        
                        
                        notif_dt = notif.created_at
                        if notif_dt.tzinfo is None:
                            notif_dt = notif_dt.replace(tzinfo=timezone.utc)
                        
                        # Phát sóng WebSocket với thời gian chuẩn có múi giờ
                        await manager.send_personal_message({
                            "id": str(notif.id), 
                            "actor_name": notif.actor_name, 
                            "message": notif.message,
                            "type": notif.type, 
                            "is_read": False, 
                            "link": notif.link, 
                            "created_at": notif_dt.isoformat() 
                        }, str(doi_phuong.id))

        # KIỂM TRA & GỬI THÔNG BÁO NGÀY YÊU
        start_date_raw = getattr(couple, 'start_date', None)
        if start_date_raw:

            if not isinstance(start_date_raw, datetime):
                start_date_raw = datetime.combine(start_date_raw, datetime.min.time())
            
            if start_date_raw.tzinfo is None:
                start_date_exact = start_date_raw.replace(tzinfo=VN_TZ)
            else:
                start_date_exact = start_date_raw.astimezone(VN_TZ)

            diff_seconds = (now_vn - start_date_exact).total_seconds()
            
            # Bỏ qua nếu bắt đầu ở trong tương lai
            if diff_seconds < 0:
                continue
                

            days_together = int(diff_seconds // 86400) 

            is_special_days = (days_together % 100 == 0 and days_together != 0)
            
            # Kỷ niệm Năm 
            start_date_raw = getattr(couple, 'start_date', None)
        if start_date_raw:
            if not isinstance(start_date_raw, datetime):
                start_date_raw = datetime.combine(start_date_raw, datetime.min.time())
            
            if start_date_raw.tzinfo is None:
                start_date_raw = start_date_raw.replace(tzinfo=timezone.utc)
            start_date_exact = start_date_raw.astimezone(VN_TZ)

            # Tính toán bằng Đồng hồ (tính theo giây)
            diff_seconds = (now_vn - start_date_exact).total_seconds()
            
            if diff_seconds < 0:
                continue
                
            days_together = int(diff_seconds // 86400) 

            # Kiểm tra mốc 100, 200, 300
            is_special_days = (days_together % 100 == 0 and days_together != 0)
            
            # Năm 
            start_date_calendar = start_date_exact.date()
            is_anniversary_year = (start_date_calendar.month == today.month and start_date_calendar.day == today.day and today.year > start_date_calendar.year)

            if is_special_days or is_anniversary_year:
                for user_nhan in [u1_id, u2_id]:
                    exists = await Notification.find(
                        Notification.user_id == user_nhan,
                        Notification.type == "anniversary_milestone", 
                        Notification.created_at >= start_of_today_utc
                    ).first_or_none()
                    
                    if not exists:
                        if is_anniversary_year:
                            years = today.year - start_date_calendar.year
                            msg = f"Hôm nay là tròn trĩnh {years} năm ngày hai bạn chính thức thuộc về nhau! Happy Anniversary! 💖"
                        else:
                            msg = f"Chúc mừng hai bạn đã bên nhau chạm mốc hành trình {days_together} ngày yêu thương! 🎉"

                        notif = Notification(
                            user_id=user_nhan,
                            actor_name="LoveLink",
                            type="anniversary_milestone",
                            message=msg,
                            link="/diary"
                        )
                        await notif.insert()
                        

                        notif_dt = notif.created_at
                        if notif_dt.tzinfo is None:
                            notif_dt = notif_dt.replace(tzinfo=timezone.utc)

                        await manager.send_personal_message({
                            "id": str(notif.id), 
                            "actor_name": notif.actor_name, 
                            "message": notif.message,
                            "type": notif.type, 
                            "is_read": False, 
                            "link": notif.link, 
                            "created_at": notif_dt.isoformat()
                        }, user_nhan)
# TRẠM PHÁT SÓNG WEBSOCKET 
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

# API Lấy danh sách thông báo cũ 
@router.get("/")
async def get_notifications(current_user: Users = Depends(get_current_user)):
    # Lấy 20 thông báo gần nhất
    notifications = await Notification.find(
        Notification.user_id == str(current_user.id)
    ).sort("-created_at").limit(20).to_list()
    
    return [
        {
            "id": str(n.id),
            "actor_name": n.actor_name,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "link": n.link,
            "created_at": n.created_at.isoformat()
        } for n in notifications
    ]

# KẾT NỐI WEBSOCKET
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None): 
    """Client sẽ kết nối vào đây bằng ws://.../ws?token=ABC"""
    try:
        if not token or token == "null" or token == "undefined":
            print("❌ WebSocket bị từ chối: Không có token")
            await websocket.close(code=1008)
            return
            
        # DỌN RÁC TOKEN
        clean_token = token.replace("Bearer ", "").replace('"', '').replace("'", "")
        
        # Giải mã token
        payload = jwt.decode(clean_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = str(payload.get("sub"))
        
    except Exception as e:
        print(f"❌ Lỗi giải mã Token WebSocket: {str(e)}") 
        await websocket.close(code=1008)
        return

    # Kết nối
    await manager.connect(websocket, user_id)
    print(f"✅ User {user_id} đã kết nối Realtime thành công!")
    
    try:
        while True:
          
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        print(f"⚠️ User {user_id} đã ngắt kết nối.")
@router.post("/{notif_id}/read")
async def mark_as_read(notif_id: str, current_user: Users = Depends(get_current_user)):
    try:
        # Tìm thông báo trong MongoDB bằng ID
        notif = await Notification.get(PydanticObjectId(notif_id))
        
        # Kiểm tra nếu thông báo tồn tại và thuộc về đúng user đang đăng nhập
        if notif and notif.user_id == str(current_user.id):
            notif.is_read = True 
            await notif.save()   
            return {"success": True}
            
        return {"success": False, "detail": "Không tìm thấy thông báo"}
    except Exception:
        return {"success": False, "detail": "ID thông báo không hợp lệ"}
# XÓA MỘT THÔNG BÁO CỤ THỂ
@router.delete("/{notif_id}")
async def delete_notification(
    notif_id: str, 
    current_user: Users = Depends(get_current_user)
):
    try:
        notif = await Notification.get(PydanticObjectId(notif_id))
        
        # Kiểm tra nếu thông báo tồn tại và thuộc về đúng người đang đăng nhập
        if notif and notif.user_id == str(current_user.id):
            await notif.delete() 
            return {"success": True, "message": "Đã xóa thông báo"}
            
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")
    except Exception:
        raise HTTPException(status_code=400, detail="ID không hợp lệ")

# XÓA SẠCH TẤT CẢ THÔNG BÁO CỦA USER
@router.delete("/clear/all")
async def clear_all_notifications(
    current_user: Users = Depends(get_current_user)
):
    try:
        # Tìm tất cả thông báo của user này và xóa hàng loạt
        await Notification.find(Notification.user_id == str(current_user.id)).delete()
        return {"success": True, "message": "Đã xóa toàn bộ thông báo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/test-milestones")
async def trigger_test_milestones(db_sql: AsyncSession = Depends(get_db)):
    try:
        await check_and_send_milestones(db_sql)
        return {"success": True, "message": "Đã chạy quét sự kiện thành công! Hãy kiểm tra chuông."}
    except Exception as e:
        return {"success": False, "error": str(e)}