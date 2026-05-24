import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Home, BookOpen, Image as ImageIcon, LogOut,Gamepad2Icon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import Music from './Music';
import Menu from './Menu';  
import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

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
            <NavLink to="/home" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
              <Home className="w-4 h-4" /> <span className="hidden md:inline">Trang chủ</span>
            </NavLink>
            <NavLink to="/diary" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
              <BookOpen className="w-4 h-4" /> <span className="hidden md:inline">Nhật ký</span>
            </NavLink>
            <NavLink to="/gallery" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
              <ImageIcon className="w-4 h-4" /> <span className="hidden md:inline">Thư viện</span>
            </NavLink>
            <NavLink to="/wheel" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
              <Gamepad2Icon className="w-4 h-4" /> <span className="hidden md:inline">Trò chơi</span>
            </NavLink>
            
          </div>

          <div className="w-px h-6 bg-pink-200/60 mx-1"></div>

          {/* CỤM NÚT CÔNG CỤ ĐÃ ĐƯỢC MODULE HÓA */}
          <Music />
          <NotificationBell />
          <Menu />

          {/* NÚT THOÁT */}
          <button 
            onClick={() => {
              navigate('/login'); 
              setTimeout(() => { logout(); }, 10);
            }}
            className="flex items-center gap-2 text-rose-600 hover:text-white bg-white/50 hover:bg-rose-500 p-2 sm:px-4 sm:py-2 rounded-full backdrop-blur-md transition-all text-sm font-bold shadow-sm"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Thoát</span>
          </button>

        </div>
      </div>
    </div>
  );
}