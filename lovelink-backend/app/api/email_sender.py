import aiosmtplib
from email.message import EmailMessage

async def send_reminder_email(to_email: str, title: str, message_content: str):
    SENDER_EMAIL = "thongbaolovee@gmail.com" 
    APP_PASSWORD = "esmvdsxprewyypqb" 

    msg = EmailMessage()
    msg["From"] = f"Nhắc Nhở Tình Yêu <{SENDER_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = f"⏰ Báo thức: {title}"
    
    # Giao diện HTML của Email cho lãng mạn
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
    msg.add_alternative(html_content, subtype='html')

    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            username=SENDER_EMAIL,
            password=APP_PASSWORD,
        )
        print(f"✅ Đã gửi email báo thức tới: {to_email}")
    except Exception as e:
        print(f"❌ Lỗi khi gửi email: {e}")