import { Heart, Sparkles, Calendar, LogOut, Menu, X, Link as LinkIcon, User, Key, Image as ImageIcon, Copy, Check, Camera, Home, BookHeart, Images, Music, VolumeX, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { coupleService } from '../../services/coupleService';


export default function HomePage() {
  const { user, logout } = useAuth();

  const [partnerDob, setPartnerDob] = useState<string>('');
  const [partnerGender, setPartnerGender] = useState<string>('other');
  // Cap doi
  const [pairingCode, setPairingCode] = useState<string>('Đang tải...');
  const [partnerCode, setPartnerCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingMessage, setPairingMessage] = useState({ type: '', text: '' }); // type: 'success' | 'error'
  // Huy ghep doi
  const [hasPartner, setHasPartner] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false); // Trạng thái đang gửi API
  const [updateError, setUpdateError] = useState('');
  // --- STATES CHO GIAO DIỆN CHÍNH ---
  const [startDateDB, setStartDateDB] = useState<string | null>(null);
  const [loveTime, setLoveTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [editDateInput, setEditDateInput] = useState(''); // Lưu tạm giá trị khi đang chỉnh sửa ngày
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [partnerNames, setPartnerNames] = useState({ 
    name1: user?.display_name || 'Bạn', 
    name2: 'Đang tải...'
  });
// Thêm State để lưu ảnh đại diện (Nếu giao diện bạn có hình Avatar)
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
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
    gender: user?.gender || 'other',
    dob: user?.dob || '',
    oldPassword: '',
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
    const fetchPartner = async () => {
      try {
        const data = await coupleService.getPartnerInfo();
        if (data.has_partner) {
          setPartnerNames(prev => ({ ...prev, name2: data.display_name }));
          if (data.avatar_url) setPartnerAvatar(data.avatar_url);
          if (data.dob) setPartnerDob(data.dob);
          if (data.gender) setPartnerGender(data.gender);
          // BỔ SUNG: Lấy ngày bắt đầu yêu từ CSDL
          if (data.start_date) {
            setStartDateDB(data.start_date);
            // Đổi ra định dạng dùng cho input datetime-local (YYYY-MM-DDTHH:mm)
            const dateObj = new Date(data.start_date);
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
    
    setEditDateInput(localISOTime);
          }
        } else {
          setPartnerNames(prev => ({ ...prev, name2: '(Chưa ghép đôi)' }));
        }
      } catch (error) {
        console.error("Lỗi khi tải thông tin đối phương:", error);
      }
    };
    fetchPartner();
  }, []);

  // ĐẾM GIÂY
  useEffect(() => {
    // Chỉ chạy đồng hồ khi đã có thông tin đối tác và ngày bắt đầu
    if (!hasPartner || !startDateDB) return;

    // 1. Tách công thức tính toán ra thành một hàm độc lập
    const calculateTime = () => {
      const start = new Date(startDateDB).getTime();
      const now = new Date().getTime();
      const diffTime = Math.max(0, now - start); // Tránh ra số âm nếu lỡ chọn ngày tương lai

      setLoveTime({
        days: Math.floor(diffTime / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diffTime / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diffTime / (1000 * 60)) % 60),
        seconds: Math.floor((diffTime / 1000) % 60)
      });
    };

    // 2. GỌI NGAY LẬP TỨC 1 LẦN khi vừa mở web (Để không bị khựng 1 giây đầu)
    calculateTime();

    // 3. Lên lịch cho hàm calculateTime tự động chạy lại liên tục cứ mỗi 1000ms (1 giây)
    const timer = setInterval(calculateTime, 1000);

    // 4. Dọn dẹp bộ nhớ (Tắt đồng hồ) nếu người dùng chuyển sang trang khác
    return () => clearInterval(timer);
  }, [hasPartner, startDateDB]);

  // HÀM LƯU NGÀY VÀO DATABASE
  const handleSaveDate = async () => {
    try {
      // Đổi lại thành chuẩn ISO gửi về Backend
      const localDate = new Date(editDateInput);
      const utcStringToSend = localDate.toISOString();
      const res = await coupleService.updateStartDate(utcStringToSend);
      
      setStartDateDB(res.new_start_date);
      setIsEditingDate(false);
      alert("Đã cập nhật thời gian thành công! 💕");
    } catch (e) {
      alert("Có lỗi xảy ra khi lưu ngày.");
    }
  };

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
// Hàm tính tuổi từ chuỗi ngày sinh (YYYY-MM-DD)
  const getAge = (dobStr?: string) => {
    if (!dobStr) return ''; // Nếu chưa cài ngày sinh thì không hiển thị gì
    
    const birthDate = new Date(dobStr);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    
    // Nếu chưa tới sinh nhật trong năm nay thì trừ đi 1 tuổi
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return `(${age})`; // Trả về chuỗi ví dụ: "(24)"
  };
  // Hàm chuyển đổi giới tính thành danh xưng (Chồng/Vợ)
  const getRoleName = (gender?: string) => {
    if (gender === 'male') return 'Chồng ';
    if (gender === 'female') return 'Vợ ';
    return ''; // Nếu chưa cài đặt giới tính (other) thì không hiện gì cả
  };
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
// Hàm gọi API lấy mã khi vừa mở giao diện lên
useEffect(() => {
  const fetchPairingCode = async () => {
    try {
      const data = await coupleService.getMyCode();
      setPairingCode(data.pairing_code);
    } catch (error) {
      console.error("Lỗi khi lấy mã ghép đôi:", error);
      setPairingCode("LỖI-KẾT-NỐI");
    }
  };

  fetchPairingCode();
}, []);
// Xu li hien thi ten ghep doi
useEffect(() => {
    const fetchPartner = async () => {
      try {
        const data = await coupleService.getPartnerInfo();
        
        if (data.has_partner) {
          // Nếu đã ghép đôi thành công, cập nhật tên thật
          setPartnerNames(prev => ({ ...prev, name2: data.display_name }));
          
          if (data.avatar_url) {
            setPartnerAvatar(data.avatar_url);
          }
        } else {
          // Nếu vẫn FA (chưa ghép đôi)
          setPartnerNames(prev => ({ ...prev, name2: '(Chưa ghép đôi)' }));
        }
      } catch (error) {
        console.error("Lỗi khi tải thông tin đối phương:", error);
        setPartnerNames(prev => ({ ...prev, name2: 'Người ấy' }));
      }
    };

    fetchPartner();
  }, []);
//Huy ghep doi
  // 1. Kiểm tra trạng thái khi vừa mở menu/trang
  useEffect(() => {
    const checkPartnerStatus = async () => {
      try {
        const data = await coupleService.getPartnerInfo();
        setHasPartner(data.has_partner); // true nếu đã có bồ, false nếu FA
      } catch (error) {
        console.error("Lỗi:", error);
      }
    };
    checkPartnerStatus();
  }, []);
  // Hàm xử lý copy mã ghép đôi
  const handleCopyCode = () => {
  if (pairingCode && pairingCode !== 'Đang tải...') {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    // Trả lại icon copy sau 2 giây
    setTimeout(() => setCopied(false), 2000);
  }
};
// Hàm xử lý khi bấm nút Hủy
  const handleUnpair = async () => {
    // Hiện popup xác nhận mặc định của trình duyệt (Hoặc bạn có thể dùng Modal đẹp hơn của Tailwind)
    const confirmUnpair = window.confirm("💔 Bạn có chắc chắn muốn hủy ghép đôi với người ấy không? Mọi dữ liệu chung có thể sẽ bị ảnh hưởng.");
    
    if (!confirmUnpair) return;

    try {
      await coupleService.unpair();
      alert("Đã hủy ghép đôi thành công!");
      
      // Reload lại trang web để giao diện cập nhật về trạng thái FA
      window.location.reload(); 
    } catch (error: any) {
      alert(error.response?.data?.detail || "Có lỗi xảy ra khi hủy ghép đôi.");
    }
  };

  // Xóa tài khoản
  const handleDeleteAccount = async () => {
    // Chặn ngay từ Frontend nếu đang có người yêu
    if (hasPartner) {
      alert("❌ Bạn phải Hủy ghép đôi trước khi có thể xóa tài khoản!");
      return;
    }

    // Cảnh báo 2 lớp vì đây là hành động nguy hiểm
    const confirm1 = window.confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TÀI KHOẢN KHÔNG?\nHành động này không thể hoàn tác và toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.");
    if (!confirm1) return;

    try {
      await authService.deleteAccount();
      alert("Tài khoản của bạn đã được xóa thành công. Tạm biệt!");
      
      // Xóa sạch Token và chuyển về trang Đăng nhập
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hoặc dùng navigate('/login') nếu bạn dùng react-router
    } catch (error: any) {
      alert(error.response?.data?.detail || "Có lỗi xảy ra khi xóa tài khoản.");
    }
  };

  // Hàm xử lý khi người dùng chọn file ảnh từ máy
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setEditForm({ ...editForm, avatarUrl: previewUrl, avatarFile: file });
    }
  };
// Thay doi thong tin ca nhan
  const handleUpdateProfile = async () => {
  setUpdateError(''); // Reset lỗi cũ
  
  if (!editForm.displayName.trim()) {
    setUpdateError('Tên hiển thị không được để trống!');
    return;
  }
  if (editForm.password && !editForm.oldPassword) {
    setUpdateError('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới!');
    return;
  }

  setIsUpdating(true); // Bắt đầu hiệu ứng Loading

  try {
    // Tạo FormData để đóng gói dữ liệu (bao gồm cả file ảnh)
    const formData = new FormData();
    formData.append('display_name', editForm.displayName);
    formData.append('gender', editForm.gender);
    formData.append('dob', editForm.dob);
    
    if (editForm.password) {
      formData.append('old_password', editForm.oldPassword); 
      formData.append('password', editForm.password);
    }
    
    if (editForm.avatarFile) {
      formData.append('avatar', editForm.avatarFile); // File ảnh thật từ máy
    }

    // GỌI API TẠI ĐÂY (Ví dụ với authService)
    const response = await authService.updateProfile(formData);
    
    // Giả lập chờ đợi Backend xử lý 1.5 giây
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Cập nhật thành công giao diện
    setPartnerNames(prev => ({...prev, name1: editForm.displayName}));

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { 
        ...currentUser, 
        display_name: response.user.display_name,
        avatar_url: response.user.avatar_url,
        gender: response.user.gender,
        dob: response.user.dob
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setIsEditModalOpen(false);
      setEditForm(prev => ({ ...prev, password: '', oldPassword: '' }));
      alert('Đã lưu những thay đổi ngọt ngào! 💕');

    } catch (error: any) {
      // Lấy chi tiết lỗi từ FastAPI
      const errorDetail = error.response?.data?.detail;

      if (Array.isArray(errorDetail)) {
        // Nếu là lỗi 422 (mảng các Object), ta bóc tách để lấy câu thông báo
        // errorDetail[0].loc chứa nơi gây lỗi (VD: body -> display_name)
        const fieldError = errorDetail[0].loc[errorDetail[0].loc.length - 1]; 
        setUpdateError(`Lỗi ở trường dữ liệu: ${fieldError} - ${errorDetail[0].msg}`);
      } else {
        // Nếu là các lỗi khác (string)
        setUpdateError(errorDetail || 'Lỗi kết nối server.');
      }
    } finally {
      setIsUpdating(false);
    }
};
// Hàm xử lý khi bấm nút "Kết nối"
const handlePairing = async () => {
  setPairingMessage({ type: '', text: '' }); // Reset thông báo

  if (!partnerCode.trim()) {
    setPairingMessage({ type: 'error', text: 'Vui lòng nhập mã ghép đôi của người ấy!' });
    return;
  }

  setIsPairing(true);

  try {
    const response = await coupleService.pairWithPartner(partnerCode);
    
    // Nếu thành công
    setPairingMessage({ type: 'success', text: 'Ghép đôi thành công! Chúc 2 bạn hạnh phúc 💕' });
    
    // Tùy chọn: Sau khi ghép thành công, bạn có thể tự động reload trang 
    // hoặc chuyển hướng người dùng vào màn hình chính (Dashboard)
    setTimeout(() => {
      window.location.reload(); // Hoặc dùng navigate('/dashboard')
    }, 2000);

  } catch (error: any) {
    // Xử lý báo lỗi từ FastAPI (Mã sai, Đã ghép đôi rồi, v.v.)
    const errorDetail = error.response?.data?.detail || 'Có lỗi xảy ra khi ghép đôi.';
    setPairingMessage({ type: 'error', text: errorDetail });
  } finally {
    setIsPairing(false);
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

{/* Dropdown Menu */}
{isMenuOpen && (
  <div className="absolute right-0 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-pink-100/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-50">
    
    {/* Phần Header: Thông tin User */}
    <div className="p-4 bg-linear-to-br from-pink-50 to-rose-50 border-b border-pink-100/60 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white shadow-sm shrink-0">
        {editForm.avatarUrl ? (
          <img src={editForm.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <User className="w-6 h-6 text-pink-400" />
        )}
      </div>
      <div className="flex flex-col min-w-0 w-full">
        
        {/* Tên & Giới tính */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-gray-800 text-[15px] leading-tight truncate">
            {partnerNames.name1}
          </span>
          {/* Hiển thị Icon giới tính chuẩn */}
          {editForm.gender === 'male' && (
            <span className="text-blue-500 text-lg font-bold leading-none" title="Nam">♂</span>
          )}
          {editForm.gender === 'female' && (
            <span className="text-pink-500 text-lg font-bold leading-none" title="Nữ">♀</span>
          )}
        </div>



        {/* Ngày sinh (Chỉ hiển thị nếu đã cài đặt) */}
        {editForm.dob && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mt-1">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {/* Đảo ngược YYYY-MM-DD thành DD/MM/YYYY cho đúng chuẩn Việt Nam */}
              {editForm.dob.split('-').reverse().join('/')}
            </span>
          </div>
        )}
        {/* Trạng thái hẹn hò */}
        <div className="flex items-center gap-1.5 text-xs text-pink-500 font-medium mt-1">
          <Heart className="w-3.5 h-3.5 fill-pink-500 shrink-0" /> 
          <span className="truncate">
            {hasPartner ? `Đang yêu ${partnerNames.name2}` : 'Đang độc thân'}
          </span>
        </div>

      </div>
    </div>

    {/* Phần Body: Các chức năng chính */}
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

    {/* Phần Footer: Khu vực nguy hiểm (Hủy ghép đôi) */}
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

    {/* Phần Footer 2: Xóa tài khoản (Luôn hiện, nhưng nếu đang có bồ bấm vào sẽ báo lỗi) */}
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
              {/* Hiển thị thông báo Lỗi hoặc Thành công */}
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

      {/* ---------------- MODAL THAY ĐỔI THÔNG TIN ---------------- */}
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
            
            <div className="p-6 space-y-5">
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
                  {/* Nút Nam */}
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer transition-all ${editForm.gender === 'male' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                    <input type="radio" name="gender" value="male" className="hidden" 
                      checked={editForm.gender === 'male'} 
                      onChange={(e) => setEditForm({...editForm, gender: e.target.value})} 
                    />
                    <span className="font-bold text-sm flex items-center gap-1">
                      Nam <span className="text-xl font-black leading-none text-blue-600">♂</span>
                    </span>
                  </label>

                  {/* Nút Nữ */}
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
              {/* BỔ SUNG Ô NHẬP NGÀY SINH */}
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
                <input type="old_password" disabled={isUpdating} placeholder="Nhập mật khẩu của bạn" value={editForm.oldPassword} onChange={(e) => setEditForm({...editForm, oldPassword: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700" />
                <input type="password" disabled={isUpdating} placeholder="Mật khẩu mới" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700" />
              </div>
              <button 
                onClick={handleUpdateProfile}
                disabled={isUpdating}
                className="w-full mt-2 py-3 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-md transform transition-all active:scale-[0.98]"
              >{isUpdating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Đang lưu...</>
          ) : (
            'Lưu thông tin'
          )}
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
        <div className="text-center mt-6 mb-4 z-10 relative">
          <h1 className="text-3xl sm:text-4xl font-bold text-pink-600 drop-shadow-sm flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            
            {/* Tên & Tuổi của Bạn */}
            <span className="flex items-baseline gap-1.5">
              {/* Danh xưng: Chồng/Vợ */}
              <span className="text-xl sm:text-2xl text-pink-500/80 font-semibold tracking-wide">
                {getRoleName(user?.gender)}
              </span>
              {/* Tên chính */}
              <span>{partnerNames.name1}</span>
              {/* Tuổi */}
              <span className="text-lg sm:text-xl text-pink-400 font-medium">
                {getAge(user?.dob)}
              </span>
            </span>
            
            {/* Trái tim ở giữa */}
            <span className="text-rose-500 animate-pulse drop-shadow-md mx-1">💕</span>
            
            {/* Tên & Tuổi của Người yêu */}
            {hasPartner ? (
              <span className="flex items-baseline gap-1.5">
                {/* Danh xưng: Chồng/Vợ */}
                <span className="text-xl sm:text-2xl text-pink-500/80 font-semibold tracking-wide">
                  {getRoleName(partnerGender)}
                </span>
                {/* Tên chính */}
                <span>{partnerNames.name2}</span>
                {/* Tuổi */}
                <span className="text-lg sm:text-xl text-pink-400 font-medium">
                  {getAge(partnerDob)}
                </span>
              </span>
            ) : (
              <span className="text-pink-300">Đang tìm...</span>
            )}

          </h1>
        </div>

        {/* Big Heart Container */}
        <div className="relative my-8">
          
          {/* Vòng tròn nhịp đập phía sau (Đã được phóng to) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-95 h-95 sm:w-125 sm:h-125 border-4 border-pink-300 rounded-full opacity-20 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-82.5 h-82.5 sm:w-107.5 sm:h-107.5 border-4 border-rose-300 rounded-full opacity-30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          </div>

          {/* Main Heart (Phóng to lên sm:w-[420px] sm:h-[420px]) */}
          <div className="relative w-95 h-95 sm:w-125 sm:h-125 flex items-center justify-center">
            
            {/* Lớp trái tim nền */}
            <svg viewBox="0 0 24 24" className="absolute w-full h-full text-pink-500 fill-pink-500 opacity-90 animate-heartbeat drop-shadow-2xl">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            
            {/* Lớp trái tim Gradient bên trên */}
            <svg viewBox="0 0 24 24" className="absolute w-[90%] h-[90%] animate-pulse" style={{ animationDuration: '2s' }}>
              <defs>
                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f472b6" /><stop offset="50%" stopColor="#fb7185" /><stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
              </defs>
              <path fill="url(#heartGradient)" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>

            {/* Days Counter Inside Heart */}
            {hasPartner ? (
              // Đã đổi thành -mt-10 để kéo nội dung lên giữa vùng phình to của trái tim
              <div className="relative z-10 flex flex-col items-center justify-center -mt-8 sm:-mt-12">
                <span className="text-pink-100 text-sm font-medium tracking-widest uppercase mb-1 drop-shadow-md">
                  Đã bên nhau
                </span>
                
                <div className="flex items-baseline gap-1.5">
                  {/* Phóng to font chữ số NGÀY lên text-8xl */}
                  <span className="text-7xl sm:text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] tracking-tighter">
                    {loveTime.days}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-white/90 drop-shadow-md mb-2">
                    ngày
                  </span>
                </div>

                <div className="mt-2 sm:mt-4 flex items-center justify-center gap-2 sm:gap-3 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
                  <div className="flex flex-col items-center w-10">
                    <span className="text-xl sm:text-2xl font-bold text-white font-mono drop-shadow-sm">{loveTime.hours.toString().padStart(2, '0')}</span>
                    <span className="text-[9px] font-bold text-pink-100 uppercase tracking-wider mt-0.5">Giờ</span>
                  </div>
                  
                  <span className="text-xl font-bold text-pink-200 animate-pulse pb-4">:</span>
                  
                  <div className="flex flex-col items-center w-10">
                    <span className="text-xl sm:text-2xl font-bold text-white font-mono drop-shadow-sm">{loveTime.minutes.toString().padStart(2, '0')}</span>
                    <span className="text-[9px] font-bold text-pink-100 uppercase tracking-wider mt-0.5">Phút</span>
                  </div>

                  <span className="text-xl font-bold text-pink-200 animate-pulse pb-4">:</span>
                  
                  <div className="flex flex-col items-center w-10">
                    <span className="text-xl sm:text-2xl font-bold text-white font-mono drop-shadow-sm">{loveTime.seconds.toString().padStart(2, '0')}</span>
                    <span className="text-[9px] font-bold text-pink-100 uppercase tracking-wider mt-0.5">Giây</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 text-center flex flex-col items-center -mt-6">
                <div className="text-6xl sm:text-8xl font-black text-white/40 drop-shadow-lg leading-none animate-pulse">?</div>
                <div className="text-sm sm:text-base font-medium text-white/80 drop-shadow-md mt-4 tracking-wide">Đang đợi người ấy...</div>
              </div>
            )}

            {/* Floating Hearts Around */}
            <Heart className="absolute -top-8 -left-8 sm:-top-12 sm:-left-12 w-12 h-12 text-pink-400 fill-pink-400 opacity-60 animate-bounce pointer-events-none" style={{ animationDelay: '0s', animationDuration: '2s' }} />
            <Heart className="absolute -top-8 -right-8 sm:-top-10 sm:-right-10 w-10 h-10 text-rose-400 fill-rose-400 opacity-70 animate-bounce pointer-events-none" style={{ animationDelay: '0.3s', animationDuration: '2.2s' }} />
            <Heart className="absolute -bottom-8 -left-8 sm:-bottom-12 sm:-left-12 w-10 h-10 text-red-400 fill-red-400 opacity-60 animate-bounce pointer-events-none" style={{ animationDelay: '0.6s', animationDuration: '2.5s' }} />
            <Heart className="absolute -bottom-8 -right-8 sm:-bottom-10 sm:-right-10 w-12 h-12 text-pink-400 fill-pink-400 opacity-70 animate-bounce pointer-events-none" style={{ animationDelay: '0.9s', animationDuration: '2.8s' }} />
          </div>
        </div>

        {/* Date Info */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-8 w-full max-w-sm border border-white/50">
          {isEditingDate ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Thời khắc bắt đầu yêu</label>
                <input
                  type="datetime-local" // Thay đổi từ "date" sang "datetime-local"
                  value={editDateInput} // Sử dụng state editDateInput
                  onChange={(e) => setEditDateInput(e.target.value)}
                  className="w-full px-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700 font-medium"
                />
              </div>
              <button 
                onClick={handleSaveDate} // Thay đổi từ setisEditingDate sang gọi hàm API
                className="w-full mt-2 py-3 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-lg shadow-pink-200 transform transition-all active:scale-[0.98]"
              >
                Lưu ngày
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-gray-600 font-medium mb-3">
                <Calendar className="w-5 h-5 text-pink-500" />
                <span>Bắt đầu yêu từ</span>
              </div>
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-pink-600 to-rose-600 mb-5">
                {startDateDB ? new Date(startDateDB).toLocaleString('vi-VN', {
                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                }) : 'Chưa thiết lập'}
              </div>
              
              {/* Chỉ cho phép đổi ngày nếu đang có bồ */}
              {hasPartner && (
                <button onClick={() => setIsEditingDate(true)} className="text-sm font-bold text-pink-500 hover:text-pink-600 transition-colors hover:underline underline-offset-4">
                  Chỉnh sửa thời gian
                </button>
              )}
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