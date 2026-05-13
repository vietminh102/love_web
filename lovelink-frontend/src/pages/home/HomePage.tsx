import { Heart, Sparkles, Calendar, LogOut, Menu, X, Link as LinkIcon, User, Key, Image as ImageIcon, Copy, Check, Camera, Home, BookHeart, Images, Music, VolumeX } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function HomePage() {
  const { user, logout } = useAuth();

  // --- STATES CHO GIAO DIỆN CHÍNH ---
  const [daysInLove, setDaysInLove] = useState(0);
  const [anniversaryDate, setAnniversaryDate] = useState('2024-01-14');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [partnerNames, setPartnerNames] = useState({ 
    name1: user?.display_name || 'Bạn', 
    name2: 'Người ấy' 
  });

  // --- STATES CHO MENU & MODAL ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // --- STATES & REFS CHO ÂM NHẠC (BẢN FIX TRIỆT ĐỂ) ---
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Ref để kiểm tra xem đã cố gắng tự động phát nhạc lần nào chưa
  const hasAttemptedAutoPlay = useRef(false);

  // States cho Form Edit Info
  const [editForm, setEditForm] = useState({
    avatarUrl: user?.avatar_url || '',
    avatarFile: null as File | null,
    displayName: user?.display_name || '',
    password: ''
  });

  // =========================================================================
  // --- FIX LỖI "AbortError: The play() request was interrupted..." ---
  // Tách biệt hoàn toàn logic quản lý user và logic nhạc nền
  // =========================================================================

  // UseEffect 1: Chỉ lo cập nhật thông tin user
  useEffect(() => {
    if (user) {
      setPartnerNames(prev => ({ ...prev, name1: user.display_name || 'Bạn' }));
      setEditForm(prev => ({ ...prev, displayName: user.display_name || '', avatarUrl: user.avatar_url || '' }));
    }
  }, [user]);

  // UseEffect 2: Chỉ lo tính toán ngày yêu
  useEffect(() => {
    const calculateDays = () => {
      if (!anniversaryDate) return setDaysInLove(0);
      const start = new Date(anniversaryDate);
      const today = new Date();
      start.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysInLove(diffDays > 0 ? diffDays : 0);
    };
    calculateDays();
    const interval = setInterval(calculateDays, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, [anniversaryDate]);



  // Hàm tự động phát nhạc an toàn
  const safePlayMusic = async () => {
    if (audioRef.current) {
      try {
        // Tải lại nhạc để chắc chắn nó đã sẵn sàng
        audioRef.current.load();
        await audioRef.current.play();
        setIsPlaying(true);
        console.log("Nhạc đã phát thành công!");
      } catch (error) {
        // Trình duyệt vẫn chặn
        console.log("NotAllowedError: Trình duyệt chặn, cần click để nghe nhạc.", error);
        setIsPlaying(false);
      }
    }
  };

  // useEffect 3: Tự động phát nhạc khi component mount
  useEffect(() => {
    // Chỉ thử một lần duy nhất khi mới load trang
    if (!hasAttemptedAutoPlay.current) {
      hasAttemptedAutoPlay.current = true;
      
      // Tạo một khoảng trễ cực nhỏ để component render hoàn tất
      setTimeout(() => {
        safePlayMusic();
      }, 200); 
    }
  }, []);

  // useEffect 4: Nếu tự động phát thất bại, thử phát lại khi người dùng tương tác
  useEffect(() => {
    const handleUserInteraction = () => {
      // Chỉ tự động phát nếu TRƯỚC ĐÓ nhạc chưa được bật
      if (!isPlaying && audioRef.current) {
        safePlayMusic();
        
        // Sau khi đã tương tác lần đầu, gỡ bỏ lắng nghe sự kiện
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
      }
    };

    if (!isPlaying) {
      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('keydown', handleUserInteraction);
    }

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [isPlaying]); // Chạy lại hiệu ứng này nếu isPlaying thay đổi về false

  // Hàm Bật/Tắt nhạc nền bằng tay (giữ nguyên)
const toggleMusic = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        // Nếu đang phát -> Dừng lại
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Nếu đang dừng -> Phát nhạc
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.log("Không thể phát nhạc:", error);
        }
      }
    }
  };

  // =========================================================================
  // --- KẾT THÚC PHẦN FIX LỖI NHẠC ---
  // =========================================================================

  // Hàm xử lý copy mã ghép đôi
  const handleCopyCode = () => {
    navigator.clipboard.writeText("LVE-ABCD89"); 
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Hàm xử lý khi người dùng chọn file ảnh từ máy
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setEditForm({ ...editForm, avatarUrl: previewUrl, avatarFile: file });
    }
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-pink-200 via-rose-200 to-red-200 relative overflow-hidden font-sans">
      
      {/* THẺ AUDIO ẨN ĐỂ CHẠY NHẠC (Sử dụng preLoad để tăng cơ hội tự động phát) */}
      <audio ref={audioRef} loop preload="auto">
        <source src="\nhac-nen.mp3" type="audio/mpeg" />
        Trình duyệt của bạn không hỗ trợ thẻ audio.
      </audio>

      {/* ================= THANH ĐIỀU HƯỚNG TRÊN CÙNG (NAVBAR) ================= */}
      <nav className="absolute top-0 left-0 w-full z-50 px-4 py-4 flex items-center justify-between">
        
        {/* 1. Logo góc trái */}
        <div className="hidden md:flex items-center gap-2 font-bold text-pink-600 text-2xl font-serif drop-shadow-sm ml-2">
          <Heart className="w-7 h-7 fill-pink-500" /> Lovelink
        </div>

        {/* 2. Thanh Tabs ở giữa */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white/40 backdrop-blur-md p-1.5 rounded-full shadow-sm border border-white/50 mx-auto md:mx-0">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/80 text-pink-600 rounded-full font-bold text-sm shadow-sm transition-all">
            <Home className="w-4 h-4" /> <span className="hidden sm:inline">Trang chủ</span>
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-white/60 hover:text-pink-600 rounded-full font-medium text-sm transition-all">
            <BookHeart className="w-4 h-4" /> <span className="hidden sm:inline">Nhật ký</span>
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-white/60 hover:text-pink-600 rounded-full font-medium text-sm transition-all">
            <Images className="w-4 h-4" /> <span className="hidden sm:inline">Thư viện</span>
          </button>
        </div>

        {/* 3. Công cụ góc phải */}
        <div className="flex items-center gap-2 sm:gap-3 mr-2">
          
          {/* NÚT BẬT/TẮT NHẠC NỀN */}
         <button 
            onClick={(e) => {
              e.stopPropagation(); // CHẶN: Không cho click này lan ra ngoài màn hình
              toggleMusic();
            }}
            className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full backdrop-blur-md transition-all shadow-sm ${isPlaying ? 'bg-pink-500 text-white animate-pulse' : 'bg-white/50 text-pink-600 hover:bg-white/70'}`}
            title="Bật/Tắt nhạc nền"
          >
            {isPlaying ? <Music className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 text-pink-600 hover:text-red-600 bg-white/50 hover:bg-white/70 px-3 sm:px-4 py-2 rounded-full backdrop-blur-md transition-all text-sm font-bold shadow-sm"
            >
              <Menu className="w-4 h-4" /> <span className="hidden sm:inline">Menu</span>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="p-4 bg-linear-to-r from-pink-50 to-rose-50 border-b border-pink-100 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-pink-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm shrink-0">
                    {editForm.avatarUrl ? (
                      <img src={editForm.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-pink-500" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-sm">{partnerNames.name1}</span>
                    <div className="flex items-center gap-1 text-xs text-pink-500 font-medium mt-0.5">
                      <Heart className="w-3 h-3 fill-pink-500" /> 
                      <span>Đang yêu {partnerNames.name2}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  <button 
                    onClick={() => { setIsPairModalOpen(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-xl transition-colors text-left"
                  >
                    <div className="p-1.5 bg-pink-100 rounded-lg text-pink-500"><LinkIcon className="w-4 h-4" /></div>
                    Ghép đôi tài khoản
                  </button>
                  <button 
                    onClick={() => { setIsEditModalOpen(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-xl transition-colors text-left"
                  >
                    <div className="p-1.5 bg-pink-100 rounded-lg text-pink-500"><User className="w-4 h-4" /></div>
                    Thay đổi thông tin
                  </button>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={logout}
            className="flex items-center gap-2 text-rose-600 hover:text-white bg-white/50 hover:bg-rose-500 p-2 sm:px-4 sm:py-2 rounded-full backdrop-blur-md transition-all text-sm font-bold shadow-sm"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Thoát</span>
          </button>
        </div>
      </nav>
      {/* ================= KẾT THÚC NAVBAR ================= */}

      {/* ---------------- MODAL GHÉP ĐÔI ---------------- */}
      {isPairModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-pink-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-pink-500" /> Ghép đôi
              </h3>
              <button onClick={() => setIsPairModalOpen(false)} className="p-1.5 hover:bg-pink-100 rounded-full text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-pink-50 p-4 rounded-2xl border border-pink-100">
                <label className="flex text-sm font-bold text-pink-600 mb-2">Mã ghép đôi của bạn</label>
                <p className="text-xs text-gray-500 mb-3">Hãy gửi mã này cho người ấy để kết nối tài khoản nhé.</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white border border-pink-200 rounded-xl px-4 py-2.5 font-mono font-bold text-gray-700 text-center tracking-widest">
                    LVE-ABCD89
                  </div>
                  <button onClick={handleCopyCode} className="px-4 bg-pink-500 hover:bg-pink-600 text-white rounded-xl transition-colors flex items-center justify-center">
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="relative flex items-center py-2">
                <div className="grow border-t border-gray-200"></div>
                <span className="shrink-0 px-4 text-gray-400 text-sm font-medium">HOẶC</span>
                <div className="grow border-t border-gray-200"></div>
              </div>

              <div>
                <label className="flex text-sm font-bold text-gray-700 mb-2">Nhập mã của người ấy</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: LVE-XYZ123"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all font-mono uppercase"
                />
                <button className="w-full mt-3 py-3 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-[0.98]">
                  Xác nhận ghép đôi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL THAY ĐỔI THÔNG TIN ---------------- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-pink-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-pink-500" /> Thay đổi thông tin
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 hover:bg-pink-100 rounded-full text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center justify-center mb-2">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden border-4 border-pink-50 shadow-md">
                    {editForm.avatarUrl ? (
                      <img src={editForm.avatarUrl} alt="avatar preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-pink-400" />
                    )}
                  </div>
                  
                  <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-6 h-6 text-white mb-1" />
                    <span className="text-white text-[10px] font-bold">Đổi ảnh</span>
                  </label>
                  
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">Bấm vào ảnh để chọn từ máy tính</p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                  <User className="w-4 h-4 text-pink-400"/> Tên hiển thị
                </label>
                <input type="text" value={editForm.displayName} onChange={(e) => setEditForm({...editForm, displayName: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700 font-medium" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                  <Key className="w-4 h-4 text-pink-400"/> Mật khẩu mới
                </label>
                <input type="password" placeholder="Bỏ trống nếu không muốn đổi" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700" />
              </div>
              <button 
                onClick={() => {
                  // TODO: Sau này gọi API Upload file `editForm.avatarFile` ở đây
                  setPartnerNames(prev => ({...prev, name1: editForm.displayName || prev.name1}));
                  setIsEditModalOpen(false);
                }}
                className="w-full mt-2 py-3 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-[0.98]"
              >
                Lưu thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- GIAO DIỆN CHÍNH HOME ---------------- */}
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute animate-float" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s`
          }}>
            {i % 3 === 0 ? <Heart className="w-4 h-4 text-pink-400 opacity-40 fill-pink-400" /> : 
             i % 3 === 1 ? <Sparkles className="w-3 h-3 text-rose-400 opacity-30" /> : 
             <div className="w-2 h-2 bg-red-300 rounded-full opacity-50" />}
          </div>
        ))}
      </div>

      {/* Main Content (Đã đẩy xuống bằng pt-28 để không bị Navbar đè lên) */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 pt-28 pb-12 w-full h-full overflow-y-auto">
        {/* Names */}
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-r from-pink-600 to-rose-600 drop-shadow-sm">
            {partnerNames.name1} 💕 {partnerNames.name2}
          </h2>
        </div>

        {/* Big Heart Container */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-100 h-100 border-4 border-pink-300 rounded-full opacity-20 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-87.5 h-87.5 border-4 border-rose-300 rounded-full opacity-30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          </div>

          {/* Main Heart */}
          <div className="relative w-80 h-80 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="absolute w-full h-full text-pink-500 fill-pink-500 opacity-90 animate-heartbeat drop-shadow-2xl">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <svg viewBox="0 0 24 24" className="absolute w-[90%] h-[90%] animate-pulse" style={{ animationDuration: '2s' }}>
              <defs>
                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f472b6" /><stop offset="50%" stopColor="#fb7185" /><stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
              </defs>
              <path fill="url(#heartGradient)" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>

            {/* Days Counter Inside Heart */}
            <div className="relative z-10 text-center flex flex-col items-center -mt-2.5">
              <div className="text-7xl font-black text-white drop-shadow-lg leading-none" style={{ animationDuration: '3s' }}>
                {daysInLove}
              </div>
              <div className="text-xl font-bold text-white/95 mt-1 drop-shadow-md">ngày</div>
              <div className="text-sm font-medium text-white/90 drop-shadow-md">yêu nhau</div>
            </div>

            {/* Floating Hearts Around */}
            <Heart className="absolute -top-8 -left-8 w-12 h-12 text-pink-400 fill-pink-400 opacity-60 animate-bounce pointer-events-none" style={{ animationDelay: '0s', animationDuration: '2s' }} />
            <Heart className="absolute -top-8 -right-8 w-10 h-10 text-rose-400 fill-rose-400 opacity-70 animate-bounce pointer-events-none" style={{ animationDelay: '0.3s', animationDuration: '2.2s' }} />
            <Heart className="absolute -bottom-8 -left-8 w-10 h-10 text-red-400 fill-red-400 opacity-60 animate-bounce pointer-events-none" style={{ animationDelay: '0.6s', animationDuration: '2.5s' }} />
            <Heart className="absolute -bottom-8 -right-8 w-12 h-12 text-pink-400 fill-pink-400 opacity-70 animate-bounce pointer-events-none" style={{ animationDelay: '0.9s', animationDuration: '2.8s' }} />
          </div>
        </div>

        {/* Date Info */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-8 w-full max-w-sm border border-white/50">
          {isEditingDate ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Ngày kỷ niệm</label>
                <input
                  type="date"
                  value={anniversaryDate}
                  onChange={(e) => setAnniversaryDate(e.target.value)}
                  className="w-full px-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700 font-medium"
                />
              </div>
              <button onClick={() => setIsEditingDate(false)} className="w-full mt-2 py-3 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-lg shadow-pink-200 transform transition-all active:scale-[0.98]">
                Lưu ngày
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-gray-600 font-medium mb-3">
                <Calendar className="w-5 h-5 text-pink-500" />
                <span>Ngày bắt đầu yêu</span>
              </div>
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-pink-600 to-rose-600 mb-5">
                {anniversaryDate ? new Date(anniversaryDate).toLocaleDateString('vi-VN', {
                  day: '2-digit', month: '2-digit', year: 'numeric'
                }) : 'Chưa thiết lập'}
              </div>
              <button onClick={() => setIsEditingDate(true)} className="text-sm font-bold text-pink-500 hover:text-pink-600 transition-colors hover:underline underline-offset-4">
                Chỉnh sửa ngày
              </button>
            </div>
          )}
        </div>

        {/* Love Quote */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 max-w-md text-center shadow-sm border border-white/40">
          <p className="text-gray-800 italic font-medium leading-relaxed">
            "Mỗi ngày trôi qua là một khoảnh khắc đáng trân trọng bên người mình yêu thương"
          </p>
          <div className="flex justify-center gap-1.5 mt-3">
            <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" /><Heart className="w-4 h-4 text-pink-500 fill-pink-500" /><Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
          </div>
        </div>
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 25% { transform: scale(1.05); } 50% { transform: scale(1); } 75% { transform: scale(1.03); } }
        @keyframes float { 0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; } 10%, 90% { opacity: 0.6; } 50% { transform: translateY(-100px) translateX(20px) rotate(180deg); } }
        .animate-heartbeat { animation: heartbeat 2s ease-in-out infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}