import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, Sparkles, BellRing, Clock, Plus, 
  ListTodo, Type, MessageSquare, Mail, Trash2, CheckCircle2 
} from 'lucide-react';
import { reminderService } from '../../services/reminderService'; 

// Cấu hình kiểu dữ liệu cho Trái tim bay để không bị lỗi giật lag giao diện
interface HeartConfig {
  id: string;
  left: string;
  top: string;
  delay: string;
  size: string;
}

interface ReminderItem {
  id: string;
  title: string;
  message: string;
  time: string;
  sendEmail: boolean;
  isTriggered: boolean; 
}

function ReminderPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [remindTime, setRemindTime] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [canUseEmail, setCanUseEmail] = useState(true);

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Khóa vị trí ngẫu nhiên của các trái tim nền để giao diện không bị chớp giật khi gõ phím
  const randomHearts = useMemo<HeartConfig[]>(() => {
    return [...Array(6)].map((_, i) => ({
      id: `floating-heart-${i}`,
      left: `${20 + Math.random() * 60}%`,
      top: `${40 + Math.random() * 40}%`,
      delay: `${Math.random() * 2}s`,
      size: `${14 + Math.random() * 10}px`
    }));
  }, []);

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16); 
  };

  const fetchReminders = async () => {
    try {
      setIsLoading(true);
      

      try {
        const statusData = await reminderService.checkEmailStatus();
        setCanUseEmail(statusData.can_use_email);
        
        // Nếu không được phép dùng mail, tự động gạt nút về Tắt
        if (!statusData.can_use_email) {
          setSendEmail(false);
        }
      } catch (e) {
        console.error("Lỗi khi kiểm tra quyền sử dụng Email:", e);
      }

      // Logic tải danh sách lời nhắc cũ giữ nguyên
      const data = await reminderService.getReminders();
      if (Array.isArray(data)) {
        const formattedData = data.map((item: any, index: number) => ({
          id: item.id || item._id || `safe-key-${index}`,
          title: item.title,
          message: item.message,
          time: item.remind_time.endsWith('Z') ? item.remind_time : item.remind_time + 'Z',
          sendEmail: item.send_email,
          isTriggered: item.is_triggered || false
        }));
        setReminders(formattedData);
      }
    } catch (error) {
      console.error("Lỗi lấy danh sách lời nhắc:", error);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchReminders();
  }, []);

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (new Date(remindTime) <= new Date()) {
      alert("Thời gian báo thức phải lớn hơn hiện tại nhé bé! 💕");
      return;
    }

    try {
      await reminderService.createReminder({
        title,
        message,
        remind_time: new Date(remindTime).toISOString(),
        send_email: sendEmail
      });

      await fetchReminders();
      

      window.dispatchEvent(new Event('reload_global_alarms'));

      // Reset form
      setTitle(''); setMessage(''); setRemindTime(''); setSendEmail(true);
      setActiveTab('list');
      alert("Đã thêm lời nhắc thành công! ⏰");
    } catch (error) {
      alert("Có lỗi khi lưu lời nhắc!");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc muốn xóa lời nhắc này không?")) {
      try {
        await reminderService.deleteReminder(id);
        setReminders(reminders.filter(r => r.id !== id));
      } catch (error) {
        alert("Có lỗi khi xóa lời nhắc!");
        console.error(error);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-pink-100 via-purple-100 to-red-100 relative overflow-hidden">
      
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {randomHearts.map((heart) => (
          <Heart
            key={heart.id}
            className="absolute text-pink-300 fill-pink-300 opacity-60 animate-[float-up_2s_ease-in-out_infinite]"
            style={{
              left: heart.left,
              top: heart.top,
              animationDelay: heart.delay,
              width: heart.size,
              height: heart.size,
            }}
          />
        ))}
        <Heart className="absolute top-10 left-10 w-8 h-8 text-pink-300 opacity-20 animate-pulse" />
        <Heart className="absolute top-32 right-20 w-6 h-6 text-rose-300 opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        <Heart className="absolute bottom-20 left-1/4 w-10 h-10 text-red-300 opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        <Heart className="absolute bottom-40 right-1/3 w-7 h-7 text-pink-300 opacity-25 animate-pulse" style={{ animationDelay: '1.5s' }} />
        <Sparkles className="absolute top-1/4 right-10 w-8 h-8 text-purple-300 opacity-20 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <Sparkles className="absolute bottom-1/3 left-16 w-6 h-6 text-pink-300 opacity-30 animate-pulse" style={{ animationDelay: '2.5s' }} />
      </div>

      <div className="w-full max-w-lg px-6 relative z-10 py-12 h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-linear-to-br from-pink-400 via-rose-400 to-red-500 rounded-full mb-4 shadow-2xl animate-pulse">
            <BellRing className="w-10 h-10 text-white animate-[wiggle_1s_ease-in-out_infinite]" />
          </div>
          <h1 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-linear-to-r from-pink-600 to-rose-600">
            Nhắc Nhở Tình Yêu
          </h1>
        </div>

        {/* Khung chính */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/50 flex-1 overflow-hidden flex flex-col max-h-[70vh]">
          
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl shrink-0">
            <button onClick={() => setActiveTab('list')} className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 font-semibold ${activeTab === 'list' ? 'bg-linear-to-r from-pink-400 to-rose-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
              <ListTodo className="w-4 h-4" /> Danh sách
            </button>
            <button onClick={() => setActiveTab('create')} className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 font-semibold ${activeTab === 'create' ? 'bg-linear-to-r from-pink-400 to-rose-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
              <Plus className="w-4 h-4" /> Tạo mới
            </button>
          </div>

          {/* TAB 1: DANH SÁCH LỜI NHẮC */}
          {activeTab === 'list' && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {isLoading ? (
                <div className="text-center text-pink-400 font-medium py-10">Đang tải dữ liệu... 🌸</div>
              ) : reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 opacity-70">
                  <BellRing className="w-12 h-12 mb-3 text-pink-200" />
                  <p>Chưa có lời nhắc nào được tạo.</p>
                </div>
              ) : (
                reminders.map((item) => (
                  <div key={item.id} className={`p-4 border rounded-2xl relative transition-all ${item.isTriggered ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-pink-50/60 border-pink-100 hover:shadow-md'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-bold text-lg pr-8 ${item.isTriggered ? 'text-gray-500' : 'text-gray-800'}`}>{item.title}</h3>
                      <button onClick={() => handleDelete(item.id)} className="absolute right-4 top-4 text-gray-400 hover:text-red-500 transition-colors p-1" title="Xóa">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <p className={`text-sm mb-3 ${item.isTriggered ? 'text-gray-400' : 'text-gray-600'}`}>{item.message}</p>
                    
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      {item.isTriggered ? (
                        <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full shadow-sm text-green-500">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã xong
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full shadow-sm text-pink-500">
                          <Clock className="w-3.5 h-3.5" /> 
                          {new Date(item.time).toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' })}
                        </span>
                      )}

                      {item.sendEmail && (
                        <span className={`flex items-center gap-1 bg-white px-2.5 py-1 rounded-full shadow-sm ${item.isTriggered ? 'text-gray-400' : 'text-blue-500'}`}>
                          <Mail className="w-3.5 h-3.5" /> Mail
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: FORM TẠO LỜI NHẮC */}
          {activeTab === 'create' && (
            <form onSubmit={handleSaveReminder} className="space-y-5 overflow-y-auto pr-2 custom-scrollbar flex-1">
              <div>
                <label className="block mb-2 text-sm font-bold text-gray-700">Tiêu đề ngắn gọn</label>
                <div className="relative">
                  <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Đến giờ uống thuốc!" className="w-full pl-12 pr-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-800" />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-bold text-gray-700">Lời nhắn nhủ</label>
                <div className="relative">
                  <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-pink-400" />
                  <textarea required rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="VD: Nhớ uống nhiều nước nha bé yêu ❤️" className="w-full pl-12 pr-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-800 resize-none" />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-bold text-gray-700">Thời gian báo thức</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                  <input 
                    type="datetime-local" 
                    required 
                    value={remindTime} 
                    onChange={(e) => setRemindTime(e.target.value)} 
                    min={getMinDateTime()} 
                    className="w-full pl-12 pr-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-800" 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-4">
                <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${canUseEmail ? 'bg-pink-50 border-pink-100' : 'bg-gray-100 border-gray-200 opacity-70'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${canUseEmail ? 'bg-pink-200 text-pink-600' : 'bg-gray-200 text-gray-500'}`}>
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${canUseEmail ? 'text-gray-700' : 'text-gray-500'}`}>Gửi kèm Email</p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">Báo về Gmail của cả hai</p>
                    </div>
                  </div>
                  
                  {/* Nút Gạt */}
                  <button 
                    type="button" 
                    disabled={!canUseEmail} // 🛑 KHÓA NÚT NẾU KHÔNG CÓ EMAIL
                    onClick={() => setSendEmail(!sendEmail)} 
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out shrink-0 ${canUseEmail && sendEmail ? 'bg-pink-500' : 'bg-gray-300'} ${!canUseEmail ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${sendEmail ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                {/* 🚨 HIỂN THỊ DÒNG CHỮ CẢNH BÁO MÀU ĐỎ NẾU CHƯA CÓ EMAIL */}
                {!canUseEmail && (
                  <p className="text-red-500 text-xs italic font-medium px-2 animate-pulse">
                    * Bạn hoặc người ấy chưa có Email (chứa dấu @) trong hồ sơ. Hãy vào mục Cá nhân để cập nhật nhé!
                  </p>
                )}
              </div>

              <button type="submit" className="w-full py-4 mt-2 bg-linear-to-r from-pink-400 via-rose-500 to-red-500 text-white font-bold rounded-xl hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Lưu Lời Nhắc
              </button>
            </form>
          )}

        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fbcfe8; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f472b6; }
      `}</style>
    </div>
  );
}

export default ReminderPage;