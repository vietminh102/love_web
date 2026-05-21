import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.sql import get_db # Import dependency thật của bạn
from app.models.Users import Users  # Import model Users của bạn
from app.core.security import get_password_hash
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
# NHỚ IMPORT MODEL DIARY CỦA BẠN (Đường dẫn có thể khác tùy cấu trúc thư mục)
from app.models.nosql import Diary

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:130404@localhost:5432/lovelink_core"
engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session
app.dependency_overrides[get_db] = override_get_db
# 3. Tạo DB fixture nếu bạn cần truy vấn DB trực tiếp bên trong các hàm test
@pytest_asyncio.fixture(autouse=True)
async def init_mongodb():
    """Tự động khởi tạo kết nối MongoDB riêng cho môi trường Test"""
    # Thay đổi URL này nếu bạn dùng MongoDB Atlas hoặc có mật khẩu
    mongo_url = "mongodb://localhost:27017" 
    client = AsyncIOMotorClient(mongo_url)
    
    # Tạo một database riêng tên là 'lovelink_test_mongo' để không đụng vào DB thật
    await init_beanie(database=client.lovelink_test_mongo, document_models=[Diary])
    
    yield
    
    # Dọn dẹp: Xóa sạch dữ liệu test sau khi chạy xong để lần sau test chạy lại từ đầu
    await client.drop_database("lovelink_test_mongo")
@pytest_asyncio.fixture
async def db():
    async with TestingSessionLocal() as session:
        yield session
# 1. Fixture tạo Client ảo (Dùng chung cho mọi bài test)
@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

# 2. Fixture tạo sẵn một Token đăng nhập (Để test các API cần bảo mật)
@pytest_asyncio.fixture
async def auth_token(client: AsyncClient, db: AsyncSession):
    # 1. KHỞI TẠO DỮ LIỆU: Insert thẳng vào DB
    test_email = "test_lovelink@gmail.com"
    test_password = "CorrectPassword"
    
    # Kiểm tra xem user đã tồn tại chưa (tránh lỗi trùng lặp khi chạy test nhiều lần)
    from sqlalchemy import select
    result = await db.execute(select(Users).where(Users.email == test_email))
    existing_user = result.scalars().first()
    
    if not existing_user:
        new_user = Users(
            email=test_email,
            password_hash=get_password_hash(test_password), # Băm mật khẩu
            display_name="Test User"
        )
        db.add(new_user)
        await db.commit()
    
    # 2. TIẾN HÀNH ĐĂNG NHẬP
    response = await client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_password}
    )
    
    assert response.status_code == 200, f"Đăng nhập khi setup test thất bại: {response.text}"
    return response.json().get("access_token")