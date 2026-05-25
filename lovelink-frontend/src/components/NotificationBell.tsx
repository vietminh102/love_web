import React, { useEffect, useState } from 'react';
import { Bell, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

interface AppNotification {
  id: string;
  actor_name: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string; // 🌟 Bổ sung thuộc tính link tùy chọn
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // 🌟 ĐÃ SỬA LỖI TẠI ĐÂY: Thêm fallback để VITE_API_URL không bao giờ bị undefined
  const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  const token = localStorage.getItem('token');
  const navigate = useNavigate(); // 🌟 Khởi tạo hook chuyển trang

  useEffect(() => {
    if (!token) return;

    // 1. Lấy lịch sử thông báo cũ
    const fetchHistory = async () => {
      try {
        const res = await apiClient.get('/notifications/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data);
      } catch (e) {
        console.error("Lỗi lấy thông báo", e);
      }
    };
    fetchHistory();

    // 2. Kết nối WebSocket realtime
    // BƯỚC 1: Cắt bỏ dấu gạch chéo (/) ở cuối link nếu vô tình bị dư
    const safeBaseUrl = VITE_API_URL.replace(/\/$/, '');
    
    // BƯỚC 2: Nối thêm '?token=' + token vào đuôi link để nộp vé cho Backend
    const wsUrl = safeBaseUrl.replace(/^http/, 'ws') + '/notifications/ws?token=' + token;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      const newNotif = JSON.parse(event.data);
      if (newNotif.type === 'sync_wheel_spin') {
        // Phát tín hiệu ra toàn trang web (để file LuckyWheelPage bắt được)
        window.dispatchEvent(new CustomEvent('triggerWheelSpin', { 
            detail: { prize_index: newNotif.prize_index, is_auto_delete: newNotif.is_auto_delete } 
        }));
        return; // Dừng luôn, không cho chạy xuống code thêm thông báo cái chuông nữa
      }
      // 🌟 2. THÊM TÍN HIỆU PHIM ẢNH (MỚI)
      if (newNotif.type === 'sync_video') {
        console.log("📡 TỔNG ĐÀI ĐÃ NHẬN WEBSOCKET TỪ BACKEND:", newNotif);
        
        // Chuyển tiếp tín hiệu này sang cho trang Rạp Chiếu Phim
        window.dispatchEvent(new CustomEvent('sync_video_event', { 
            detail: newNotif 
        }));
        return; // Dừng lại, không cho nó chạy xuống đoạn hiển thị chuông thông báo
    }
      setNotifications(prev => [newNotif, ...prev]);
    };

    return () => {
      ws.close();
    };
  }, [token, VITE_API_URL]);

  // HÀM XỬ LÝ KHI CLICK VÀO 1 THÔNG BÁO
  const handleNotificationClick = async (notif: AppNotification) => {
    // Bước A: Cập nhật ngay lập tức trạng thái ở giao diện (Optimistic UI) cho mượt
    setNotifications(prev =>
      prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
    );

    // Bước B: Gọi API báo cho Backend lưu trạng thái "Đã đọc" vào MongoDB
    try {
      await apiClient.post(`/notifications/${notif.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái đã đọc:", error);
    }

    // Bước C: Chuyển trang theo link đính kèm
    if (notif.link) {
      navigate(notif.link);
    }

    // Bước D: Đóng khay thông báo lại
    setShowDropdown(false);
  };

  // HÀM XỬ LÝ XÓA TỪNG THÔNG BÁO LẺ
  const handleDeleteSingle = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation(); // 🔥 QUAN TRỌNG: Ngăn chặn sự kiện click lan ra dòng thông báo (tránh bị nhảy trang hoặc đánh dấu đọc)
    
    // Cập nhật nhanh giao diện trước
    setNotifications(prev => prev.filter(n => n.id !== notifId));

    try {
      await apiClient.delete(`/notifications/${notifId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Lỗi xóa thông báo lẻ:", error);
    }
  };

  // HÀM XỬ LÝ XÓA SẠCH TOÀN BỘ THÔNG BÁO
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thông báo không?")) return;

    // Xóa sạch mảng trên giao diện
    setNotifications([]);

    try {
      await apiClient.delete('/notifications/clear/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Lỗi xóa toàn bộ thông báo:", error);
    }
  };

  // Đếm số thông báo chưa đọc thực tế
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    
   
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="relative">
      {/* Nút Chuông */}
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="p-2 rounded-full bg-white shadow-sm hover:bg-pink-50 relative transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Khay thả xuống danh sách thông báo */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-pink-100 overflow-hidden z-50"
          >
            <div className="p-4 bg-pink-50 border-b border-pink-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Thông báo</h3>

              {/* NÚT XÓA TẤT CẢ */}
              {notifications.length > 0 && (
                <button 
                  onClick={handleClearAll}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa tất cả
                </button>
              )}
            </div>
            
            <div className="max-h-75 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">Chưa có thông báo nào</div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 border-b border-gray-50 hover:bg-gray-100 flex items-center gap-3 cursor-pointer transition-colors group ${
                      notif.is_read ? 'opacity-70 bg-white' : 'bg-pink-50/40 font-medium'
                    }`}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                      {notif.type === 'like' ? '❤️' 
                        : notif.type === 'diary_like' ? '💖' 
                        : notif.type === 'gallery_upload' ? '📸' 
                        : notif.type === 'birthday_milestone' ? '🎂'  
                        : notif.type === 'anniversary_milestone' ? '🎉'
                        : notif.type === 'couple_paired' ? '🥂'
                        : '📝'}
                    </div>

                    {/* Nội dung chữ */}
                    <div className="flex-1 pr-2">
                      <p className="text-sm text-gray-800">
                        <span className="font-bold text-pink-600">{notif.actor_name}</span> {notif.message}
                      </p>
                      <span className="text-xs text-gray-400">
                        {formatTime(notif.created_at)}
                      </span>
                    </div>

                    {/* CỤM BÊN PHẢI: Chấm đỏ & Nút xóa (Dùng Flex xếp hàng ngang) */}
                    <div className="flex items-center gap-2 shrink-0">
                      
                      {/* Chấm tròn hồng hiển thị trạng thái chưa đọc */}
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-pink-500 rounded-full" />
                      )}

                      {/* NÚT XÓA: Màu xám nhạt tinh tế, rê chuột vào (hoặc chạm trên đt) sẽ báo đỏ */}
                      <button
                        onClick={(e) => handleDeleteSingle(e, notif.id)}
                        className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm bg-transparent border border-transparent hover:border-red-100"
                        title="Xóa thông báo này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}