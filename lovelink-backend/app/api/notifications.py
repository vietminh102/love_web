from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
import jwt
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.sql import get_db
from app.core.config import settings # Đảm bảo đường dẫn này đúng với file config JWT của bạn
from app.models.Users import Users
from app.models.Couples import Couples
from app.api.deps import get_current_user
from app.models.nosql import Notification
from beanie import PydanticObjectId
from fastapi import HTTPException
from datetime import datetime, date, timedelta, timezone
import json

router = APIRouter(prefix="/notifications", tags=["Notifications"])

async def check_and_send_milestones(db_sql: AsyncSession):
    VN_TZ = timezone(timedelta(hours=7))
    now_vn = datetime.now(VN_TZ)
    today = now_vn.date()
    start_of_today = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
    
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

        for user_chinh, doi_phuong in [(u1, u2), (u2, u1)]:
            bday = getattr(user_chinh, 'dob', None) or getattr(user_chinh, 'dob', None)
            if bday:
                if bday.month == today.month and bday.day == today.day:
                    # Kiểm tra xem hôm nay hệ thống đã gửi thông báo này chưa
                    exists = await Notification.find(
                        Notification.user_id == str(doi_phuong.id),
                        Notification.type == "birthday_milestone",
                        Notification.created_at >= start_of_today
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
                        
                        # Phát sóng tín hiệu Realtime trực tiếp lên màn hình đối phương
                        await manager.send_personal_message({
                            "id": str(notif.id), "actor_name": notif.actor_name, "message": notif.message,
                            "type": notif.type, "is_read": False, "link": notif.link, "created_at": notif.created_at.isoformat()
                        }, str(doi_phuong.id))

        
        # 2. XỬ LÝ NGÀY YÊU (Sửa lỗi lệch ngày do Timezone)
        start_date_raw = getattr(couple, 'start_date', None)
        if start_date_raw:
            if isinstance(start_date_raw, datetime):
                start_date = start_date_raw.astimezone(VN_TZ).date()
            else:
                start_date = start_date_raw

            # Tính toán chính xác số ngày bên nhau
            days_together = (today - start_date).days
            special_days = []
            
            if days_together % 100 == 0 and days_together != 0: 
                special_days.append(days_together)
            
            for user_nhan in [u1_id, u2_id]:
                # A. Kỷ niệm số ngày chẵn
                if days_together in special_days:
                    exists = await Notification.find(
                        Notification.user_id == user_nhan,
                        Notification.type == f"days_{days_together}",
                        Notification.created_at >= start_of_today
                    ).first_or_none()
                    
                    if not exists:
                        notif = Notification(
                            user_id=user_nhan,
                            actor_name="LoveLink",
                            type="anniversary_milestone",
                            message=f"Chúc mừng hai bạn đã bên nhau chạm mốc hành trình {days_together} ngày yêu thương! 🎉",
                            link="/diary"
                        )
                        await notif.insert()
                        
                        # Kích hoạt chuông nảy số Realtime
                        await manager.send_personal_message({
                            "id": str(notif.id), "actor_name": notif.actor_name, "message": notif.message,
                            "type": notif.type, "is_read": False, "link": notif.link, "created_at": notif.created_at.isoformat()
                        }, user_nhan)

                # B. Kỷ niệm số năm chẵn (Trùng ngày trùng tháng)
                elif start_date.month == today.month and start_date.day == today.day and today.year > start_date.year:
                    years = today.year - start_date.year
                    exists = await Notification.find(
                        Notification.user_id == user_nhan,
                        Notification.type == f"years_{years}",
                        Notification.created_at >= start_of_today
                    ).first_or_none()
                    
                    if not exists:
                        notif = Notification(
                            user_id=user_nhan,
                            actor_name="LoveLink",
                            type="anniversary_milestone",
                            message=f"Hôm nay là tròn trĩnh {years} năm ngày hai bạn chính thức thuộc về nhau! Happy Anniversary! 💖",
                            link="/diary"
                        )
                        await notif.insert()
                        
                        await manager.send_personal_message({
                            "id": str(notif.id), "actor_name": notif.actor_name, "message": notif.message,
                            "type": notif.type, "is_read": False, "link": notif.link, "created_at": notif.created_at.isoformat()
                        }, user_nhan)
# TRẠM PHÁT SÓNG WEBSOCKET (Connection Manager)
class ConnectionManager:
    def __init__(self):
        # Lưu trữ các kết nối đang online: { "user_id": [websocket1, websocket2] }
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
        """Hàm bắn thông báo realtime cho 1 user cụ thể nếu họ đang online"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

# 1. API Lấy danh sách thông báo cũ (Lúc user vừa vào app)
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

# 2. ENDPOINT KẾT NỐI WEBSOCKET
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None): # Thêm = None để không bị chặn ngoài cửa
    """Client sẽ kết nối vào đây bằng ws://.../ws?token=ABC"""
    try:
        if not token or token == "null" or token == "undefined":
            print("❌ WebSocket bị từ chối: Không có token")
            await websocket.close(code=1008)
            return
            
        # 1. DỌN RÁC TOKEN: Cắt bỏ chữ Bearer và dấu nháy nếu lỡ dính vào
        clean_token = token.replace("Bearer ", "").replace('"', '').replace("'", "")
        
        # 2. Giải mã token
        payload = jwt.decode(clean_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = str(payload.get("sub"))
        
    except Exception as e:
        # IN LỖI RA RENDER LOG ĐỂ DỄ DÀNG BẮT TẬN TAY
        print(f"❌ Lỗi giải mã Token WebSocket: {str(e)}") 
        await websocket.close(code=1008)
        return

    # 3. Kết nối thành công
    await manager.connect(websocket, user_id)
    print(f"✅ User {user_id} đã kết nối Realtime thành công!")
    
    try:
        while True:
            # Chờ nhận tin nhắn từ client (nhịp tim keep-alive)
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
            notif.is_read = True # Chuyển trạng thái thành Đã đọc
            await notif.save()   # Lưu lại vào MongoDB
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
            await notif.delete() # Xóa khỏi MongoDB
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
    """API Bí mật để ép hệ thống quét ngày kỷ niệm ngay lập tức"""
    try:
        await check_and_send_milestones(db_sql)
        return {"success": True, "message": "Đã chạy quét sự kiện thành công! Hãy kiểm tra chuông."}
    except Exception as e:
        return {"success": False, "error": str(e)}