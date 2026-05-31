import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Home, BookOpen, Image as ImageIcon, Gamepad2Icon, FilmIcon, MoreHorizontal, AlarmClock, MusicIcon, LocateIcon} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import Music from './Music';
import Menu from './Menu';   

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);



  if (location.pathname === '/auth') return null;

  return (
    <div className="fixed top-4 left-0 w-full z-50 px-4 pointer-events-none">
      <div className="max-w-5xl mx-auto bg-pink-100/90 backdrop-blur-md rounded-full px-4 py-2 flex items-center justify-between shadow-sm border border-white/50 pointer-events-auto">
        
        <div className="flex items-center gap-2 pl-2">
          <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
          <span className="hidden sm:inline text-xl font-black text-pink-600 tracking-tight font-serif drop-shadow-sm">LoveLe</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1 mr-2">
            {/* --- 3 NÚT HIỂN THỊ CỐ ĐỊNH --- */}
            <NavLink to="/home" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
              <Home className="w-4 h-4" /> <span className="hidden md:inline">Trang chủ</span>
            </NavLink>
            <NavLink to="/diary" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
              <BookOpen className="w-4 h-4" /> <span className="hidden md:inline">Nhật ký</span>
            </NavLink>
            <NavLink to="/gallery" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
              <ImageIcon className="w-4 h-4" /> <span className="hidden md:inline">Thư viện</span>
            </NavLink>
            
            {/* --- KHU VỰC NÚT "THÊM" & DROPDOWN MENU --- */}
            <div className="relative">
              {/* Nút Bấm "Thêm" */}
              <button 
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                // Khi click ra ngoài thì tự động đóng menu
                onBlur={() => setTimeout(() => setIsMoreOpen(false), 200)}
                className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isMoreOpen ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}
              >
                <MoreHorizontal className="w-4 h-4" /> <span className="hidden md:inline">Thêm</span>
              </button>

              {/* Hộp Menu thả xuống (Chỉ hiện khi isMoreOpen = true) */}
              {isMoreOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-pink-100 py-2 z-50 flex flex-col gap-1 overflow-hidden transform transition-all">
                  
                  <NavLink 
                    to="/wheel" 
                    onClick={() => setIsMoreOpen(false)} // Bấm xong tự đóng
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 transition-all font-semibold text-sm ${isActive ? 'bg-pink-50 text-pink-600 border-r-4 border-pink-500' : 'text-gray-600 hover:bg-pink-50 hover:text-pink-500'}`}
                  >
                    <Gamepad2Icon className="w-4 h-4" /> <span>Trò chơi</span>
                  </NavLink>
                  
                  <NavLink 
                    to="/watch" 
                    onClick={() => setIsMoreOpen(false)} // Bấm xong tự đóng
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 transition-all font-semibold text-sm ${isActive ? 'bg-pink-50 text-pink-600 border-r-4 border-pink-500' : 'text-gray-600 hover:bg-pink-50 hover:text-pink-500'}`}
                  >
                    <FilmIcon className="w-4 h-4" /> <span>Xem chung</span>
                  </NavLink>
                  <NavLink 
                    to="/music" 
                    onClick={() => setIsMoreOpen(false)} // Bấm xong tự đóng
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 transition-all font-semibold text-sm ${isActive ? 'bg-pink-50 text-pink-600 border-r-4 border-pink-500' : 'text-gray-600 hover:bg-pink-50 hover:text-pink-500'}`}
                  >
                    <MusicIcon className="w-4 h-4" /> <span>Nghe nhạc</span>
                  </NavLink>

                  <NavLink 
                    to="/location" 
                    onClick={() => setIsMoreOpen(false)} // Bấm xong tự đóng
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 transition-all font-semibold text-sm ${isActive ? 'bg-pink-50 text-pink-600 border-r-4 border-pink-500' : 'text-gray-600 hover:bg-pink-50 hover:text-pink-500'}`}
                  >
                    <LocateIcon className="w-4 h-4" /> <span>Vị trí</span>
                  </NavLink>

                  <NavLink 
                    to="/reminder"
                    // 🌟 ĐÃ SỬA: Khi bấm vào thì đóng cái Menu "Thêm" lại
                    onClick={() => setIsMoreOpen(false)}
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 transition-all font-semibold text-sm ${isActive ? 'bg-pink-50 text-pink-600 border-r-4 border-pink-500' : 'text-gray-600 hover:bg-pink-50 hover:text-pink-500'}`}
                  >
                    <AlarmClock className="w-4 h-4" /> <span>Đặt lời nhắc</span>
                  </NavLink >
                  
                </div>
              )}
            </div>
            
          </div>

          <div className="w-px h-6 bg-pink-200/60 mx-1"></div>

          {/* CỤM NÚT CÔNG CỤ ĐÃ ĐƯỢC MODULE HÓA */}
          <Music />
          <NotificationBell />
          <Menu />

        </div>
      </div>
    </div>
  );
}