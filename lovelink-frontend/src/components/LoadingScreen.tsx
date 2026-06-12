import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

export const LoadingScreen = () => {
  const [showHelperText, setShowHelperText] = useState(false);

  useEffect(() => {
    // Nếu quá 3 giây mà màn hình này chưa biến mất, chứng tỏ Server đang "ngủ dậy"
    const timer = setTimeout(() => {
      setShowHelperText(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-pink-50/30">
      {/* Vòng xoay trái tim */}
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-pink-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin"></div>
        <Heart className="w-6 h-6 text-pink-500 animate-pulse" />
      </div>
      
      {/* Thông báo xoa dịu xuất hiện sau 3 giây */}
      {showHelperText && (
        <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h3 className="font-bold text-gray-700">Trạm tình yêu đang khởi động...</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            Hệ thống đang pha cà phê để tỉnh ngủ, bạn đợi xíu xiu khoảng 30 giây nha! ☕💕
          </p>
        </div>
      )}
    </div>
  );
};