import apiClient from './apiClient';

export const authService = {
  login: async (data: any) => { 
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },
  
  register: async (data: any) => {
    const response = await apiClient.post('/auth/register', data);
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