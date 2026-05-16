import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/auth/AuthPage';
import HomePage from './pages/home/HomePage'; 
import DiaryPage from './pages/diary/DiaryPage';
import GalleryPage from './pages/gallery/GalleryPage';
import { FloatingHearts } from './pages/FloatingHearts';
import { Navbar } from './components/Navbar';

// 1. Chốt chặn 1: Dành cho trang nội bộ (Phải đăng nhập)
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth(); // Nhớ lấy isLoading ra nhé
  
  // Màn hình chờ siêu tốc chống lỗi F5
  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-pink-50">
        <div className="w-10 h-10 border-4 border-pink-300 border-t-rose-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

// 2. Chốt chặn 2: Dành cho trang Auth (Đã đăng nhập thì đá về Home)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-pink-50">
        <div className="w-10 h-10 border-4 border-pink-300 border-t-rose-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return !isAuthenticated ? <>{children}</> : <Navigate to="/home" replace />;
};

// TẬP TRUNG GIAO DIỆN CHUNG VÀO ĐÂY
const AppLayout = () => {
  return (
    <div className="w-full h-screen overflow-hidden flex flex-col relative bg-pink-50">
      {/* Hiệu ứng và thanh điều hướng CHỈ HIỆN ở các trang bên trong */}
      <FloatingHearts />
      <Navbar /> 
      
      {/* Khung chứa nội dung các trang */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <Outlet /> 
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* VÙNG 1: TRANG AUTH (Không Navbar, không tim bay) */}
          <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />

          {/* VÙNG 2: CÁC TRANG NỘI BỘ (Được bọc bởi PrivateRoute và AppLayout) */}
          <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
          </Route>

          {/* Xử lý đi lạc: Gõ link bậy tự động đá về Home */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;