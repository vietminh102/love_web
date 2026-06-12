import httpx
import os
import base64
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# ==========================================
# 🌟 HÀM NẶN FILE BÁO THỨC (.ICS)
# ==========================================
def generate_ics_content(title: str, description: str, remind_time: datetime) -> str:
    # Chuyển đổi thời gian sang chuẩn iCalendar (UTC format: YYYYMMDDThhmmssZ)
    start_time_str = remind_time.strftime('%Y%m%dT%H%M%SZ')
    
    # Cộng thêm 15 phút cho sự kiện
    end_time = remind_time + timedelta(minutes=15)
    end_time_str = end_time.strftime('%Y%m%dT%H%M%SZ')
    
    uid = f"{int(datetime.now().timestamp())}@lovelink.com"

    return f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LoveLink//Trạm Tình Yêu//VI
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{start_time_str}
DTSTART:{start_time_str}
DTEND:{end_time_str}
SUMMARY:{title}
DESCRIPTION:{description}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:{title}
TRIGGER:-PT0M
END:VALARM
END:VEVENT
END:VCALENDAR"""

# ==========================================
# 🌟 HÀM GỬI EMAIL (ĐÃ TÍCH HỢP ĐÍNH KÈM)
# ==========================================
# Lưu ý: Nhớ thêm tham số remind_time vào hàm nhé!
async def send_reminder_email(to_email: str, title: str, message_content: str, remind_time: datetime):
    BREVO_API_KEY = os.getenv("BREVO_API_KEY")
    SENDER_EMAIL = "thongbaolovee@gmail.com" 

    url = "https://api.brevo.com/v3/smtp/email"
    
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    # 1. Tạo nội dung file báo thức
    ics_text = generate_ics_content(title, message_content, remind_time)
    
    # 2. Mã hóa sang Base64 theo đúng chuẩn yêu cầu của Brevo API
    ics_base64 = base64.b64encode(ics_text.encode('utf-8')).decode('utf-8')

    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #fdf2f8; padding: 20px;">
            <div style="max-width: 500px; margin: auto; background: white; padding: 30px; border-radius: 15px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #ec4899;">⏰ Đến giờ rồi bé ơi!</h1>
                <h2 style="color: #1f2937;">{title}</h2>
                <p style="font-size: 16px; color: #4b5563; padding: 15px; background: #fce7f3; border-radius: 10px;">
                    "{message_content}"
                </p>
                <p style="color: #ec4899; font-weight: bold; font-size: 14px; margin-top: 20px;">
                    👇 Bấm vào file đính kèm bên dưới để bật chuông báo thức nhé!
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 10px;">
                    Vào web ngay để xem chi tiết nha ❤️
                </p>
            </div>
        </body>
    </html>
    """

    # 3. Đóng gói bức thư (Thêm key "attachment" vào payload)
    payload = {
        "sender": {"name": "Nhắc Nhở Tình Yêu", "email": SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"⏰ Báo thức: {title}",
        "htmlContent": html_content,
        "attachment": [
            {
                "content": ics_base64,
                "name": "LoveLink_BaoThuc.ics" # Tên file sẽ hiển thị trong Gmail
            }
        ]
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status() 
            print(f"✅ Đã gửi Email kèm File Báo Thức thành công tới: {to_email}")
            
    except Exception as e:
        print(f"❌ Lỗi khi gửi email qua API Brevo: {e}")