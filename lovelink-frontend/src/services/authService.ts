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
  }
};