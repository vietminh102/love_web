from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.sql import get_db
from app.core.config import settings # Đảm bảo đường dẫn này đúng với file config JWT của bạn
from app.models.Users import Users
from app.api.deps import get_current_user
from app.models.nosql import Notification
from beanie import PydanticObjectId
from fastapi import HTTPException
import json

router = APIRouter(prefix="/notifications", tags=["Notifications"])

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
async def websocket_endpoint(websocket: WebSocket, token: str):
    """Client sẽ kết nối vào đây bằng ws://.../ws?token=ABC"""
    try:
        # Giải mã token để biết ai đang kết nối
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = str(payload.get("sub"))
    except:
        await websocket.close()
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            # Chờ nhận tin nhắn từ client (nhịp tim keep-alive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
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