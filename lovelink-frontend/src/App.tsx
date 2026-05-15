import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/auth/AuthPage';
import HomePage from './pages/home/HomePage'; 
import DiaryPage from './pages/diary/DiaryPage';
import GalleryPage from './pages/gallery/GalleryPage';
import { FloatingHearts } from './pages/FloatingHearts';
import { Navbar } from './components/Navbar';
// Chốt chặn 1: Dành cho trang Home (Phải đăng nhập mới được vào)
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

// Chốt chặn 2: Dành cho trang Auth (Đã đăng nhập thì đá về Home)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/home" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="relative min-h-screen">
          <FloatingHearts />
          <Navbar />
        <div className="relative z-10">
        <Routes>
          {/* Trang Đăng nhập / Đăng ký */}
          <Route 
            path="/auth" 
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            } 
          />

          {/* Trang Chủ */}
          <Route 
            path="/home" 
            element={
              <PrivateRoute>
                <HomePage />
              </PrivateRoute>
            } 
          />
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          {/* Nếu gõ đường dẫn linh tinh, tự động chuyển về /home */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </div>
          
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;