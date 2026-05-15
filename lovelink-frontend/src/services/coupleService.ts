// file: src/services/coupleService.ts
import apiClient from './apiClient';

export const coupleService = {
  getMyCode: async () => {
    const token = localStorage.getItem('token');
    const response = await apiClient.get('/couple/info', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data; 
  },
  pairWithPartner: async (pairingCode: string) => {
    const token = localStorage.getItem('token');
    const response = await apiClient.post(
      '/couple/pair', 
      { pairing_code: pairingCode }, // Gửi body dạng JSON
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    return response.data;
  },
  getPartnerInfo: async () => {
    const token = localStorage.getItem('token');
    const response = await apiClient.get('/couple/partner', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  },
  unpair: async () => {
    const token = localStorage.getItem('token');
    const response = await apiClient.post('/couple/unpair', {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  },
  updateStartDate: async (newDate: string) => {
    const token = localStorage.getItem('token');
    const response = await apiClient.put(
      '/couple/start-date', 
      { new_start_date: newDate }, // VD: "2023-01-01T00:00:00Z"
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.data;
  },
  // Upload ảnh nền Couple
  uploadBackground: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/couple/background', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Xóa ảnh nền
  removeBackground: async () => {
    const response = await apiClient.delete('/couple/background');
    return response.data;
  },
};


