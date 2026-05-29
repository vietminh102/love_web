import httpx
import os
from dotenv import load_dotenv

load_dotenv()
async def send_reminder_email(to_email: str, title: str, message_content: str):
    # 🌟 ĐIỀN THÔNG TIN CỦA BẠN VÀO ĐÂY
    BREVO_API_KEY = os.getenv("BREVO_API_KEY")
    SENDER_EMAIL = "thongbaolovee@gmail.com" 

    url = "https://api.brevo.com/v3/smtp/email"
    
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    # Giao diện HTML giữ nguyên không thay đổi
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #fdf2f8; padding: 20px;">
            <div style="max-width: 500px; margin: auto; background: white; padding: 30px; border-radius: 15px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #ec4899;">⏰ Đến giờ rồi bé ơi!</h1>
                <h2 style="color: #1f2937;">{title}</h2>
                <p style="font-size: 16px; color: #4b5563; padding: 15px; background: #fce7f3; border-radius: 10px;">
                    "{message_content}"
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
                    Vào web ngay để xem chi tiết nhé ❤️
                </p>
            </div>
        </body>
    </html>
    """

    # Đóng gói bức thư chuẩn bị gửi qua API
    payload = {
        "sender": {"name": "Nhắc Nhở Tình Yêu", "email": SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"⏰ Báo thức: {title}",
        "htmlContent": html_content
    }

    try:
        # Gọi API qua cổng 443 (Render không thể chặn được)
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status() # Bắt lỗi nếu Brevo từ chối
            print(f"✅ Bác bảo vệ đã dùng API bắn email tới: {to_email}")
            
    except Exception as e:
        print(f"❌ Lỗi khi gửi email qua API: {e}")