import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Home, BookOpen, Image as ImageIcon, Music, VolumeX, Menu, LogOut, X, User, Calendar, Link as LinkIcon, Check, Copy, Camera, Key, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { coupleService } from '../services/coupleService';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  
  // --- STATES ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerNames, setPartnerNames] = useState({ name1: user?.display_name || 'Bạn', name2: 'Đang tải...' });
  const [pairingCode, setPairingCode] = useState<string>('Đang tải...');
  const [partnerCode, setPartnerCode] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [isPairing, setIsPairing] = useState(false);
  const [pairingMessage, setPairingMessage] = useState({ type: '', text: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  
  const [editForm, setEditForm] = useState({
    avatarUrl: user?.avatar_url || '',
    avatarFile: null as File | null,
    displayName: user?.display_name || '',
    gender: user?.gender || 'other',
    dob: user?.dob || '',
    oldPassword: '',
    password: ''
  });

  // --- LOGIC NHẠC NỀN ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasAttemptedAutoPlay = useRef(false);

  const safePlayMusic = async () => {
    if (audioRef.current) {
      try {
        audioRef.current.load();
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        setIsPlaying(false);
      }
    }
  };

  useEffect(() => {
    if (!hasAttemptedAutoPlay.current && location.pathname !== '/auth') {
      hasAttemptedAutoPlay.current = true;
      setTimeout(() => safePlayMusic(), 200); 
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleUserInteraction = () => {
      if (!isPlaying && audioRef.current) {
        safePlayMusic();
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
  }, [isPlaying]);

  const toggleMusic = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {}
      }
    }
  };

  // --- FETCH DỮ LIỆU ---
  useEffect(() => {
    if (user) {
      setPartnerNames(prev => ({ ...prev, name1: user.display_name || 'Bạn' }));
      setEditForm(prev => ({ ...prev, displayName: user.display_name || '', avatarUrl: user.avatar_url || '', gender: user.gender || 'other', dob: user.dob || '' }));
    }
  }, [user]);

  useEffect(() => {
    if (!user || location.pathname === '/auth' || location.pathname === '/login') {
    return;
  }
    const fetchMenuData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const [partnerData, codeData] = await Promise.all([coupleService.getPartnerInfo(), coupleService.getMyCode()]);
        setHasPartner(partnerData.has_partner);
        setPartnerNames(prev => ({ ...prev, name2: partnerData.has_partner ? partnerData.display_name : '(Chưa ghép đôi)' }));
        setPairingCode(codeData.pairing_code);
      } catch (error: any) {
      // 3. XỬ LÝ KHI TOKEN HẾT HẠN (401)
      if (error.response?.status === 401) {
        console.warn("Phiên đăng nhập hết hạn, đang đăng xuất...");
        logout();
        navigate('/login');
      }}
    };
    fetchMenuData();
  }, [user, location.pathname]);

  // --- CÁC HÀM XỬ LÝ ---
  const handleCopyCode = () => {
    if (pairingCode && pairingCode !== 'Đang tải...') {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePairing = async () => {
    setPairingMessage({ type: '', text: '' });
    if (!partnerCode.trim()) return setPairingMessage({ type: 'error', text: 'Vui lòng nhập mã ghép đôi của người ấy!' });
    setIsPairing(true);
    try {
      await coupleService.pairWithPartner(partnerCode);
      setPairingMessage({ type: 'success', text: 'Ghép đôi thành công! Chúc 2 bạn hạnh phúc 💕' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      setPairingMessage({ type: 'error', text: error.response?.data?.detail || 'Có lỗi xảy ra khi ghép đôi.' });
    } finally {
      setIsPairing(false);
    }
  };

  const handleUnpair = async () => {
    if (!window.confirm("💔 Bạn có chắc chắn muốn hủy ghép đôi với người ấy không? Mọi dữ liệu chung có thể sẽ bị ảnh hưởng.")) return;
    try {
      await coupleService.unpair();
      alert("Đã hủy ghép đôi thành công!");
      window.location.reload(); 
    } catch (error: any) {
      alert(error.response?.data?.detail || "Có lỗi xảy ra khi hủy ghép đôi.");
    }
  };

  const handleDeleteAccount = async () => {
    if (hasPartner) return alert("❌ Bạn phải Hủy ghép đôi trước khi có thể xóa tài khoản!");
    if (!window.confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TÀI KHOẢN KHÔNG?\nHành động này không thể hoàn tác và toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.")) return;
    try {
      await authService.deleteAccount();
      alert("Tài khoản của bạn đã được xóa thành công. Tạm biệt!");
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } catch (error: any) {
      alert(error.response?.data?.detail || "Có lỗi xảy ra khi xóa tài khoản.");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEditForm({ ...editForm, avatarUrl: URL.createObjectURL(file), avatarFile: file });
  };

  const handleUpdateProfile = async () => {
    setUpdateError('');
    if (!editForm.displayName.trim()) return setUpdateError('Tên hiển thị không được để trống!');
    if (editForm.password && !editForm.oldPassword) return setUpdateError('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới!');
    
    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append('display_name', editForm.displayName);
      formData.append('gender', editForm.gender);
      formData.append('dob', editForm.dob);
      if (editForm.password) {
        formData.append('old_password', editForm.oldPassword); 
        formData.append('password', editForm.password);
      }
      if (editForm.avatarFile) formData.append('avatar', editForm.avatarFile);

      const response = await authService.updateProfile(formData);
      await new Promise(resolve => setTimeout(resolve, 1500));

      setPartnerNames(prev => ({...prev, name1: editForm.displayName}));
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ 
        ...currentUser, display_name: response.user.display_name, avatar_url: response.user.avatar_url, gender: response.user.gender, dob: response.user.dob
      }));

      setIsEditModalOpen(false);
      setEditForm(prev => ({ ...prev, password: '', oldPassword: '' }));
      alert('Đã lưu những thay đổi ngọt ngào! 💕');
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        const fieldError = errorDetail[0].loc[errorDetail[0].loc.length - 1]; 
        setUpdateError(`Lỗi ở trường dữ liệu: ${fieldError} - ${errorDetail[0].msg}`);
      } else {
        setUpdateError(errorDetail || 'Lỗi kết nối server.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (location.pathname === '/auth') return null;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" hidden>
        <source src="/nhac-nen.mp3" type="audio/mpeg" />
      </audio>

      <div className="fixed top-4 left-0 w-full z-50 px-4 pointer-events-none">
        <div className="max-w-5xl mx-auto bg-pink-100/90 backdrop-blur-md rounded-full px-4 py-2 flex items-center justify-between shadow-sm border border-white/50 pointer-events-auto">
          
          <div className="flex items-center gap-2 pl-2">
            <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
            <span className="hidden sm:inline text-xl font-black text-pink-600 tracking-tight font-serif drop-shadow-sm">LoveLe</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1 mr-2">
              <NavLink to="/" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
                <Home className="w-4 h-4" /> <span className="hidden md:inline">Trang chủ</span>
              </NavLink>
              <NavLink to="/diary" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
                <BookOpen className="w-4 h-4" /> <span className="hidden md:inline">Nhật ký</span>
              </NavLink>
              <NavLink to="/gallery" className={({ isActive }) => `flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full transition-all font-semibold text-sm ${isActive ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:bg-white/50 hover:text-pink-500'}`}>
                <ImageIcon className="w-4 h-4" /> <span className="hidden md:inline">Thư viện</span>
              </NavLink>
            </div>

            <div className="w-px h-6 bg-pink-200/60 mx-1"></div>

            {/* CỤM NÚT CÔNG CỤ (Giống hệt giao diện cũ) */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
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

              {/* MENU DROPDOWN (Giống hệt giao diện cũ) */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-pink-100/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-50">
                  <div className="p-4 bg-linear-to-br from-pink-50 to-rose-50 border-b border-pink-100/60 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white shadow-sm shrink-0">
                      {editForm.avatarUrl ? (
                        <img src={editForm.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-pink-400" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 w-full">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800 text-[15px] leading-tight truncate">
                          {partnerNames.name1}
                        </span>
                        {editForm.gender === 'male' && (
                          <span className="text-blue-500 text-lg font-bold leading-none" title="Nam">♂</span>
                        )}
                        {editForm.gender === 'female' && (
                          <span className="text-pink-500 text-lg font-bold leading-none" title="Nữ">♀</span>
                        )}
                      </div>
                      {editForm.dob && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mt-1">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {editForm.dob.split('-').reverse().join('/')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-pink-500 font-medium mt-1">
                        <Heart className="w-3.5 h-3.5 fill-pink-500 shrink-0" /> 
                        <span className="truncate">
                          {hasPartner ? `Đang yêu ${partnerNames.name2}` : 'Đang độc thân'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 space-y-0.5">
                    <button 
                      onClick={() => { setIsPairModalOpen(true); setIsMenuOpen(false); }}
                      className="group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-xl transition-all duration-200 text-left"
                    >
                      <div className="p-1.5 bg-pink-50 group-hover:bg-white rounded-lg text-pink-500 shadow-sm shadow-pink-100/50 transition-colors">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      {hasPartner ? 'Xem mã ghép đôi' : 'Ghép đôi tài khoản'}
                    </button>

                    <button 
                      onClick={() => { setIsEditModalOpen(true); setIsMenuOpen(false); }}
                      className="group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-pink-50 hover:text-pink-600 rounded-xl transition-all duration-200 text-left"
                    >
                      <div className="p-1.5 bg-pink-50 group-hover:bg-white rounded-lg text-pink-500 shadow-sm shadow-pink-100/50 transition-colors">
                        <User className="w-4 h-4" />
                      </div>
                      Thay đổi thông tin
                    </button>
                  </div>

                  {hasPartner && (
                    <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                      <button 
                        onClick={handleUnpair}
                        className="group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-200 text-left"
                      >
                        <div className="p-1.5 bg-red-50 group-hover:bg-white rounded-lg text-red-500 shadow-sm shadow-red-100/50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </div>
                        Hủy ghép đôi
                      </button>
                    </div>
                  )}

                  <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                    <button 
                      onClick={handleDeleteAccount}
                      className="group w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-200 hover:text-gray-800 rounded-xl transition-all duration-200 text-left"
                    >
                      <div className="p-1.5 bg-gray-100 group-hover:bg-white rounded-lg text-gray-500 shadow-sm transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </div>
                      Xóa tài khoản
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                navigate('/login'); 
                setTimeout(() => {
                logout();         
                  }, 10);
  }}
  className="flex items-center gap-2 text-rose-600 hover:text-white bg-white/50 hover:bg-rose-500 p-2 sm:px-4 sm:py-2 rounded-full backdrop-blur-md transition-all text-sm font-bold shadow-sm"
>
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Thoát</span>
            </button>

          </div>
        </div>
      </div>

      {/* --- MODAL GHÉP ĐÔI (Giữ nguyên gốc 100%) --- */}
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
                    {pairingCode}
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
                  placeholder="Ví dụ: VYL-LEXG"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all font-mono uppercase"
                />
                <button 
                  onClick={handlePairing}
                  disabled={isPairing}
                  className="w-full mt-3 py-3 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-[0.98]">
                  {isPairing ? 'Đang kết nối...' : 'Kết nối'}
                </button>
              </div>
              
              {pairingMessage.text && (
                <div className={`mt-3 text-sm font-medium p-3 rounded-lg ${
                  pairingMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                }`}>
                  {pairingMessage.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL SỬA THÔNG TIN (Giữ nguyên gốc 100%) --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-pink-50/50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-pink-500" /> Thay đổi thông tin
              </h3>
              <button onClick={() => !isUpdating && setIsEditModalOpen(false)} disabled={isUpdating}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {updateError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center font-medium">
              {updateError}
              </div>
              )}
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
                  
                  <input id="avatar-upload" disabled={isUpdating} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">Bấm vào ảnh để chọn từ máy tính</p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                  <User className="w-4 h-4 text-pink-400"/> Tên hiển thị
                </label>
                <input type="text" disabled={isUpdating} value={editForm.displayName} onChange={(e) => setEditForm({...editForm, displayName: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700 font-medium" />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
                  <Heart className="w-4 h-4 text-pink-400"/> Giới tính
                </label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer transition-all ${editForm.gender === 'male' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                    <input type="radio" name="gender" value="male" className="hidden" 
                      checked={editForm.gender === 'male'} 
                      onChange={(e) => setEditForm({...editForm, gender: e.target.value})} 
                    />
                    <span className="font-bold text-sm flex items-center gap-1">
                      Nam <span className="text-xl font-black leading-none text-blue-600">♂</span>
                    </span>
                  </label>

                  <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer transition-all ${editForm.gender === 'female' ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                    <input type="radio" name="gender" value="female" className="hidden" 
                      checked={editForm.gender === 'female'} 
                      onChange={(e) => setEditForm({...editForm, gender: e.target.value})} 
                    />
                    <span className="font-bold text-sm flex items-center gap-1">
                      Nữ <span className="text-xl font-black leading-none text-rose-600">♀</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 text-pink-400"/> Ngày sinh
                </label>
                <input 
                  type="date" 
                  disabled={isUpdating} 
                  value={editForm.dob} 
                  onChange={(e) => setEditForm({...editForm, dob: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700 font-medium" 
                />
                <p className="text-[10px] text-gray-400 mt-1 ml-1">* Ngày sinh dùng để tính tuổi và thông báo kỷ niệm</p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-1">
                  <Key className="w-4 h-4 text-pink-400"/> Đổi mật khẩu
                </label>
                <input type="password" disabled={isUpdating} placeholder="Nhập mật khẩu cũ của bạn" value={editForm.oldPassword} onChange={(e) => setEditForm({...editForm, oldPassword: e.target.value})} className="w-full mb-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700" />
                <input type="password" disabled={isUpdating} placeholder="Mật khẩu mới" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700" />
              </div>

              <button 
                onClick={handleUpdateProfile}
                disabled={isUpdating}
                className="w-full mt-2 py-3 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-[0.98]"
              >
                {isUpdating ? (
                  <><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Đang lưu...</>
                ) : (
                  'Lưu thông tin'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}