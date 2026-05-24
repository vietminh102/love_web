import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sparkles, Gift, ArrowDown, RefreshCw, Settings, Trash2, Plus, Save, X } from 'lucide-react';
import apiClient from '../../services/apiClient'; // Mượn apiClient để gọi API đồng bộ

// Phần thưởng mặc định nếu cặp đôi chưa tự cấu hình
const DEFAULT_PRIZES = [
  { id: 1, text: 'Một cái ôm thật chặt', color: '#fdf2f8', textColor: '#be185d' },
  { id: 2, text: 'Người ấy rửa bát', color: '#fbcfe8', textColor: '#be185d' },
  { id: 3, text: 'Trà sữa free', color: '#fdf2f8', textColor: '#be185d' },
  { id: 4, text: 'Một nụ hôn', color: '#fbcfe8', textColor: '#be185d' },
];

// Bảng màu lãng mạn luân phiên cho các ô thêm mới
const PALETTE = [
  { color: '#fdf2f8', textColor: '#be185d' }, // pink-50
  { color: '#fbcfe8', textColor: '#be185d' }, // pink-200
  { color: '#fce7f3', textColor: '#9d174d' }, // pink-100
  { color: '#f9a8d4', textColor: '#831843' }, // pink-300
];

export default function LuckyWheelPage() {
  const [prizes, setPrizes] = useState<any[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [isAutoDelete, setIsAutoDelete] = useState(false);
  
  // States cho chế độ chỉnh sửa
  const [isEditing, setIsEditing] = useState(false);
  const [newPrizeText, setNewPrizeText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Tải dữ liệu vòng quay chung của 2 người từ Backend
  useEffect(() => {
    fetchWheelData();
  }, []);
  // 1. Lắng nghe tín hiệu đồng bộ từ WebSocket (Thêm vào dưới cái useEffect fetchWheelData)
useEffect(() => {
    const handleRemoteSpin = (e: any) => {
      const { prize_index, is_auto_delete } = e.detail;
      setIsAutoDelete(is_auto_delete); // Đồng bộ luôn giao diện gạt nút switch sang máy đối phương
      startSpinning(prize_index, true, is_auto_delete);
    };
    window.addEventListener('triggerWheelSpin', handleRemoteSpin);
    return () => window.removeEventListener('triggerWheelSpin', handleRemoteSpin);
  }, [prizes, isSpinning]);
  //Hàm xoay Cốt Lõi (Dùng chung cho cả tự quay và bị quay theo)
const startSpinning = (targetIndex: number, isRemote = false, autoDeleteCurrent = isAutoDelete) => {
    if (isSpinning || prizes.length < 2) return;
    
    setIsSpinning(true);
    setWonPrize(null);

    setRotation((prevRotation) => {
      const sliceAngle = 360 / prizes.length;
      const stopAngle = targetIndex * sliceAngle + (sliceAngle / 2);
      return prevRotation + (360 * 5) + (360 - stopAngle) - (prevRotation % 360);
    });

    if (!isRemote) {
      apiClient.post('/couple/wheel/sync-spin', { 
        prize_index: targetIndex,
        is_auto_delete: autoDeleteCurrent // Bắn trạng thái nút sang máy kia
      }).catch(e => console.log(e));
    }

    setTimeout(async () => {
      setIsSpinning(false);
      const targetPrize = prizes[targetIndex];
      if (!targetPrize) return;

      setWonPrize(targetPrize.text);

      // 🌟 XỬ LÝ TỰ ĐỘNG XÓA KHI QUAY TRÚNG
      if (autoDeleteCurrent) {
        setPrizes((prevPrizes) => {
          const updated = prevPrizes.filter((_, idx) => idx !== targetIndex);
          // Người chủ động ấn nút sẽ có trách nhiệm lưu mảng mới lên Database để đồng bộ vĩnh viễn
          if (!isRemote) {
            apiClient.put('/couple/wheel', { prizes: updated }).catch(e => console.log(e));
          }
          return updated;
        });
      }

      if (!isRemote) {
        try {
          await apiClient.post('/couple/wheel/notify', { result: targetPrize.text });
        } catch (error) {}
      }
    }, 5000);
  };
  // Hàm gọi khi ấn nút bấm (Thay thế cho spinWheel cũ)
  const handleManualSpin = () => {
    if (prizes.length < 2) return alert("Cần ít nhất 2 phần thưởng để quay!");
    if (isAutoDelete && prizes.length <= 2) {
      return alert("Nếu xóa ô này vòng quay sẽ chỉ còn 1 ô, không thể quay tiếp! Vui lòng thêm ô mới hoặc tắt chế độ tự xóa.");
    }
    const prizeIndex = Math.floor(Math.random() * prizes.length);
    startSpinning(prizeIndex, false, isAutoDelete);
  };
  const fetchWheelData = async () => {
    try {
      // Gọi API lấy vòng quay (Tạm thời dùng try-catch để web không sập nếu backend chưa có API này)
      const res = await apiClient.get('/couple/wheel');
      if (res.data && res.data.prizes && res.data.prizes.length > 0) {
        setPrizes(res.data.prizes);
      } else {
        setPrizes(DEFAULT_PRIZES);
      }
    } catch (error) {
      console.warn("Backend chưa có API lấy vòng quay, dùng tạm dữ liệu mặc định.");
      setPrizes(DEFAULT_PRIZES);
    } finally {
      setIsLoading(false);
    }
  };

  

  // --- XỬ LÝ CHẾ ĐỘ TÙY CHỈNH ---
  const handleAddPrize = () => {
    if (!newPrizeText.trim()) return;
    if (prizes.length >= 12) return alert("Nhiều nhất 12 ô thôi để vòng quay không bị rối mắt nhé!");
    
    const colorTheme = PALETTE[prizes.length % PALETTE.length];
    const newPrize = {
      id: Date.now(),
      text: newPrizeText.trim(),
      ...colorTheme
    };
    setPrizes([...prizes, newPrize]);
    setNewPrizeText('');
  };

  const handleRemovePrize = (idToRemove: number) => {
    setPrizes(prizes.filter(p => p.id !== idToRemove));
  };

  const handleSavePrizes = async () => {
    if (prizes.length < 2) return alert("Vui lòng để lại ít nhất 2 phần thưởng!");
    setIsLoading(true);
    try {
      // 🌟 GỌI API LƯU VÒNG QUAY CHUNG CHO CẢ 2 NGƯỜI
      await apiClient.put('/couple/wheel', { prizes });
      setIsEditing(false);
      alert("Đã đồng bộ vòng quay với người ấy! 💕");
    } catch (error) {
      alert("Lưu tạm vào máy thành công! (Cần cập nhật Backend để đồng bộ).");
      setIsEditing(false); // Vẫn cho đóng Modal để dùng tạm
    } finally {
      setIsLoading(false);
    }
  };

  // Tính toán màu nền
  const wheelBackground = `conic-gradient(from 0deg, ${prizes.map((prize, i) => {
    const startAngle = (i * 360) / prizes.length;
    const endAngle = ((i + 1) * 360) / prizes.length;
    return `${prize.color} ${startAngle}deg ${endAngle}deg`;
  }).join(', ')})`;

  if (isLoading && prizes.length === 0) return <div className="pt-30 text-center text-pink-400 animate-pulse">Đang đồng bộ vòng quay...</div>;

  return (
    <div className="w-full mx-auto max-w-md px-4 flex flex-col items-center justify-center min-h-[85vh] pt-20 pb-10">
      
      {/* Header */}
      <div className="text-center mb-10 relative w-full">
        <Sparkles className="absolute -top-6 left-0 w-6 h-6 text-pink-400 animate-pulse" />
        <h2 className="text-3xl font-serif text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-rose-600 font-bold mb-2">
          Vòng Quay Tình Yêu
        </h2>
        <p className="text-sm text-gray-500 italic">Thử vận may hôm nay của bạn nhé!</p>
        
        {/* 🌟 Nút mở Modal Tùy chỉnh */}
        <button 
          onClick={() => setIsEditing(true)}
          disabled={isSpinning}
          className="absolute right-0 top-0 p-2 bg-pink-50 text-pink-500 hover:bg-pink-100 rounded-full transition-colors disabled:opacity-50"
          title="Tùy chỉnh vòng quay"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Khu vực Vòng quay */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 mb-10">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 drop-shadow-xl text-rose-500">
          <ArrowDown className="w-10 h-10 fill-rose-500" />
        </div>

        <div className="w-full h-full p-2 bg-linear-to-br from-pink-200 to-rose-300 rounded-full shadow-[0_0_40px_rgba(244,114,182,0.3)]">
          <motion.div
            className="w-full h-full rounded-full border-4 border-white relative overflow-hidden shadow-inner"
            style={{ background: wheelBackground }}
            animate={{ rotate: rotation }}
            transition={{ duration: 5, ease: [0.15, 0.85, 0.15, 1] }} 
          >
            {prizes.map((prize, i) => {
              const angle = (i * 360) / prizes.length + (360 / prizes.length) / 2 - 90;
              return (
                <div
                  key={prize.id}
                  className="absolute w-[50%] h-6 top-1/2 left-1/2 origin-left flex items-center justify-end pr-4 sm:pr-6"
                  style={{ transform: `translateY(-50%) rotate(${angle}deg)` }}
                >
                <span 
                  className="text-sm sm:text-base font-bold w-24 sm:w-32 text-right leading-tight drop-shadow-sm"
                  style={{ color: prize.textColor }}
                >
                  {prize.text}
                </span>
                </div>
              );
            })}
          </motion.div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white rounded-full shadow-lg border-4 border-pink-100 flex items-center justify-center z-10">
          <Heart className="w-6 h-6 text-rose-500 fill-rose-500 animate-pulse" />
        </div>
      </div>
      {/* CÔNG TẮC TỰ ĐỘNG XÓA Ô KHI QUAY TRÚNG */}
      <div className="flex items-center gap-3 mb-6 bg-pink-50/50 px-4 py-2 rounded-2xl border border-pink-100">
        <span className="text-xs font-medium text-pink-700">Xóa sau khi quay vào</span>
        <button
          onClick={() => !isSpinning && setIsAutoDelete(!isAutoDelete)}
          disabled={isSpinning}
          className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${isAutoDelete ? 'bg-pink-500' : 'bg-gray-300'}`}
        >
          <motion.div
            className="bg-white w-4 h-4 rounded-full shadow-md"
            animate={{ x: isAutoDelete ? 16 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <button
        onClick={handleManualSpin}
        disabled={isSpinning}
        className="px-10 py-3.5 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-bold rounded-full shadow-xl hover:shadow-pink-300/50 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <RefreshCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        {isSpinning ? 'Đang quay...' : 'Quay ngay!'}
      </button>

      {/* 🌟 MODAL TÙY CHỈNH VÒNG QUAY */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 bg-pink-50 border-b border-pink-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5 text-pink-500"/> Thiết lập Vòng quay</h3>
                <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                {prizes.map((prize) => (
                  <div key={prize.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-xl">
                    <span className="text-sm font-medium text-gray-700 truncate pr-2">{prize.text}</span>
                    <button onClick={() => handleRemovePrize(prize.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-100 bg-white space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newPrizeText}
                    onChange={(e) => setNewPrizeText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPrize()}
                    placeholder="VD: Mua trà sữa..."
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm"
                  />
                  <button onClick={handleAddPrize} className="px-3 bg-pink-100 text-pink-600 hover:bg-pink-200 rounded-xl transition-colors">
                    <Plus className="w-5 h-5"/>
                  </button>
                </div>
                
                <button 
                  onClick={handleSavePrizes}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-linear-to-r from-pink-400 to-rose-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                >
                  <Save className="w-4 h-4"/> Lưu & Đồng bộ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Chúc Mừng Kết Quả */}
      <AnimatePresence>
        {wonPrize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 50 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-2 border-pink-100 relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-100 rounded-full blur-2xl opacity-50" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-rose-100 rounded-full blur-2xl opacity-50" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-4">
                  <Gift className="w-8 h-8 text-rose-500 animate-bounce" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Chúc mừng bạn!</h3>
                <p className="text-gray-500 text-sm mb-4">Phần thưởng dành cho bạn là:</p>
                
                <div className="bg-linear-to-r from-pink-50 to-rose-50 border border-pink-200 px-6 py-4 rounded-2xl w-full mb-6">
                  <span className="text-xl font-bold text-rose-600 uppercase tracking-wide">
                    "{wonPrize}"
                  </span>
                </div>

                <button
                  onClick={() => setWonPrize(null)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Đóng lại
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}