import httpx
import os
import base64
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

def generate_ics_content(title: str, description: str, remind_time: datetime) -> str:
    start_time_str = remind_time.strftime('%Y%m%dT%H%M%SZ')
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

# 🌟 Đã gán remind_time = None để tự động phân biệt
async def send_reminder_email(to_email: str, title: str, message_content: str, remind_time: datetime = None):
    BREVO_API_KEY = os.getenv("BREVO_API_KEY")
    SENDER_EMAIL = "thongbaolovee@gmail.com" 
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }

    # ===============================================
    # TRƯỜNG HỢP 1: GỬI LÚC VỪA TẠO (ĐÍNH KÈM LỊCH)
    # ===============================================
    if remind_time:
        ics_text = generate_ics_content(title, message_content, remind_time)
        ics_base64 = base64.b64encode(ics_text.encode('utf-8')).decode('utf-8')
        
        html_content = f"""
        <div style="font-family: Arial; padding: 20px; text-align: center;">
            <h2 style="color: #ec4899;">📅 Bạn có 1 lịch hẹn mới!</h2>
            <h3>{title}</h3>
            <p>"{message_content}"</p>
            <p style="color: #ec4899; font-weight: bold;">👇 Bấm vào file đính kèm để bật chuông điện thoại nhé!</p>
        </div>"""
        
        payload = {
            "sender": {"name": "Trạm Tình Yêu", "email": SENDER_EMAIL},
            "to": [{"email": to_email}],
            "subject": f"📅 Lịch hẹn: {title}",
            "htmlContent": html_content,
            "attachment": [{"content": ics_base64, "name": "LoveLink_BaoThuc.ics"}]
        }

    # ===============================================
    # TRƯỜNG HỢP 2: GỬI LÚC CHUÔNG KÊU (BÁO ĐỘNG)
    # ===============================================
    else:
        html_content = f"""
        <div style="font-family: Arial; padding: 20px; text-align: center; background: #fce7f3; border-radius: 15px;">
            <h1 style="color: #e11d48; font-size: 30px;">⏰ BÍP BÍP BÍP!</h1>
            <h2 style="color: #1f2937;">{title}</h2>
            <p style="font-size: 18px; padding: 15px;">"{message_content}"</p>
            <p style="color: #9ca3af;">Đến giờ rồi, vào web ngay nhé ❤️</p>
        </div>"""
        
        payload = {
            "sender": {"name": "Báo Thức Tình Yêu", "email": SENDER_EMAIL},
            "to": [{"email": to_email}],
            "subject": f"🚨 TING TING: {title}",
            "htmlContent": html_content
        }

    # Bắn API Brevo
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status() 
            print(f"✅ Đã gửi Email ({'KÈM FILE LỊCH' if remind_time else 'BÁO ĐỘNG CHUÔNG'}) tới: {to_email}")
    except Exception as e:
        print(f"❌ Lỗi khi gửi email: {e}")