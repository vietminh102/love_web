import React, { useEffect, useState, useRef,useMemo } from 'react';
import { BellRing, X, Heart } from 'lucide-react'; // 🌟 Đã thêm icon Heart
import { motion, AnimatePresence } from 'motion/react';

export const AlarmOverlay = () => {
  const [isRinging, setIsRinging] = useState(false);
  const [alarmData, setAlarmData] = useState({ title: '', message: '' });
  
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3'));

  useEffect(() => {
    audioRef.current.loop = true;
    audioRef.current.volume = 1.0;


    const handleAlarmTrigger = (e: any) => {
      const { action, payload } = e.detail;
      
      if (action === 'trigger_alarm') {
        // Tắt các thẻ <audio> và <video> đang chạy
        const mediaElements = document.querySelectorAll('audio, video');
        mediaElements.forEach((media: any) => {
          if (!media.paused) media.pause();
        });

        // Tắt video YouTube ở trang WatchTogether
        window.dispatchEvent(new CustomEvent('sync_video_event', { 
          detail: { action: 'pause' } 
        }));

        setAlarmData({
          title: payload.title || 'Lời nhắc nhở tình yêu!',
          message: payload.message || 'Đã đến giờ rồi bé ơi 💕'
        });
        setIsRinging(true);
        
        audioRef.current.play().catch(err => console.log("Trình duyệt chặn tự động phát âm thanh:", err));
      }
    };
    

    window.addEventListener('sync_video_event', handleAlarmTrigger);
    return () => {
      window.removeEventListener('sync_video_event', handleAlarmTrigger);
      audioRef.current.pause();
    };
  }, []);
    const randomHearts = useMemo(() => {
    return [...Array(6)].map((_, i) => ({
      id: `floating-heart-${i}`,
      left: `${20 + Math.random() * 60}%`,
      top: `${40 + Math.random() * 40}%`,
      delay: `${Math.random() * 2}s`,
      size: `${14 + Math.random() * 10}px`
    }));
  }, []);

  const stopAlarm = () => {
    setIsRinging(false);
    audioRef.current.pause();
    audioRef.current.currentTime = 0; 
  };

  return (
    <AnimatePresence>
      {isRinging && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-99999 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          {/* 🌟 Đổi chớp đỏ thành chớp hồng nhẹ nhàng */}
          <div className="absolute inset-0 bg-pink-500/20 animate-pulse pointer-events-none" />

          <motion.div 
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            // 🌟 Đổi bóng tỏa ra thành màu hồng mộng mơ
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-[0_0_60px_rgba(236,72,153,0.5)] flex flex-col items-center text-center relative overflow-hidden border border-pink-100"
          >
            {/* Hiệu ứng sóng lan tỏa sau chuông */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-pink-50 rounded-full animate-ping opacity-80" />
            
            {/* 🌟 HIỆU ỨNG TRÁI TIM BAY LƠ LỬNG TRONG BẢNG THÔNG BÁO */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              {randomHearts.map((heart) => (
                <Heart
                  key={heart.id}
                  className="absolute text-pink-300 fill-pink-300 opacity-60 animate-[float-up_2s_ease-in-out_infinite]"
                  style={{
                    left: heart.left,
                    top: heart.top,
                    animationDelay: heart.delay,
                    width: heart.size,
                    height: heart.size,
                  }}
                />
              ))}
            </div>
          
            <div className="relative w-24 h-24 bg-linear-to-br from-pink-400 to-rose-400 rounded-full flex items-center justify-center shadow-xl mb-6 z-10 border-4 border-white">
            
              <BellRing className="w-12 h-12 text-white animate-[gentle-wiggle_0.6s_ease-in-out_infinite]" />
            </div>

            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-rose-500 mb-2 uppercase tracking-wide z-10">
              {alarmData.title}
            </h2>
            <p className="text-gray-700 font-medium mb-8 text-lg z-10">
              {alarmData.message}
            </p>

            <button 
              onClick={stopAlarm}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl z-10"
            >
              <X className="w-6 h-6" /> Đã rõ, tắt chuông!
            </button>
          </motion.div>
        </motion.div>
      )}

      <style>{`
        /* 🌟 Lắc nhẹ nhàng, thong thả (12 độ) */
        @keyframes gentle-wiggle {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        
        /* 🌟 Hiệu ứng trái tim bay lên và mờ dần */
        @keyframes float-up {
          0% { transform: translateY(10px) scale(0.8); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translateY(-70px) scale(1.2); opacity: 0; }
        }
      `}</style>
    </AnimatePresence>
  );
};