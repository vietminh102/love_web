import { Heart, Sparkles, Calendar } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { coupleService } from '../../services/coupleService';

export default function HomePage() {
  const { user } = useAuth();
  
  // --- STATES CHO GIAO DIỆN CHÍNH ---
  const [partnerDob, setPartnerDob] = useState<string>('');
  const [partnerGender, setPartnerGender] = useState<string>('other');
  const [hasPartner, setHasPartner] = useState(false);
  
  const [startDateDB, setStartDateDB] = useState<string | null>(null);
  const [loveTime, setLoveTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [editDateInput, setEditDateInput] = useState(''); 
  const [isEditingDate, setIsEditingDate] = useState(false);
  
  const [partnerNames, setPartnerNames] = useState({ 
    name1: user?.display_name || 'Bạn', 
    name2: 'Đang tải...'
  });

  // Cập nhật tên khi load
  useEffect(() => {
    if (user) {
      setPartnerNames(prev => ({ ...prev, name1: user.display_name || 'Bạn' }));
    }
  }, [user]);

  // Lấy thông tin đối phương từ API
  useEffect(() => {
    if (!user) return;
    const fetchPartner = async () => {
      try {
        const data = await coupleService.getPartnerInfo();
        setHasPartner(data.has_partner);
        
        if (data.has_partner) {
          setPartnerNames(prev => ({ ...prev, name2: data.display_name }));
          if (data.dob) setPartnerDob(data.dob);
          if (data.gender) setPartnerGender(data.gender);
          
          if (data.start_date) {
            setStartDateDB(data.start_date);
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
        setPartnerNames(prev => ({ ...prev, name2: 'Người ấy' }));
      }
    };
    fetchPartner();
  }, [user]);

  // Đồng hồ đếm thời gian yêu nhau
  useEffect(() => {
    if (!hasPartner || !startDateDB) return;

    const calculateTime = () => {
      const start = new Date(startDateDB).getTime();
      const now = new Date().getTime();
      const diffTime = Math.max(0, now - start);

      setLoveTime({
        days: Math.floor(diffTime / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diffTime / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diffTime / (1000 * 60)) % 60),
        seconds: Math.floor((diffTime / 1000) % 60)
      });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [hasPartner, startDateDB]);

  // Lưu ngày bắt đầu yêu
  const handleSaveDate = async () => {
    try {
      const localDate = new Date(editDateInput);
      const res = await coupleService.updateStartDate(localDate.toISOString());
      
      setStartDateDB(res.new_start_date);
      setIsEditingDate(false);
      alert("Đã cập nhật thời gian thành công! 💕");
    } catch (e) {
      alert("Có lỗi xảy ra khi lưu ngày.");
    }
  };

  // Tính tuổi
  const getAge = (dobStr?: string) => {
    if (!dobStr) return ''; 
    const birthDate = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `(${age})`; 
  };

  // Danh xưng
  const getRoleName = (gender?: string) => {
    if (gender === 'male') return 'Chồng ';
    if (gender === 'female') return 'Vợ ';
    return ''; 
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-pink-200 via-rose-200 to-red-200 relative overflow-hidden font-sans">
      
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
            
            <span className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl text-pink-500/80 font-semibold tracking-wide">
                {getRoleName(user?.gender)}
              </span>
              <span>{partnerNames.name1}</span>
              <span className="text-lg sm:text-xl text-pink-400 font-medium">
                {getAge(user?.dob)}
              </span>
            </span>
            
            <span className="text-rose-500 animate-pulse drop-shadow-md mx-1">💕</span>
            
            {hasPartner ? (
              <span className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl text-pink-500/80 font-semibold tracking-wide">
                  {getRoleName(partnerGender)}
                </span>
                <span>{partnerNames.name2}</span>
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
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-95 h-95 sm:w-125 sm:h-125 border-4 border-pink-300 rounded-full opacity-20 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-82.5 h-82.5 sm:w-107.5 sm:h-107.5 border-4 border-rose-300 rounded-full opacity-30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          </div>

          <div className="relative w-95 h-95 sm:w-125 sm:h-125 flex items-center justify-center">
            
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
            {hasPartner ? (
              <div className="relative z-10 flex flex-col items-center justify-center -mt-8 sm:-mt-12">
                <span className="text-pink-100 text-sm font-medium tracking-widest uppercase mb-1 drop-shadow-md">
                  Đã bên nhau
                </span>
                
                <div className="flex items-baseline gap-1.5">
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
                  type="datetime-local"
                  value={editDateInput}
                  onChange={(e) => setEditDateInput(e.target.value)}
                  className="w-full px-4 py-3 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-700 font-medium"
                />
              </div>
              <button 
                onClick={handleSaveDate}
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