import apiClient from './apiClient';

export const authService = {
  getMe: async () => {
    const token = localStorage.getItem('token'); // Lấy chìa khóa
    if (!token) throw new Error("Chưa đăng nhập");
    
    const response = await apiClient.get('/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  },
login: async (email: string, password: string) => {
    // Chỉ cần truyền thẳng 1 Object (JSON) cực kỳ đơn giản
    const response = await apiClient.post('/auth/login', {
      email: email, 
      password: password
    });
    
    return response.data;
  },
  
  register: async (userData: { 
    email: string; 
    password: string; 
    name?: string;     // SỬA Ở ĐÂY: Đổi display_name thành name
    gender?: string; 
    dob?: string 
  }) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },
  
  updateProfile: async (formData: FormData) => {
    // Lấy token từ localStorage
    const token = localStorage.getItem('token'); 
    
    const response = await apiClient.put('/auth/update-profile', formData, {
      headers: {
        // CHỈ gửi Authorization. Hãy để Axios tự động xử lý Content-Type cho FormData!
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  },
  deleteAccount: async () => {
    const token = localStorage.getItem('token');
    // Dùng phương thức DELETE cho chuẩn RESTful API
    const response = await apiClient.delete('/auth/delete-account', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }
};