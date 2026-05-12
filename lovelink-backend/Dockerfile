FROM python:3.11-slim

# Thư mục làm việc trong container
WORKDIR /app

# Cài đặt các thư viện hệ thống C/C++ cần thiết cho asyncpg (PostgreSQL)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements và cài đặt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code vào
COPY . .

# Mở cổng 8000
EXPOSE 8000

# Lệnh chạy server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]