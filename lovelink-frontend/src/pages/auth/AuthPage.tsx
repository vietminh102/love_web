import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Heart, Mail, Lock, User, Sparkles } from 'lucide-react'; 
import React, { useState } from 'react';
import { authService } from '../../services/authService';

// 1. Định nghĩa kiểu dữ liệu cho Form (Khớp với backend UserRegister)
interface AuthFormData {
  email: string;
  password: string;
  name?: string; 
}

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  
  // 2. Ép kiểu cho useState (Đã bỏ partnerName và anniversaryDate)
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    name: ''
  });

  // 3. Định nghĩa kiểu cho sự kiện Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        // LOGIC ĐĂNG NHẬP
        const data = await authService.login({
          email: formData.email,
          password: formData.password
        });
        
        // CẬP NHẬT: Backend trả về toàn bộ thông tin user trong data.user
        login(data.access_token, data.user); 
        navigate('/home');

      } else {
        // LOGIC ĐĂNG KÝ
        const data = await authService.register(formData);
        
        // Kiểm tra xem API đăng ký có trả về token luôn không
        if (data && data.access_token) {
          login(data.access_token, data.user);
          alert('Tạo tài khoản thành công! 💕');
          navigate('/home');
        } else {
          // Nếu không có token, chuyển về tab đăng nhập
          alert('Đăng ký thành công! Vui lòng đăng nhập lại.');
          setIsLogin(true); 
          setFormData(p => ({...p, password: ''}));
        }
      }
    } catch (error: any) {
      console.error("Chi tiết lỗi:", error); 
      
      const errDetail = error.response?.data?.detail || error.response?.data?.message;
      let errorMessage = 'Thông tin không chính xác';
      
      if (Array.isArray(errDetail)) {
        errorMessage = errDetail[0].msg || errDetail[0].message || errorMessage;
      } else if (typeof errDetail === 'string') {
        errorMessage = errDetail;
      }

      alert(errorMessage);
    }
  };

  const handleChange = (field: keyof AuthFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-pink-100 via-purple-100 to-red-100 relative overflow-hidden">
      {/* Background giữ nguyên 100% */}
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
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg transition-all ${isLogin ? 'bg-linear-to-r from-pink-400 to-rose-500 text-white shadow-md' : 'text-gray-600'}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg transition-all ${!isLogin ? 'bg-linear-to-r from-pink-400 to-rose-500 text-white shadow-md' : 'text-gray-600'}`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
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
                {/* Đã xóa 2 khối UI "Tên người yêu" và "Ngày kỷ niệm" ở đây */}
              </>
            )}

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
          
          {/* Quote */}
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