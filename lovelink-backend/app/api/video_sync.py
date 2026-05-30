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
async def get_audio_stream(video_id: str, request: Request):
    # 🌟 1. TỰ ĐỘNG TÌM ĐƯỜNG DẪN TUYỆT ĐỐI CỦA FILE COOKIES
    # Dù Render có đặt code ở đâu, dòng này cũng sẽ tự động dò ra file cookies.txt
    root_dir = os.getcwd()
    cookie_path = os.path.join(root_dir, "cookies.txt")
    
    if not os.path.exists(cookie_path):
        print(f"⚠️ Cảnh báo: Không tìm thấy file tại {cookie_path}. Backend đang chạy KHÔNG CÓ Cookies!")
    else:
        print(f"✅ Đã tải thành công vé qua cửa Cookies tại: {cookie_path}")

    # 🌟 2. BỌC YT-DLP VÀO HÀM RIÊNG ĐỂ KHÔNG LÀM ĐƠ WEBSOCKET
    def fetch_audio_info():
        ydl_opts = {
            'format': 'bestaudio',
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'nocheckcertificate': True,
            'geo_bypass': True,
            'cookiefile': cookie_path if os.path.exists(cookie_path) else None,
            
            # 🌟 3. BÍ KÍP TỐI THƯỢNG: Đóng giả làm app Android để né 100% hệ thống kiểm tra Bot!
            'extractor_args': {'youtube': ['player_client=android']},
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

    try:
        # Chạy hàm lấy link trong ThreadPool để server vẫn rảnh rang xử lý Xem Chung
        info = await asyncio.to_thread(fetch_audio_info)
        audio_url = info['url']
        
        headers = info.get('http_headers', {}) 
        
        range_header = request.headers.get('Range')
        if range_header:
            headers['Range'] = range_header

        r = requests.get(audio_url, headers=headers, stream=True)
        
        if r.status_code == 403:
            raise Exception("YouTube đã chặn luồng IP này (Lỗi 403 Forbidden).")
            
        response_headers = {"Accept-Ranges": "bytes"}
        if "content-length" in r.headers:
            response_headers["Content-Length"] = r.headers["content-length"]
        if "content-range" in r.headers:
            response_headers["Content-Range"] = r.headers["content-range"]
            
        def generate():
            for chunk in r.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        return StreamingResponse(
            generate(),
            status_code=r.status_code, 
            media_type="audio/mp4",
            headers=response_headers
        )
        
    except Exception as e:
        print(f"❌ LỖI TRÍCH XUẤT NHẠC: {str(e)}") 
        raise HTTPException(status_code=400, detail=str(e))