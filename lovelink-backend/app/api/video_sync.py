from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from youtubesearchpython import VideosSearch
from fastapi import Query
from app.db.sql import get_db
from app.models.Users import Users
from app.models.Couples import Couples
from app.api.deps import get_current_user

# Đảm bảo đường dẫn này trỏ đúng tới file chứa biến 'manager' của bạn
from app.api.notifications import manager 
from app.schemas.video_sync import VideoSyncRequest

router = APIRouter(prefix="/couple/video", tags=["Watch Together"])

@router.post("/sync")
async def sync_video_action(
    request: VideoSyncRequest,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    print(f"📥 BACKEND ĐÃ NHẬN LỆNH: {request.action} - Giá trị: {request.payload} từ User: {current_user.id}")
    
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    
    if not couple or not couple.user2_id:
        print("❌ Lỗi: User này chưa ghép đôi!")
        return {"message": "Chưa ghép đôi"}

    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id
    print(f"🚀 BACKEND CHUẨN BỊ BẮN WEBSOCKET TỚI PARTNER: {partner_id}")

    # Bắn tín hiệu WebSocket
    await manager.send_personal_message({
        "type": "sync_video",
        "action": request.action,
        "payload": request.payload
    }, str(partner_id))

    return {"message": "Thành công"}
@router.get("/search")
async def search_youtube_unlimited(q: str = Query(..., description="Từ khóa tìm kiếm")):
    """API Tìm kiếm YouTube không giới hạn (Không cần API Key)"""
    try:
        # Cào 6 kết quả đầu tiên từ YouTube
        videosSearch = VideosSearch(q, limit = 6)
        results = videosSearch.result()
        
        # Lọc lại dữ liệu cho gọn gàng trước khi gửi về Frontend
        formatted_results = []
        for video in results.get('result', []):
            formatted_results.append({
                "videoId": video.get("id"),
                "title": video.get("title"),
                "channel": video.get("channel", {}).get("name"),
                "thumbnail": video.get("thumbnails", [{}])[0].get("url")
            })
            
        return {"items": formatted_results}
    except Exception as e:
        print(f"Lỗi khi cào YouTube: {e}")
        return {"items": []}