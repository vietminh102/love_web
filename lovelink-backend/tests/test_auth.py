import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, auth_token: str):
    """Test đăng nhập bằng tài khoản đúng"""
    # Nếu auth_token lấy được thành công ở conftest, nghĩa là đăng nhập OK
    assert auth_token is not None
    assert len(auth_token) > 20 # Token JWT thường khá dài

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Test đăng nhập bằng mật khẩu sai (Phải báo lỗi 401 hoặc 400)"""
    response = await client.post(
        "/api/auth/login",
       json={"email": "test_lovelink@gmail.com", "password": "WrongPassword!"}
    )
    # Hệ thống phải chặn lại và trả về lỗi
    assert response.status_code in [400, 401, 404]
    
@pytest.mark.asyncio
async def test_get_current_user_profile(client: AsyncClient, auth_token: str):
    """Test dùng Token để vào trang cá nhân"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = await client.get("/api/auth/me", headers=headers) # Đổi URL này theo API của bạn
    
    assert response.status_code == 200
    assert response.json()["email"] == "test_lovelink@gmail.com"