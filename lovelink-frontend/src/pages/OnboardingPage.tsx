import React, { useState, useRef } from 'react';
import { authService } from '../services/authService';

export default function OnboardingPage() {
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [displayName, setDisplayName] = useState(storedUser.display_name || '');
  const [gender, setGender] = useState(storedUser.gender || '');
  const [dob, setDob] = useState(storedUser.dob || '');
  const [loading, setLoading] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // 🌟 State mới để quản lý ảnh đại diện
  const [avatarUrl, setAvatarUrl] = useState(storedUser.avatar_url || 'https://via.placeholder.com/150');
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // Lưu file thật để upload
  
  // Dùng Ref để kích hoạt nút chọn file ẩn
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🌟 Hàm xử lý khi user chọn file ảnh mới
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file); // Lưu file thật
      
      // Tạo URL tạm thời để hiển thị xem trước (preview)
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !gender || !dob) {
      return alert("Vui lòng điền đủ thông tin nha!");
    }
    
    setLoading(true);
    try {
      // 1. Cập nhật thông tin JSON (Tên, giới tính, ngày sinh)
      const onboardingResponse = await authService.updateOnboarding({ 
        display_name: displayName, 
        gender, 
        dob 
      });

      if (onboardingResponse.success) {
        // Lưu user tạm thời
        let updatedUser = onboardingResponse.user;

        // 2. 🌟 NẾU CÓ CHỌN FILE ẢNH MỚI -> Gọi API tải ảnh lên
        if (avatarFile) {
          try {
            const avatarResponse = await authService.uploadAvatar(avatarFile);
            if (avatarResponse.success) {
              // Cập nhật lại user mới nhất chứa URL ảnh
              updatedUser = avatarResponse.user;
            }
          } catch (imgErr) {
            console.error("Lỗi tải ảnh:", imgErr);
            alert("Lưu thông tin xong nhưng không tải được ảnh. Bạn có thể sửa ảnh sau nhé!");
          }
        }

        // 3. Cập nhật localStorage và vào trang chủ
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.href = '/home';
      }
    } catch (error) {
      alert("Có lỗi xảy ra, thử lại giúp mình nhé!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-pink-100 text-center">
        <span className="text-4xl">💝</span>
        <h2 className="text-2xl font-bold text-gray-800 mt-2 mb-1">Chào mừng đến với LoveLe!</h2>
        <p className="text-gray-500 text-sm mb-6">Hãy hoàn thiện hồ sơ của bạn nhé!</p>
        
        <form onSubmit={handleSubmit} className="text-left space-y-5">
          
          {/* 🌟 THÊM: KHU VỰC SỬA ẢNH ĐẠI DIỆN */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="relative group">
              <img 
                src={
                  avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:')
                    ? avatarUrl // Trả về nguyên gốc nếu là ảnh nháp (Base64 hoặc Blob)
                    : avatarUrl.startsWith('http')
                      ? avatarUrl.replace('http://localhost:8000', API_BASE_URL) // Gọt rác localhost hoặc giữ nguyên ảnh placeholder
                      : `${API_BASE_URL}$/{avatarUrl}` // Ghép link nếu là đường dẫn chuẩn /static/...
                } 
                alt="Avatar" 
                className="w-24 h-24 rounded-full object-cover border-4 border-pink-100 shadow-inner"
              />
              {/* Nút bấm thay đổi ảnh đè lên khi hover */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Sửa ảnh
              </button>
            </div>
            {/* Input file bị ẩn */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          {/* Ô sửa Tên hiển thị */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Biệt danh của bạn</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hoặc biệt danh..."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-400 focus:outline-none text-gray-800 font-medium"
            />
          </div>

          {/* Chọn giới tính */}
          {/* Chọn giới tính */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Giới tính</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button" // 👈 Bắt buộc phải có type="button" để không kích hoạt submit form
                onClick={() => setGender('male')}
                className={`p-2.5 border rounded-xl text-center font-medium transition-all ${
                  gender === 'male' || gender === 'Nam' 
                    ? 'bg-pink-500 text-white border-pink-500 shadow' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                🙋‍♂️ Nam
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`p-2.5 border rounded-xl text-center font-medium transition-all ${
                  gender === 'female' || gender === 'Nữ'
                    ? 'bg-pink-500 text-white border-pink-500 shadow' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                🙋‍♀️ Nữ
              </button>
            </div>
          </div>

          {/* Chọn ngày sinh */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-400 focus:outline-none"
            />
          </div>

          {/* Nút lưu */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-pink-500 to-rose-500 text-white p-3.5 rounded-xl font-bold mt-6 shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Đang lưu hồ sơ...' : 'Sẵn sàng 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}