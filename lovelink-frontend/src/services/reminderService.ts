import apiClient from './apiClient';

export const reminderService = {
  // Lấy danh sách lời nhắc
  getReminders: async () => {
    const response = await apiClient.get('/reminders');
    return response.data;
  },
  
  // Tạo lời nhắc mới
  createReminder: async (data: { title: string; message: string; remind_time: string; send_email: boolean }) => {
    const response = await apiClient.post('/reminders', data);
    return response.data;
  },

  // Xóa lời nhắc
  deleteReminder: async (id: string) => {
    const response = await apiClient.delete(`/reminders/${id}`);
    return response.data;
  },

  // Đánh dấu lời nhắc đã kêu
  markAsTriggered: async (id: string) => {
    const response = await apiClient.patch(`/reminders/${id}/trigger`);
    return response.data;
  },


  checkEmailStatus: async () => {


    const response = await apiClient.get('/reminders/check-email-status');
    return response.data;
  }
};