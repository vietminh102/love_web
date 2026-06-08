import React, { useEffect, useState, useRef } from 'react';
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
  link?: string; 
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const token = localStorage.getItem('token');
  const navigate = useNavigate(); 


  // KHO CHỨA BÁO THỨC TOÀN CẦU & BÁC BẢO VỆ CHẠY NGẦM
  const [globalAlarms, setGlobalAlarms] = useState<any[]>([]);
  const alarmsRef = useRef(globalAlarms);

  // Đồng bộ ref liên tục để setInterval không bị nuốt chứng dữ liệu cũ (stale closure)
  useEffect(() => { 
    alarmsRef.current = globalAlarms; 
  }, [globalAlarms]);

  // Hàm chuyên trách tải danh sách báo thức chưa kêu từ cơ sở dữ liệu
  const fetchGlobalAlarms = () => {
    if (!token) return;
    apiClient.get('/reminders', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const pending = res.data
          .filter((r: any) => !r.is_triggered)
          .map((r: any) => ({
            id: r.id || r._id,
            title: r.title,
            message: r.message,
            time: r.remind_time.endsWith('Z') ? r.remind_time : r.remind_time + 'Z',
            isTriggered: false
          }));
        setGlobalAlarms(pending);
      }).catch(e => console.error("Lỗi tải báo thức ngầm:", e));
  };

  // Quản lý việc nạp danh sách báo thức ban đầu VÀ lắng nghe lệnh nạp lại khi tạo mới
  useEffect(() => {
    fetchGlobalAlarms();

    // Lắng nghe loa phát thanh từ trang tạo báo thức để nạp lại ngay lập tức
    window.addEventListener('reload_global_alarms', fetchGlobalAlarms);
    return () => {
      window.removeEventListener('reload_global_alarms', fetchGlobalAlarms);
    };
  }, [token]);

  // Bác bảo vệ đi tuần định kỳ mỗi 5 giây trên phạm vi toàn hệ thống
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      const now = new Date();
      alarmsRef.current.forEach(async (alarm) => {
        if (!alarm.isTriggered && new Date(alarm.time) <= now) {
          
          alarm.isTriggered = true; // Khóa chốt an toàn tránh reo lặp lại


          window.dispatchEvent(new CustomEvent('sync_video_event', { 
            detail: { action: 'trigger_alarm', payload: { title: alarm.title, message: alarm.message } } 
          }));
          
          try {
            // Cập nhật trạng thái đã kêu lên server MongoDB
            await apiClient.patch(`/reminders/${alarm.id}/trigger`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (error) {
            console.error("Lỗi cập nhật trigger báo thức:", error);
          }
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);


  // KẾT NỐI ĐƯỜNG TRUYỀN WEBSOCKET REALTIME
  useEffect(() => {
    if (!token) return;

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

    const safeBaseUrl = VITE_API_URL.replace(/\/$/, '');
    const wsUrl = safeBaseUrl.replace(/^http/, 'ws') + '/notifications/ws?token=' + token;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      const newNotif = JSON.parse(event.data);
      
      // Màng lọc 1: Vòng quay may mắn
      if (newNotif.type === 'sync_wheel_spin') {
        window.dispatchEvent(new CustomEvent('triggerWheelSpin', { 
            detail: { prize_index: newNotif.prize_index, is_auto_delete: newNotif.is_auto_delete } 
        }));
        return; 
      }
      
      // Rạp chiếu phim đồng bộ video
      if (newNotif.type === 'sync_video') {
        window.dispatchEvent(new CustomEvent('sync_video_event', { detail: newNotif }));
        return; 
      }

      if (newNotif.type === 'sync_alarm') {
        
        window.dispatchEvent(new Event('reload_global_alarms'));
        
        return; 
      }

      // Các thông báo tương tác thả tim, viết nhật ký thông thường
      setNotifications(prev => [newNotif, ...prev]);
    };

    return () => {
      ws.close();
    };
  }, [token, VITE_API_URL]);


  // CÁC HÀM XỬ LÝ GIAO DIỆN

  const handleNotificationClick = async (notif: AppNotification) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
    try {
      await apiClient.post(`/notifications/${notif.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái đã đọc:", error);
    }
    if (notif.link) {
      navigate(notif.link);
    }
    setShowDropdown(false);
  };

  const handleDeleteSingle = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation(); 
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    try {
      await apiClient.delete(`/notifications/${notifId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Lỗi xóa thông báo lẻ:", error);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thông báo không?")) return;
    setNotifications([]);
    try {
      await apiClient.delete('/notifications/clear/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Lỗi xóa toàn bộ thông báo:", error);
    }
  };

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
                notifications.map((notif, index) => (
                  <div 
                    key={notif.id || (notif as any)._id || `notif-item-${index}`} 
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 border-b border-gray-50 hover:bg-gray-100 flex items-center gap-3 cursor-pointer transition-colors group ${
                      notif.is_read ? 'opacity-70 bg-white' : 'bg-pink-50/40 font-medium'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                      {notif.type === 'like' ? '❤️' 
                        : notif.type === 'diary_like' ? '💖' 
                        : notif.type === 'gallery_upload' ? '📸' 
                        : notif.type === 'birthday_milestone' ? '🎂'  
                        : notif.type === 'anniversary_milestone' ? '🎉'
                        : notif.type === 'couple_paired' ? '🥂'
                        : '📝'}
                    </div>

                    <div className="flex-1 pr-2">
                      <p className="text-sm text-gray-800">
                        <span className="font-bold text-pink-600">{notif.actor_name}</span> {notif.message}
                      </p>
                      <span className="text-xs text-gray-400">
                        {formatTime(notif.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-pink-500 rounded-full" />
                      )}
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