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
  
  // 🌟 BỘ NHỚ ĐỆM CHỐNG LAG GIAO DIỆN (Trị bệnh rớt click)
  const lastTimeRef = useRef(0);

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

  // 🌟 1. TUYỆT CHIÊU LẤY NHẠC TRỰC TIẾP TỪ FRONTEND (Bypass 100% Cloudflare/Google)
  useEffect(() => {
    const fetchAudioUrl = async () => {
      if (!currentSong.id) return;
      setIsLoadingAudio(true);
      setAudioUrl(''); 
      setIsPlaying(false);

      try {
        // Mạng lưới các máy chủ dự phòng toàn cầu
        const instances = [
          "https://pipedapi.kavin.rocks",
          "https://pipedapi.tokhmi.xyz",
          "https://pipedapi.syncpundit.io",
          "https://pipedapi.smnz.de",
          "https://vid.puffyan.us/api/v1/videos/" // Invidious API
        ];

        let finalUrl = '';

        for (const base of instances) {
           try {
              if (base.includes('puffyan')) {
                 const res = await fetch(`${base}${currentSong.id}`);
                 if (res.ok) {
                    const data = await res.json();
                    const formats = data.adaptiveFormats || [];
                    const audioFormat = formats.find((f: any) => f.type.includes('audio/mp4')) || formats.find((f: any) => f.type.includes('audio'));
                    if (audioFormat && audioFormat.url) {
                       finalUrl = audioFormat.url;
                       console.log("✅ Lấy nhạc thành công từ Invidious!");
                       break;
                    }
                 }
              } else {
                 const res = await fetch(`${base}/streams/${currentSong.id}`);
                 if (res.ok) {
                    const data = await res.json();
                    const audioStreams = data.audioStreams || [];
                    const bestStream = audioStreams.find((s: any) => s.format === 'M4A') || audioStreams[0];
                    if (bestStream && bestStream.url) {
                       finalUrl = bestStream.url;
                       console.log(`✅ Lấy nhạc thành công từ ${base}!`);
                       break;
                    }
                 }
              }
           } catch (err) {
              console.warn(`⚠️ Máy chủ ${base} bận, nhảy sang máy tiếp theo...`);
           }
        }

        if (finalUrl) {
           setAudioUrl(finalUrl);
           setTimeout(() => setIsLoadingAudio(false), 800); 
        } else {
           console.error("❌ Tất cả máy chủ đều từ chối. Bài hát có thể bị giới hạn.");
           setIsLoadingAudio(false);
        }

      } catch (error) {
        console.error("Lỗi lấy âm thanh gốc:", error);
        setIsLoadingAudio(false);
      }
    };

    fetchAudioUrl();
  }, [currentSong.id]);

  // 🌟 2. TỔNG ĐÀI ĐỒNG BỘ
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
      setIsPlaying(false);
    }
  };

  const playMusic = async () => {
    if (!audioRef.current || !currentSong.id || isSyncingRef.current || !audioUrl) return;
    try {
      // Ép tắt nhạc nền khi bắt đầu phát bài hát
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
    
    // Đồng bộ cả biến nhớ đệm khi tua nhạc
    lastTimeRef.current = newTime;
    
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
             <div className="h-full bg-linear-to-r from-pink-400 to-rose-500 transition-all ease-linear" style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }} />
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
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-linear-to-br from-pink-500 to-rose-500 rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
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

      {/* 🌟 4. NATIVE AUDIO (Đã tối ưu cực nhẹ) */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        autoPlay
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleNextSong}
        
        // 🌟 BÍ KÍP CHỐNG RỚT CLICK: Chỉ cập nhật giao diện 1 giây/lần
        onTimeUpdate={(e) => {
            const currentTime = e.currentTarget.currentTime;
            if (Math.abs(currentTime - lastTimeRef.current) >= 1) {
                setProgress(currentTime);
                lastTimeRef.current = currentTime;
            }
        }}
        
        onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
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