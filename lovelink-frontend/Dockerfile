# Giai đoạn 1: Build mã nguồn React/Vite
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Giai đoạn 2: Chạy web bằng Nginx
FROM nginx:alpine
# Lấy file đã build từ Giai đoạn 1 bỏ vào thư mục của Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Mở cổng 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]