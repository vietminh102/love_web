import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api', 
});

// ================= BỘ LỌC TỰ ĐỘNG GẮN TOKEN =================
apiClient.interceptors.request.use(
  (config) => {
    // 1. Lấy token từ LocalStorage
    const token = localStorage.getItem('token');
    
    // 2. Nếu có token, dán nó vào Header Authorization
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ================= BỘ LỌC TỰ ĐỘNG XỬ LÝ LỖI 401 =================
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Nếu Backend báo lỗi 401 (Token hết hạn hoặc sai), tự động đá ra trang login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
    }
    return Promise.reject(error);
  }
);

export default apiClient;