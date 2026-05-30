import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 15000,
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
    // 1. Xử lý lỗi Token hết hạn (Lỗi 401)
    if (error.response && error.response.status === 401) {
      console.warn("Phiên đăng nhập hết hạn! Đang dọn dẹp...");
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Đá người dùng về trang đăng nhập ngay lập tức
      window.location.href = '/login'; 
    }
    
    // 2. Xử lý lỗi Backend ngủ đông hoặc mất mạng (Timeout)
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      alert('Máy chủ đang khởi động lại hoặc mạng yếu. Vui lòng thử lại sau vài giây nhé! ⏳');
    }

    return Promise.reject(error);
  }
);

export default apiClient;