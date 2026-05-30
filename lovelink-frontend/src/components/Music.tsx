import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Music, VolumeX } from 'lucide-react';

export default function BackgroundMusic() {
  const location = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null); // 🌟 Chỉ dùng 1 biến duy nhất này thôi
  const hasAttemptedAutoPlay = useRef(false);
  const hasUserInteracted = useRef(false);

  const safePlayMusic = async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        hasUserInteracted.current = true;
      } catch (error) {
        setIsPlaying(false);
      }
    }
  };

  // 🌟 ĐÃ SỬA: Lắng nghe tiếng hét từ WatchTogether và MusicContext
  useEffect(() => {
    const handleStopBgMusic = () => {
      if (audioRef.current) {
        audioRef.current.pause(); // Gọi đúng tên biến audioRef
        setIsPlaying(false);      // 🌟 Cập nhật luôn UI để nút bấm chuyển về màu xám
      }
    };

    window.addEventListener('stop_background_music', handleStopBgMusic);
    return () => {
      window.removeEventListener('stop_background_music', handleStopBgMusic);
    };
  }, []);

  // 1. Cố gắng tự động phát nhạc khi vừa vào trang
  useEffect(() => {
    if (!hasAttemptedAutoPlay.current && location.pathname !== '/auth') {
      hasAttemptedAutoPlay.current = true;
      setTimeout(() => safePlayMusic(), 200); 
    }
  }, [location.pathname]);

  // 2. Sự kiện "bắt click" để bật nhạc (CHỈ LÀM 1 LẦN DUY NHẤT)
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!hasUserInteracted.current && !isPlaying && audioRef.current) {
        safePlayMusic();
      }
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  const toggleMusic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    hasUserInteracted.current = true;

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

  return (
    <>
      <audio ref={audioRef} loop preload="auto" hidden>
        <source src="/nhac-nen.mp3" type="audio/mpeg" />
      </audio>
      <button 
        onClick={toggleMusic}
        className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full backdrop-blur-md transition-all shadow-sm ${isPlaying ? 'bg-pink-500 text-white animate-pulse' : 'bg-white/50 text-pink-600 hover:bg-white/70'}`}
        title="Bật/Tắt nhạc nền"
      >
        {isPlaying ? <Music className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
      </button>
    </>
  );
}