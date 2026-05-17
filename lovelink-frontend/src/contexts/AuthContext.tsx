import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface User {
  id: string;
  email: string;
  display_name: string; 
  avatar_url?: string | null;
  gender?: string;     
  dob?: string;        
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: (token: string, userData: User) => void; // 🌟 THÊM HÀM NÀY
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (savedUser && savedUser !== 'undefined') {
        try {
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error("Lỗi đọc dữ liệu user:", error);
          localStorage.removeItem('user');
        }
      }

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
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password); 
      localStorage.setItem('token', response.access_token);
      const freshUserData = await authService.getMe();

      setUser(freshUserData);
      localStorage.setItem('user', JSON.stringify(freshUserData));
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.response?.data?.detail || "Email hoặc mật khẩu không đúng" 
      };
    }
  };

  // 🌟 THÊM HÀM XỬ LÝ GOOGLE ĐỂ ĐỒNG BỘ STATE LẬP TỨC
  const loginWithGoogle = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData); // Kích hoạt trạng thái đăng nhập ngay lập tức trong React
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};