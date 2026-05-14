import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

// Định nghĩa kiểu dữ liệu khớp với Backend trả về
interface User {
  id: string;
  email: string;
  display_name: string; // <-- Quan trọng: Phải là display_name
  avatar_url?: string | null;
  gender?: string;     // Giới tính: 'male', 'female', 'other'
  dob?: string;        // Ngày sinh: 'YYYY-MM-DD'
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
useEffect(() => {
    const fetchFreshData = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Gọi Backend xin thông tin mới nhất
          const freshUserData = await authService.getMe(); 
          
          // Ghi đè vào State và LocalStorage
          setUser(freshUserData);
          localStorage.setItem('user', JSON.stringify(freshUserData));
        } catch (error) {
          // Nếu Token hết hạn hoặc lỗi, cho văng ra ngoài
          console.error("Phiên đăng nhập hết hạn");
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
    };

    fetchFreshData();
  }, []);
  // Kiểm tra localStorage khi người dùng F5 tải lại trang
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Lỗi đọc dữ liệu user:", error);
      }
    }
  }, []);

const login = async (email: string, password: string) => {
    try {
      // 1. Truyền thẳng 2 biến xuống cho Service tự lo liệu
      const response = await authService.login(email, password); 
      
      const token = response.access_token;
      localStorage.setItem('token', token);

      // 2. Lấy thông tin user
      const freshUserData = await authService.getMe();

      // 3. Cập nhật state
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
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};