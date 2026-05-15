from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.db.nosql import connect_to_mongo, close_mongo_connection
from app.api import auth, diary
from fastapi.staticfiles import StaticFiles
from app.api import  couple


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Chạy khi server khởi động
    await connect_to_mongo()
    print("🚀 Server đang chạy...")
    yield
    # Chạy khi server tắt
    await close_mongo_connection()

app = FastAPI(lifespan=lifespan)


app.mount("/static", StaticFiles(directory="static"), name="static")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"], # Cho phép GET, POST, PUT, DELETE...
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api")
app.include_router(couple.router, prefix="/api")
app.include_router(diary.router, prefix="/api")
@app.get("/")
async def root():
    return {"message": "Welcome to Lovelink API!"}

# uvicorn app.main:app --reload