import axios from 'axios';

const apiClient = axios.create({
  // Nhớ kiểm tra xem backend của bạn có dùng chữ /api không nhé
  // Nếu url backend chỉ là http://localhost:8000/auth/... thì nhớ xóa chữ /api ở đây đi
  baseURL: 'http://localhost:8000/api', 
});

export default apiClient;