from fastapi import APIRouter, Depends,Query,HTTPException,Request
from fastapi.responses import RedirectResponse,StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import requests
import os
import asyncio

from app.db.sql import get_db
from app.models.Users import Users
from app.models.Couples import Couples
from app.api.deps import get_current_user
import yt_dlp
import asyncio


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
    """API Tìm kiếm YouTube không giới hạn bằng yt-dlp"""
    
    # Hàm chạy đồng bộ (blocking) để đưa vào threadpool
    def fetch_youtube_data():
        ydl_opts = {
            'format': 'best',
            'noplaylist': True,
            'extract_flat': True, #  Chỉ lấy thông tin Meta (tên, ID, ảnh), TUYỆT ĐỐI không tải video để API chạy siêu nhanh
            'quiet': True
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # ytsearch6: Lấy đúng 6 kết quả đầu tiên
            return ydl.extract_info(f"ytsearch6:{q}", download=False)

    try:
       
        # hay chặn các luồng WebSocket (WebRTC) đang chạy ngầm của bạn!
        result = await asyncio.to_thread(fetch_youtube_data)
        
        formatted_results = []
        if 'entries' in result:
            for entry in result['entries']:
                # Tránh lỗi NoneType: yt-dlp có thể trả về None nếu video bị ẩn/lỗi
                if not entry:
                    continue
                
                # Xử lý lấy ảnh Thumbnail an toàn
                thumbnails = entry.get("thumbnails", [])
                thumbnail_url = thumbnails[0].get("url") if thumbnails else "https://via.placeholder.com/320x180.png?text=No+Image"
                
                formatted_results.append({
                    "videoId": entry.get("id"),
                    "title": entry.get("title", "Video không có tiêu đề"),
                    "channel": entry.get("uploader") or entry.get("channel", "Kênh Ẩn"),
                    "thumbnail": thumbnail_url
                })
                
        return {"items": formatted_results}
        
    except Exception as e:
        print(f"❌ Lỗi khi cào YouTube với yt-dlp: {e}")
        return {"items": []}

@router.get("/stream/{video_id}")
async def get_audio_stream(video_id: str):
    """
    Hệ thống luân chuyển máy chủ thông minh.
    Tự động nhảy sang máy chủ khác nếu máy chủ hiện tại bị quá tải.
    """
    def fetch_from_public_api():
        # Danh sách các máy chủ Piped cực xịn trên toàn cầu
        instances = [
            "https://pipedapi.kavin.rocks",
            "https://pipedapi.tokhmi.xyz",
            "https://pipedapi.syncpundit.io",
            "https://pipedapi.smnz.de",
            "https://piped-api.lunar.icu",
            "https://pipedapi.drgns.space"
        ]
        
        # Thử lần lượt từng máy chủ
        for base_url in instances:
            try:
                api_url = f"{base_url}/streams/{video_id}"
                # Chỉ đợi 5 giây, nếu máy chủ nào lề mề thì bỏ qua qua luôn máy khác
                response = requests.get(api_url, timeout=5)
                
                if response.status_code == 200:
                    data = response.json()
                    audio_streams = data.get("audioStreams", [])
                    
                    if audio_streams:
                        best_audio_url = None
                        # Ưu tiên số 1: Lấy định dạng m4a để mọi trình duyệt đọc được
                        for stream in audio_streams:
                            if stream.get("format") == "M4A":
                                best_audio_url = stream.get("url")
                                break
                                
                        # Nếu không có m4a, vớt đại định dạng xịn nhất đầu tiên
                        if not best_audio_url:
                            best_audio_url = audio_streams[0].get("url")
                            
                        # Nếu lấy thành công, lập tức trả về link và kết thúc
                        print(f"✅ Đã lấy nhạc thành công từ máy chủ: {base_url}")
                        return best_audio_url
                else:
                    print(f"⚠️ Máy chủ {base_url} báo lỗi {response.status_code}. Đang chuyển...")
            except Exception as e:
                print(f"⚠️ Máy chủ {base_url} không phản hồi. Đang thử máy khác...")
                continue # Tiếp tục vòng lặp sang máy chủ tiếp theo
                
        # Nếu đã gõ cửa toàn bộ danh sách mà vẫn không ai mở
        raise Exception("Hiện tại tất cả hệ thống vệ tinh đều đang bận. Vui lòng thử lại sau ít phút!")

    try:
        audio_url = await asyncio.to_thread(fetch_from_public_api)
        return RedirectResponse(url=audio_url)
        
    except Exception as e:
        print(f"❌ LỖI LẤY NHẠC CUỐI CÙNG: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))