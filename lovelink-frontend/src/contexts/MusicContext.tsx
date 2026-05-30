import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import apiClient from '../services/apiClient';

const MusicContext = createContext<any>(null);
export const useMusic = () => useContext(MusicContext);

export const MusicProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState({ id: '', title: '', channel: '', thumbnail: '' });
  const [audioUrl, setAudioUrl] = useState(''); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false); 

  const audioRef = useRef<HTMLAudioElement>(null); 
  const pendingSyncRef = useRef<{time: number, isPlaying: boolean} | null>(null);
  
  const currentSongIdRef = useRef(currentSong.id);
  const currentPlaylistRef = useRef(playlist);
  const isSyncingRef = useRef(false);
  const syncLockTimeoutRef = useRef<any>(null);

  // KHAI BÁO BASE_URL AN TOÀN
  const BASE_URL = apiClient.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    currentSongIdRef.current = currentSong.id;
    currentPlaylistRef.current = playlist;
  }, [currentSong.id, playlist]);

  const lockSync = (lockTime = 2000) => {
    isSyncingRef.current = true;
    if (syncLockTimeoutRef.current) clearTimeout(syncLockTimeoutRef.current);
    syncLockTimeoutRef.current = setTimeout(() => { isSyncingRef.current = false; }, lockTime); 
  };

  const broadcastSignal = (action: string, payload: any = null) => {
    apiClient.post('/couple/video/sync', { action, payload }).catch(console.error);
  };

  // 1. TẠO LINK TRỰC TIẾP TỚI ĐƯỜNG ỐNG PROXY BACKEND
  useEffect(() => {
    if (!currentSong.id) return;
    setIsLoadingAudio(true);
    setIsPlaying(false);
    
    // 🌟 KHÔNG CẦN GỌI API ĐỂ LẤY URL NỮA, BẮN THẲNG LINK VÀO THẺ AUDIO
    // Trình duyệt sẽ tự động kết nối với đường ống StreamingResponse bên Backend
    setAudioUrl(`${BASE_URL}/couple/video/stream/${currentSong.id}`);
    
    // Giả lập thời gian load để UI mượt mà
    setTimeout(() => setIsLoadingAudio(false), 1500);
  }, [currentSong.id, BASE_URL]);

  // 2. TỔNG ĐÀI ĐỒNG BỘ
  useEffect(() => {
    const syncTimeout = setTimeout(() => { broadcastSignal('request_music_sync'); }, 1500);

    const handleRemoteSignaling = async (e: any) => {
      const { action, payload } = e.detail;
      
      if (action === 'request_music_sync') {
        if (currentSongIdRef.current && audioRef.current) {
          try {
            broadcastSignal('sync_music_state', { 
              song: currentSong, 
              time: audioRef.current.currentTime || 0, 
              isPlaying: !audioRef.current.paused, 
              playlist: currentPlaylistRef.current 
            });
          } catch (err) {}
        }
      }
      else if (action === 'sync_music_state') {
        lockSync(5000); 
        setPlaylist(payload.playlist || []);
        if (currentSongIdRef.current !== payload.song.id) {
          pendingSyncRef.current = { time: payload.time, isPlaying: payload.isPlaying };
          setCurrentSong(payload.song);
        } else if (audioRef.current) {
          audioRef.current.currentTime = payload.time;
          if (payload.isPlaying) safePlay();
          else audioRef.current.pause();
        }
      }
      else if (action === 'change_song') {
        setCurrentSong(payload);
        lockSync(5000);
      } 
      else if (action === 'play_next_song') {
        setCurrentSong(payload.nextSong);
        setPlaylist(payload.remainingPlaylist);
        lockSync(5000);
      }
      else if (action === 'add_to_playlist') {
        setPlaylist(prev => [...prev, payload]);
      }
      else if (action === 'play_music') {
        if (audioRef.current && payload !== undefined) {
          lockSync();
          if (Math.abs(audioRef.current.currentTime - payload) > 2) audioRef.current.currentTime = payload;
          safePlay();
        }
      } 
      else if (action === 'pause_music') {
        if (audioRef.current && payload !== undefined) {
          lockSync();
          audioRef.current.currentTime = payload;
          audioRef.current.pause();
        }
      }
      else if (action === 'seek_music') {
        if (audioRef.current && payload !== undefined) {
          lockSync(1500);
          audioRef.current.currentTime = payload;
        }
      }
    };

    window.addEventListener('sync_video_event', handleRemoteSignaling);
    return () => {
      clearTimeout(syncTimeout);
      window.removeEventListener('sync_video_event', handleRemoteSignaling);
    };
  }, [currentSong]); 

  // 🌟 3. HÀM CHỐNG LỖI "ABORT ERROR" TUYỆT ĐỐI
  const safePlay = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
         console.warn("Trình duyệt chặn tự động phát:", error);
      }
      setIsPlaying(false); // Sửa lỗi đĩa xoay ảo
    }
  };

const playMusic = async () => {
    if (!audioRef.current || !currentSong.id || isSyncingRef.current || !audioUrl) return;
    try {
      // 🌟 THÊM DÒNG NÀY: Hét lên yêu cầu tắt nhạc nền toàn trang
      window.dispatchEvent(new Event('stop_background_music'));
      
      await audioRef.current.play();
      broadcastSignal('play_music', audioRef.current.currentTime || 0);
    } catch (error) {
      console.warn("Trình duyệt chặn phát nhạc. Bạn cần click vào web!", error);
      setIsPlaying(false);
    }
  };

  const pauseMusic = () => {
    if (!audioRef.current || !currentSong.id || isSyncingRef.current) return;
    audioRef.current.pause();
    broadcastSignal('pause_music', audioRef.current.currentTime || 0);
  };

  const seekMusic = (newTime: number) => {
    if (!audioRef.current || !currentSong.id || isSyncingRef.current) return;
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
    broadcastSignal('seek_music', newTime);
  };

  const handleNextSong = () => {
    if (currentPlaylistRef.current.length > 0) {
      const nextSong = currentPlaylistRef.current[0];
      const remainingPlaylist = currentPlaylistRef.current.slice(1);
      setCurrentSong(nextSong);
      setPlaylist(remainingPlaylist);
      broadcastSignal('play_next_song', { nextSong, remainingPlaylist });
    }
  };

  const addSongToPlaylist = (song: any) => {
    setPlaylist(prev => [...prev, song]);
    broadcastSignal('add_to_playlist', song);
  };

  const changeSongNow = (song: any) => {
    setCurrentSong(song);
    broadcastSignal('change_song', song);
  };

  return (
    <MusicContext.Provider value={{ 
      currentSong, isPlaying, progress, duration, playlist,
      playMusic, pauseMusic, seekMusic, handleNextSong, addSongToPlaylist, changeSongNow
    }}>
      <div className={currentSong.id ? "pb-24" : ""}> 
        {children}
      </div>

      {currentSong.id && (
        <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-pink-100 shadow-[0_-10px_30px_rgba(255,192,203,0.3)] z-50 flex flex-col animate-in slide-in-from-bottom-10">
          <div className="w-full h-1 bg-gray-100 cursor-pointer" onClick={(e) => {
              const bounds = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - bounds.left) / bounds.width;
              seekMusic(percent * duration);
          }}>
             <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 transition-all ease-linear" style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }} />
          </div>
          
          <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-3 max-w-7xl mx-auto w-full gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border-2 border-pink-100 shadow-sm ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
                <img src={currentSong.thumbnail} alt="cover" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm sm:text-base text-gray-800 truncate">{currentSong.title}</span>
                <span className="text-xs text-pink-500 truncate">{isLoadingAudio ? 'Đang chuẩn bị nhạc...' : currentSong.channel}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <button 
                onClick={isPlaying ? pauseMusic : playMusic} 
                disabled={isLoadingAudio || !audioUrl}
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500 rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </button>
              <button 
                onClick={handleNextSong} disabled={playlist.length === 0}
                className={`p-2 transition-all ${playlist.length > 0 ? 'text-pink-500 hover:text-pink-700 hover:bg-pink-50 rounded-full' : 'text-gray-300'}`}
              >
                <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. NATIVE AUDIO */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        autoPlay
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleNextSong}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            // KHI TẢI XONG BẮT ĐẦU PHÁT VÀ XỬ LÝ ĐỒNG BỘ VÀO SAU
            if (pendingSyncRef.current) {
              e.currentTarget.currentTime = pendingSyncRef.current.time;
              if (pendingSyncRef.current.isPlaying) safePlay();
              pendingSyncRef.current = null;
            } else {
              safePlay();
            }
        }}
        onError={(e) => {
            console.error("Lỗi thẻ audio:", e);
            setIsPlaying(false);
        }}
      />
    </MusicContext.Provider>
  );
};