from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime

from app.db.sql import get_db
from app.models.postgres import UserDB, CoupleDB
from app.api.deps import get_current_user
from app.schemas.couple import PairRequest # Import Schema vừa tạo
from app.api.auth import generate_pairing_code

router = APIRouter(prefix="/couple", tags=["Couple"])

@router.get("/info")
async def get_couple_info(
    current_user: UserDB = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Lấy thông tin ghép đôi của User hiện tại (Lấy mã Code để chia sẻ)
    """
    # Tìm record Couple mà user này là user1 HOẶC user2
    result = await db.execute(
        select(CoupleDB).where(
            (CoupleDB.user1_id == current_user.id) | (CoupleDB.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()
    
    if not couple:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin ghép đôi")
        
    return couple

@router.post("/pair")
async def pair_with_partner(
    request: PairRequest, 
    current_user: UserDB = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Nhập mã để ghép đôi với người ấy
    """
    # Xử lý chuỗi (Xóa dấu cách thừa, in hoa)
    code = request.pairing_code.strip().upper()

    # 1. Kiểm tra xem MÌNH đã ghép đôi chưa
    my_couple_result = await db.execute(
        select(CoupleDB).where(
            (CoupleDB.user1_id == current_user.id) | (CoupleDB.user2_id == current_user.id)
        )
    )
    my_couples = my_couple_result.scalars().all()
    
    for c in my_couples:
        if c.user1_id is not None and c.user2_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Bạn đã được ghép đôi với người khác rồi! Cần hủy ghép đôi trước."
            )

    # 2. Tìm mã ghép đôi của ĐỐI PHƯƠNG
    target_result = await db.execute(select(CoupleDB).where(CoupleDB.pairing_code == code))
    target_couple = target_result.scalars().first()

    if not target_couple:
        raise HTTPException(status_code=404, detail="Mã ghép đôi không tồn tại hoặc đã sai!")

    if target_couple.user1_id == current_user.id:
        raise HTTPException(status_code=400, detail="Bạn không thể tự ghép đôi với chính mình được!")

    if target_couple.user2_id is not None:
        raise HTTPException(status_code=400, detail="Người này đã hoa có chủ rồi!")

    # 3. TIẾN HÀNH GHÉP ĐÔI 💕
    try:
        # Cập nhật ID của mình vào hồ sơ của đối phương
        target_couple.user2_id = current_user.id
        
        # Xóa các record "độc thân" cũ của mình để tránh rác Database
        for c in my_couples:
            if c.id != target_couple.id:
                await db.delete(c)

        await db.commit()
        await db.refresh(target_couple)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi ghép đôi")

    return {
        "message": "Ghép đôi thành công! Chúc hai bạn hạnh phúc 💕", 
        "couple": target_couple
    }
@router.get("/partner")
async def get_partner_info(
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lấy thông tin hiển thị của Người ấy (Tên, Ảnh)"""
    
    # 1. Tìm bản ghi ghép đôi của mình
    result = await db.execute(
        select(CoupleDB).where(
            (CoupleDB.user1_id == current_user.id) | (CoupleDB.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    # Nếu chưa ghép đôi (user2_id là None) thì báo về false
    if not couple or couple.user1_id is None or couple.user2_id is None:
        return {"has_partner": False}

    # 2. Xác định ID của đối phương (Nếu mình là user1 thì đối phương là user2 và ngược lại)
    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id

    # 3. Chui vào bảng UserDB để lấy Tên và Ảnh của đối phương
    partner_result = await db.execute(select(UserDB).where(UserDB.id == partner_id))
    partner = partner_result.scalars().first()

    if partner:
        return {
            "has_partner": True,
            "display_name": partner.display_name,
            "avatar_url": partner.avatar_url # Tiện thể lấy luôn ảnh đại diện (nếu có)
        }
        
    return {"has_partner": False}
@router.post("/unpair")
async def unpair_partner(
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Hủy ghép đôi: Xóa lịch sử và cấp ngay mã FA mới cho cả 2"""
    
    # 1. Tìm bản ghi ghép đôi hiện tại
    result = await db.execute(
        select(CoupleDB).where(
            (CoupleDB.user1_id == current_user.id) | (CoupleDB.user2_id == current_user.id)
        )
    )
    couple = result.scalars().first()

    if not couple or couple.user2_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Bạn hiện tại chưa ghép đôi với ai."
        )

    # 2. LƯU LẠI ID của đối phương trước khi xóa dữ liệu
    partner_id = couple.user2_id if couple.user1_id == current_user.id else couple.user1_id

    try:
        # 3. Xóa bản ghi ghép đôi (Xé giấy đăng ký)
        await db.delete(couple)
        
        # BẮT BUỘC CÓ DÒNG NÀY: Ép Database xóa ngay lập tức trước khi đi tiếp
        await db.flush() 

        # 4. Cấp ngay 2 mã ghép đôi "Độc thân" mới tinh cho 2 người
        my_new_couple = CoupleDB(
            user1_id=current_user.id,
            pairing_code=generate_pairing_code() # Tự động gọi hàm tạo mã LVE-...
        )
        partner_new_couple = CoupleDB(
            user1_id=partner_id,
            pairing_code=generate_pairing_code()
        )
        
        db.add(my_new_couple)
        db.add(partner_new_couple)
        
        # Lưu tất cả thay đổi vào CSDL
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        # In chi tiết lỗi ra màn hình để biết nếu CSDL bị kẹt
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi hủy ghép đôi: {str(e)}")

    return {"message": "Đã hủy ghép đôi thành công. Bạn đã trở lại hội độc thân!"}