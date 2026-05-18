import apiClient from './apiClient';

export const galleryService = {
  // 1. Lấy danh sách ảnh (Đã tự động phân loại FA/Couple ở Backend)
  getPhotos: async () => {
    const token = localStorage.getItem('token');
    const response = await apiClient.get('/gallery/', {
      headers: { 
        Authorization: `Bearer ${token}` 
      }
    });
    return response.data;
  },

  // 2. Tải ảnh kỷ niệm mới lên
  uploadPhoto: async (file: File) => {
    const token = localStorage.getItem('token');
    
    // Gói file vào FormData để gửi đi
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/gallery/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`
      },
    });
    return response.data;
  },
  //hàm xóa ảnh
  deletePhoto: async (id: string) => {
    const token = localStorage.getItem('token');
    const response = await apiClient.delete(`/gallery/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // hàm thả tim
  toggleLike: async (id: string) => {
    const token = localStorage.getItem('token');
    const response = await apiClient.post(`/gallery/${id}/like`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};