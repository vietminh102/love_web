from sqlalchemy.ext.declarative import declarative_base
# ... các import khác

Base = declarative_base()

# QUAN TRỌNG: Import thư mục models vào ĐÂY (bên dưới Base)
# Thao tác này sẽ kích hoạt file __init__.py ở Bước 1, kéo tất cả các bảng vào Base.
import app.models