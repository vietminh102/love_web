import apiClient from './apiClient';

export const authService = {
  login: async (data: any) => { // Tạm thời để any để hết lỗi nhanh
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },
  register: async (data: any) => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  }
};