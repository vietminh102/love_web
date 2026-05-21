import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_diary(client: AsyncClient, auth_token: str):
    """Test viết một dòng nhật ký mới"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {
            "title": "Nhật ký test",
            "content": "Hôm nay là một ngày tuyệt vời khi hoàn thiện xong web! ❤️",
            "date": "2026-05-21",
            "mood": "happy"
        }

    
    response = await client.post("/api/diaries", data=payload, headers=headers)
    print("\nKẾT QUẢ API LÀ:", response.json())
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Đã lưu nhật ký tình yêu!"
    assert "id" in data
    


@pytest.mark.asyncio
async def test_like_diary(client: AsyncClient, auth_token: str):
    """Test tính năng thả tim bài nhật ký"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # 1. TẠO BÀI NHẬT KÝ TRƯỚC (Dùng data= thay vì json= để phòng trường hợp API dùng Form)
    payload = {
        "title": "Nhật ký thả tim",
        "content": "Bài viết để test thả tim", 
        "date": "2026-05-21",
        "mood": "happy"
    }
    create_res = await client.post("/api/diaries", data=payload, headers=headers)
    
    # 2. LẤY ID CỦA BÀI VỪA TẠO
    test_diary_id = create_res.json().get("id") 
    
    # 3. GỌI API THẢ TIM DỰA TRÊN ID ĐÓ
    response = await client.post(f"/api/diaries/{test_diary_id}/like", headers=headers)
    
    assert response.status_code == 200