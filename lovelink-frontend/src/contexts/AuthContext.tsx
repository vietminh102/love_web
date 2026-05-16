import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

// Định nghĩa kiểu dữ liệu khớp với Backend trả về
interface User {
  id: string;
  email: string;
  display_name: string; 
  avatar_url?: string | null;
  gender?: string;     
  dob?: string;        
}

// 1. THÊM isLoading VÀO ĐÂY
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // GỘP 2 USEEFFECT LẠI THÀNH 1 LUỒNG CHUẨN XÁC
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true); // Bắt đầu load

      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      // Phản hồi siêu tốc: Nếu có user trong máy, cho vào dùng luôn để khỏi chờ
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error("Lỗi đọc dữ liệu user:", error);
        }
      }

      // Xác thực lại với server ngầm bên dưới
      if (token) {
        try {
          const freshUserData = await authService.getMe(); 
          setUser(freshUserData);
          localStorage.setItem('user', JSON.stringify(freshUserData));
        } catch (error) {
          console.error("Phiên đăng nhập hết hạn");
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      
      setIsLoading(false); // 2. BÁO HIỆU TẢI XONG
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password); 
      
      const token = response.access_token;
      localStorage.setItem('token', token);

      const freshUserData = await authService.getMe();

      setUser(freshUserData);
      localStorage.setItem('user', JSON.stringify(freshUserData));

      return { success: true };
    } catch (error: any) {
      console.error("Lỗi đăng nhập:", error);
      return { 
        success: false, 
        message: error.response?.data?.detail || "Email hoặc mật khẩu không đúng" 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    // 3. TRUYỀN isLoading RA NGOÀI ĐỂ APP.TSX DÙNG
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};