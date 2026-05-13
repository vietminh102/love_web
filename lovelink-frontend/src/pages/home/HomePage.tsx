import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Heart } from 'lucide-react';

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-lg w-full">
        <Heart className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse fill-red-500" />
        
        {/* QUAN TRỌNG: Dùng display_name thay vì name */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Chào mừng {user?.display_name}! 
        </h1>
        
        <p className="text-gray-600 mb-8">
          Hãy mời người ấy nhập mã kết đôi nhé.
        </p>
        
        <button 
          onClick={logout}
          className="flex items-center gap-2 mx-auto text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-5 h-5" /> Đăng xuất
        </button>
      </div>
    </div>
  );
}