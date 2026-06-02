from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime, timezone

from app.db.sql import get_db
from app.models.Users import Users
from app.models.Couples import Couples
from app.models.nosql import ChatStatus
from app.api.deps import get_current_user
from app.api.notifications import manager 
from app.models.nosql import ChatMessage  # Model Beanie

router = APIRouter(prefix="/couple/chat", tags=["Chat Station"])

def get_server_timestamp():
    # Sử dụng UTC chuẩn để tránh mọi sai lệch về múi giờ
    return int(datetime.now(timezone.utc).timestamp() * 1000)

# 1. API GỬI TIN NHẮN 
@router.post("/send")
async def send_couple_message(
    payload: dict,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    if not couple or not couple.user2_id:
        raise HTTPException(status_code=400, detail="Chưa ghép đôi")

    # Ép buộc 100% dùng đồng hồ của Server để tránh lệch pha giữa 2 điện thoại
    msg_timestamp = get_server_timestamp()

    try:
        new_msg = ChatMessage(
            couple_id=str(couple.id),
            sender_id=str(current_user.id),
            msg_id=payload.get("id"),
            text=payload.get("text"),
            timestamp=msg_timestamp
        )
        await new_msg.insert()
    except Exception as err:
        print(f"❌ Lỗi ghi Mongo: {err}")

    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id
    await manager.send_personal_message({
        "type": "sync_video",
        "action": "chat_message",
        "payload": {
            "id": payload.get("id"),
            "text": payload.get("text"),
            "timestamp": msg_timestamp
        }
    }, str(partner_id))

    return {"status": "Thành công"}


# 2. API LẤY LỊCH SỬ CHAT
@router.get("/history")
async def get_chat_history(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    if not couple:
        return {"messages": []}

    try:
        db_messages = await ChatMessage.find(
            ChatMessage.couple_id == str(couple.id)
        ).sort(-ChatMessage.timestamp).limit(100).to_list()
        
        db_messages.reverse()
        
        formatted_messages = [{
            "id": doc.msg_id,
            "text": doc.text,
            "sender": "me" if doc.sender_id == str(current_user.id) else "partner",
            "timestamp": doc.timestamp
        } for doc in db_messages]
        
        return {"messages": formatted_messages}
    except Exception as e:
        return {"messages": []}


# 3. API LẤY SỐ LƯỢNG TIN CHƯA ĐỌC
@router.get("/unread-count")
async def get_unread_chat_count(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    if not couple:
        return {"unread_count": 0}

    status_result = await db.execute(
        select(ChatStatus).where(
            ChatStatus.couple_id == couple.id,
            ChatStatus.user_id == current_user.id
        )
    )
    status = status_result.scalars().first()
    last_read = status.last_read_time if status else 0

    try:
        unread_count = await ChatMessage.find(
            ChatMessage.couple_id == str(couple.id),
            ChatMessage.sender_id != str(current_user.id),
            ChatMessage.timestamp > last_read
        ).count()
        
        return {"unread_count": unread_count}
    except Exception as e:
        return {"unread_count": 0}


# 4. API ĐÁNH DẤU ĐÃ ĐỌC
@router.post("/mark-read")
async def mark_chat_as_read(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Couples).where(
            (Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    if not couple:
        return {"status": "Không tìm thấy cặp đôi"}

    current_timestamp = get_server_timestamp()

    stmt = insert(ChatStatus).values(
        couple_id=couple.id,
        user_id=current_user.id,
        last_read_time=current_timestamp
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=['couple_id', 'user_id'], 
        set_={"last_read_time": current_timestamp}
    )
    
    await db.execute(stmt)
    await db.commit()
    return {"status": "Đã cập nhật mốc xem tin nhắn"}