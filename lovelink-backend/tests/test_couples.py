import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_my_pairing_code(client: AsyncClient, auth_token: str):
    """Test xem tài khoản có sinh ra mã ghép đôi hay không"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Gửi request kèm Token
    response = await client.get("/api/couples/info", headers=headers)
    
    assert response.status_code == 404
    data = response.json()
    
    assert data["detail"] == "Not Found"