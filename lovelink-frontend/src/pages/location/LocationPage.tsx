import React from 'react';
import { LiveLocation } from '../../components/LiveLocation'; 

export const LocationPage = () => {
  return (
    <div className="min-h-screen bg-[#fff5f7] pt-8 pb-12 flex flex-col items-center">
      
      {/* KHU VỰC TIÊU ĐỀ TRANG (HEADER) */}
      <div className="w-full max-w-5xl px-4 text-center mb-6 animate-in slide-in-from-top-4 pt-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 drop-shadow-sm">
          Bản Đồ Yêu Thương 🗺️
        </h1>
        <p className="text-sm sm:text-base text-pink-500 font-medium mt-2">
          Dù ở đâu, chúng ta vẫn luôn nhìn thấy nhau! 💕
        </p>
      </div>

      {/* KHU VỰC CHỨA BẢN ĐỒ (Nhúng Component vào đây) */}
      <div className="w-full px-2 sm:px-0">
        <LiveLocation />
      </div>

    </div>
  );
};