from fastapi import APIRouter, Query
import yt_dlp
import asyncio
import urllib.parse

# 🌟 Router dành riêng cho Music
router = APIRouter(prefix="/couple/music", tags=["Music Station"])

@router.get("/search/soundcloud")
async def search_soundcloud(q: str = Query(..., description="Từ khóa tìm kiếm SoundCloud")):
    def fetch_soundcloud_data():
        ydl_opts = {'format': 'best', 'extract_flat': True, 'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(f"scsearch5:{q}", download=False)

    try:
        result = await asyncio.to_thread(fetch_soundcloud_data)
        formatted_results = []
        if 'entries' in result:
            for entry in result['entries']:
                if not entry: continue
                formatted_results.append({
                    "videoId": entry.get("webpage_url") or entry.get("url"),
                    "title": entry.get("title", "Không tiêu đề"),
                    "channel": entry.get("uploader", "SoundCloud Artist"),
                    "thumbnail": entry.get("thumbnails", [{}])[0].get("url")
                })
        return {"items": formatted_results}
    except Exception as e:
        print(f"❌ Lỗi tìm kiếm SoundCloud: {e}")
        return {"items": []}

@router.get("/stream-url")
async def get_stream_url(url: str = Query(..., description="Link bài hát SoundCloud")):
    def fetch_direct_audio():
        ydl_opts = {
            # 🌟 VŨ KHÍ MỚI: Ép buộc lấy giao thức HTTP (MP3/M4A), cấm lấy m3u8
            'format': 'bestaudio[protocol^=http]/bestaudio/best',
            'quiet': True,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            decoded_url = urllib.parse.unquote(url)
            info = ydl.extract_info(decoded_url, download=False)
            return info.get('url')

    try:
        direct_url = await asyncio.to_thread(fetch_direct_audio)
        if direct_url:
            return {"stream_url": direct_url}
        else:
            return {"error": "Không lấy được link nhạc"}
    except Exception as e:
        print(f"❌ Lỗi lấy stream URL: {e}")
        return {"error": str(e)}