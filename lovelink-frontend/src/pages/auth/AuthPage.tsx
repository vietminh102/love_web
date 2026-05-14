import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Heart, Mail, Lock, User, Sparkles,Calendar } from 'lucide-react'; 
import React, { useState } from 'react';
import { authService } from '../../services/authService';

// 1. Định nghĩa kiểu dữ liệu cho Form
interface AuthFormData {
  email: string;
  password: string;
  name?: string; 
  gender?: string; 
  dob?: string;   
}

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // 2. Chỉ dùng MỘT state duy nhất để quản lý dữ liệu nhập vào (Xóa bỏ email/password dư thừa)
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    name: '',
    gender: 'other', 
    dob: ''
  });

  // 3. Hàm xử lý submit chuẩn xác
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Xóa thông báo lỗi cũ khi bắt đầu gửi
    
    if (isLogin) {
      // LUỒNG ĐĂNG NHẬP: Lấy data trực tiếp từ formData
      const result = await login(formData.email, formData.password); 
      
      if (result.success) {
        navigate('/'); 
      } else {
        setError(result.message || "Đăng nhập thất bại");
      }
    } else {
      // LUỒNG ĐĂNG KÝ (Dự phòng logic cho bạn)
      try {
        // Giả sử trong authService bạn có hàm register
        await authService.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          gender: formData.gender, 
          dob: formData.dob        
        });
        
        // Đăng ký thành công -> Tự động đăng nhập luôn
        const loginResult = await login(formData.email, formData.password);
        if (loginResult.success) {
          navigate('/');
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Đăng ký thất bại. Email có thể đã tồn tại.");
      }
    }
  };

  const handleChange = (field: keyof AuthFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-pink-100 via-purple-100 to-red-100 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Heart className="absolute top-10 left-10 w-8 h-8 text-pink-300 opacity-20 animate-pulse" />
        <Heart className="absolute top-32 right-20 w-6 h-6 text-rose-300 opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        <Heart className="absolute bottom-20 left-1/4 w-10 h-10 text-red-300 opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        <Heart className="absolute bottom-40 right-1/3 w-7 h-7 text-pink-300 opacity-25 animate-pulse" style={{ animationDelay: '1.5s' }} />
        <Sparkles className="absolute top-1/4 right-10 w-8 h-8 text-purple-300 opacity-20 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <Sparkles className="absolute bottom-1/3 left-16 w-6 h-6 text-pink-300 opacity-30 animate-pulse" style={{ animationDelay: '2.5s' }} />
      </div>

      <div className="w-full max-w-md px-6 relative z-10 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-linear-to-br from-pink-400 via-rose-400 to-red-500 rounded-full mb-4 shadow-2xl animate-pulse">
            <div className="flex gap-1">
              <Heart className="w-8 h-8 text-white fill-white -rotate-12" />
              <Heart className="w-8 h-8 text-white fill-white rotate-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-linear-to-r from-pink-600 to-rose-600">
            {isLogin ? 'Chào mừng trở lại' : 'Bắt đầu hành trình'}
          </h1>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/50">
          
          {/* Tabs Đăng nhập / Đăng ký */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2 rounded-lg transition-all ${isLogin ? 'bg-linear-to-r from-pink-400 to-rose-500 text-white shadow-md' : 'text-gray-600'}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2 rounded-lg transition-all ${!isLogin ? 'bg-linear-to-r from-pink-400 to-rose-500 text-white shadow-md' : 'text-gray-600'}`}
            >
              Đăng ký
            </button>
          </div>

          {/* Hiển thị lỗi đỏ nếu có */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-500 rounded-xl text-sm text-center font-medium">
              {error}
            </div>
          )}

<form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                {/* 1. Nhập Tên */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Tên của bạn</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Tên bạn"
                      className="w-full pl-12 pr-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                      required={!isLogin}
                    />
                  </div>
                </div>

                {/* 2. Chọn Giới tính */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Giới tính</label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-all ${formData.gender === 'male' ? 'bg-blue-50 border-blue-400 text-blue-600 shadow-sm' : 'bg-pink-50/50 border-pink-200 text-gray-500 hover:bg-pink-100/50'}`}>
                      <input type="radio" name="gender" value="male" className="hidden" 
                        checked={formData.gender === 'male'} 
                        onChange={(e) => handleChange('gender', e.target.value)} 
                      />
                      <span className="font-bold text-sm flex items-center gap-1">Nam <span className="text-lg font-black leading-none text-blue-600">♂</span></span>
                    </label>

                    <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border cursor-pointer transition-all ${formData.gender === 'female' ? 'bg-rose-50 border-rose-400 text-rose-600 shadow-sm' : 'bg-pink-50/50 border-pink-200 text-gray-500 hover:bg-pink-100/50'}`}>
                      <input type="radio" name="gender" value="female" className="hidden" 
                        checked={formData.gender === 'female'} 
                        onChange={(e) => handleChange('gender', e.target.value)} 
                      />
                      <span className="font-bold text-sm flex items-center gap-1">Nữ <span className="text-lg font-black leading-none text-rose-600">♀</span></span>
                    </label>
                  </div>
                </div>

                {/* 3. Chọn Ngày sinh */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Ngày sinh</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleChange('dob', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email & Mật khẩu dùng chung cho cả Đăng nhập/Đăng ký */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-linear-to-r from-pink-400 via-rose-500 to-red-500 text-white font-bold rounded-xl hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              {isLogin ? (
                <> <Heart className="w-5 h-5 fill-white" /> Đăng nhập </>
              ) : (
                <> <Sparkles className="w-5 h-5" /> Tạo tài khoản </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 italic">
              "Tình yêu không phải là nhìn nhau, mà là cùng nhìn về một hướng" 💕
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;