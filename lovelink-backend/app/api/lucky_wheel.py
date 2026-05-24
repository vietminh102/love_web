from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.sql import get_db
from app.models.Users import Users
from app.models.Couples import Couples
from app.api.deps import get_current_user
from app.api.notifications import manager


from app.models.nosql import Notification, WheelData
from app.schemas.lucky_wheel import UpdateWheelRequest, WheelNotifyRequest, SyncSpinRequest

router = APIRouter(prefix="/couple", tags=["Lucky Wheel"])

@router.get("/wheel")
async def get_wheel_data(
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách các ô của Vòng quay may mắn"""
    result = await db.execute(
        select(Couples).where((Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id))
    )
    couple = result.scalars().first()
    if not couple or not couple.user2_id:
        return {"prizes": []}

    # Tìm dữ liệu vòng quay trong MongoDB
    wheel = await WheelData.find_one(WheelData.couple_id == str(couple.id))
    if wheel:
        return {"prizes": wheel.prizes}
    return {"prizes": []}


@router.put("/wheel")
async def update_wheel_data(
    request: UpdateWheelRequest,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lưu và đồng bộ vòng quay chung của 2 người"""
    result = await db.execute(
        select(Couples).where((Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id))
    )
    couple = result.scalars().first()
    if not couple or not couple.user2_id:
        raise HTTPException(status_code=400, detail="Bạn chưa ghép đôi!")

    new_prizes = [p.dict() for p in request.prizes]

    wheel = await WheelData.find_one(WheelData.couple_id == str(couple.id))
    if wheel:
        wheel.prizes = new_prizes
        await wheel.save()
    else:
        wheel = WheelData(couple_id=str(couple.id), prizes=new_prizes)
        await wheel.insert()

    return {"message": "Đã đồng bộ vòng quay với người ấy!"}


@router.post("/wheel/notify")
async def notify_wheel_spin(
    request: WheelNotifyRequest,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Gửi thông báo Realtime cho đối phương khi mình quay trúng"""
    result = await db.execute(
        select(Couples).where((Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id))
    )
    couple = result.scalars().first()
    if not couple or not couple.user2_id:
        return {"message": "Chưa ghép đôi"}

    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id

    notif = Notification(
        user_id=str(partner_id),
        actor_name="Minigame",
        type="wheel_spin",
        message=f"{current_user.display_name} vừa quay trúng: '{request.result}'. Hãy chuẩn bị tinh thần thực hiện nhé! 💕",
        link="/wheel"
    )
    await notif.insert()
    
    await manager.send_personal_message({
        "id": str(notif.id), 
        "actor_name": notif.actor_name, 
        "message": notif.message,
        "type": notif.type, 
        "is_read": False, 
        "link": notif.link, 
        "created_at": notif.created_at.isoformat()
    }, str(partner_id))

    return {"message": "Đã gửi thông báo cho người ấy!"}
@router.post("/wheel/sync-spin")
async def sync_wheel_spin(
    request: SyncSpinRequest,
    current_user: Users = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Gửi tín hiệu bắt đầu quay đồng bộ cho đối phương (Real-time)"""
    result = await db.execute(
        select(Couples).where((Couples.user1_id == current_user.id) | (Couples.user2_id == current_user.id))
    )
    couple = result.scalars().first()
    if not couple or not couple.user2_id:
        return {"message": "Chưa ghép đôi"}

    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id

    # 🌟 Bắn WebSocket trực tiếp (KHÔNG LƯU VÀO DATABASE THÔNG BÁO)
    await manager.send_personal_message({
        "type": "sync_wheel_spin", # Mã tín hiệu bí mật
        "prize_index": request.prize_index,
        "is_auto_delete": request.is_auto_delete,
    }, str(partner_id))

    return {"message": "Đã gửi tín hiệu đồng bộ quay!"}