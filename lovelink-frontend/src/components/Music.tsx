import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Music, VolumeX } from 'lucide-react';

export default function BackgroundMusic() {
  const location = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
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

  const toggleMusic = async (e: React.MouseEvent) => {
    e.stopPropagation();
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