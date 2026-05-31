import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
// 🌟 Thêm icon X để làm nút tắt
import { Play, Pause, SkipForward, Loader2, X } from 'lucide-react';
import apiClient from '../services/apiClient';

const MusicContext = createContext<any>(null);
export const useMusic = () => useContext(MusicContext);

export const MusicProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState({ id: '', title: '', channel: '', thumbnail: '' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playlist, setPlaylist] = useState<any[]>([]);
  
  const [audioSrc, setAudioSrc] = useState('');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null); 
  const pendingSyncRef = useRef<{time: number, isPlaying: boolean} | null>(null);
  
  const currentSongRef = useRef(currentSong);
  const isPlayingRef = useRef(isPlaying);
  const progressRef = useRef(progress);
  const playlistRef = useRef(playlist);
  const isSyncingRef = useRef(false);
  const lastTimeRef = useRef(0);

  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  const setSongHD = (song: any) => {
    if (!song) return;
    const hdSong = {
      ...song,
      thumbnail: song.thumbnail ? song.thumbnail.replace(/-(mini|tiny|small|badge|large|crop)\.jpg/i, '-t500x500.jpg') : ''
    };
    setCurrentSong(hdSong);
  };

  useEffect(() => {
    if (currentSong.id) {
      setIsLoadingAudio(true);
      setAudioSrc(''); 
      setAutoplayBlocked(false);

      let targetUrl = currentSong.id;
      if (!targetUrl.startsWith('http')) targetUrl = `https://www.youtube.com/watch?v=${targetUrl}`;

      apiClient.get(`/couple/music/stream-url?url=${encodeURIComponent(targetUrl)}`)
        .then(res => {
          if (res.data && res.data.stream_url) {
            setAudioSrc(res.data.stream_url); 
          }
        })
        .catch(err => console.error("Lỗi lấy audio:", err))
        .finally(() => setIsLoadingAudio(false));
    } else {
      setAudioSrc('');
    }
  }, [currentSong.id]);

  const safeSeek = (time: number) => {
    if (audioRef.current && isFinite(time)) {
      if (audioRef.current.readyState >= 1) {
        audioRef.current.currentTime = time;
        setProgress(time);
        lastTimeRef.current = time;
      } else {
        pendingSyncRef.current = { time: time, isPlaying: isPlayingRef.current };
      }
    }
  };

  const safePlay = async () => {
    if (audioRef.current) {
      try { 
        await audioRef.current.play(); 
        setIsPlaying(true); 
        setAutoplayBlocked(false); 
      } catch (error) { 
        console.warn("Trình duyệt cấm Autoplay, đợi user tương tác!"); 
        setIsPlaying(false); 
        setAutoplayBlocked(true); 
      }
    }
  };

  const broadcastSignal = (action: string, payload: any = null) => {
    if (isSyncingRef.current) return;
    apiClient.post('/couple/video/sync', { action, payload }).catch(console.error);
  };

  useEffect(() => {
    setTimeout(() => {
        apiClient.post('/couple/video/sync', { action: 'request_music_sync', payload: null }).catch(console.error);
    }, 1500);

    const handleRemoteSignaling = async (e: any) => {
      const { action, payload } = e.detail;
      
      if (action === 'request_music_sync') {
        if (currentSongRef.current.id && isPlayingRef.current) {
          apiClient.post('/couple/video/sync', { 
            action: 'sync_music_state', 
            payload: { song: currentSongRef.current, time: progressRef.current, isPlaying: isPlayingRef.current, playlist: playlistRef.current } 
          }).catch(console.error);
        }
      }
      else if (action === 'sync_music_state') {
        isSyncingRef.current = true; 
        setPlaylist(payload.playlist || []);
        
        if (currentSongRef.current.id !== payload.song.id) {
          pendingSyncRef.current = { time: payload.time, isPlaying: payload.isPlaying };
          setSongHD(payload.song); 
        } else {
          safeSeek(payload.time);
          if (payload.isPlaying) safePlay(); else { audioRef.current?.pause(); setIsPlaying(false); }
        }
        setTimeout(() => { isSyncingRef.current = false; }, 1000); 
      }
      else if (action === 'change_song') {
        isSyncingRef.current = true; setSongHD(payload); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      } 
      else if (action === 'play_next_song') {
        isSyncingRef.current = true; setSongHD(payload.nextSong); setPlaylist(payload.remainingPlaylist); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (action === 'add_to_playlist') {
        setPlaylist(prev => [...prev, payload]);
      }
      else if (action === 'play_music') {
        isSyncingRef.current = true; safeSeek(payload); safePlay(); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      } 
      else if (action === 'pause_music') {
        isSyncingRef.current = true; safeSeek(payload); audioRef.current?.pause(); setIsPlaying(false); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (action === 'seek_music') {
        isSyncingRef.current = true; safeSeek(payload); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (action === 'stop_music') {
        // Lệnh từ partner yêu cầu tắt hẳn nhạc
        isSyncingRef.current = true; 
        audioRef.current?.pause();
        setCurrentSong({ id: '', title: '', channel: '', thumbnail: '' });
        setAudioSrc('');
        setPlaylist([]);
        setIsPlaying(false);
        setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
    };

    window.addEventListener('sync_video_event', handleRemoteSignaling);
    return () => window.removeEventListener('sync_video_event', handleRemoteSignaling);
  }, []); 

  useEffect(() => {
    if (audioSrc && audioRef.current) {
      if (!pendingSyncRef.current) {
        safePlay(); 
      }
    }
  }, [audioSrc]);

  const playMusic = () => {
    if (!audioSrc) return;
    window.dispatchEvent(new Event('stop_background_music'));
    
    if (autoplayBlocked) {
      safePlay();
    } else {
      safePlay();
      broadcastSignal('play_music', audioRef.current?.currentTime || 0);
    }
  };

  const pauseMusic = () => {
    if (!audioSrc) return;
    audioRef.current?.pause();
    setIsPlaying(false);
    broadcastSignal('pause_music', audioRef.current?.currentTime || 0);
  };

  const seekMusic = (newTime: number) => {
    if (!audioSrc || duration === 0) return;
    safeSeek(newTime);
    broadcastSignal('seek_music', newTime);
  };

  const handleNextSong = () => {
    if (playlist.length > 0) {
      const nextSong = playlist[0];
      const remainingPlaylist = playlist.slice(1);
      setSongHD(nextSong); 
      setPlaylist(remainingPlaylist);
      broadcastSignal('play_next_song', { nextSong, remainingPlaylist });
    }
  };

  // 🌟 HÀM TẮT TRẠM PHÁT NHẠC
  const closePlayer = () => {
    // Tạm dừng và gửi lệnh tắt sang cho Partner
    audioRef.current?.pause();
    broadcastSignal('stop_music', null);
    
    // Dọn dẹp sạch sẽ giao diện local
    setCurrentSong({ id: '', title: '', channel: '', thumbnail: '' });
    setAudioSrc('');
    setPlaylist([]);
    setIsPlaying(false);
  };

  return (
    <MusicContext.Provider value={{ 
      currentSong, isPlaying, progress, duration, playlist,
      playMusic, pauseMusic, seekMusic, handleNextSong, closePlayer,
      addSongToPlaylist: (song: any) => { setPlaylist(prev => [...prev, song]); broadcastSignal('add_to_playlist', song); }, 
      changeSongNow: (song: any) => { setSongHD(song); broadcastSignal('change_song', song); }
    }}>
      
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto" 
          autoPlay={isPlaying} // 🌟 VŨ KHÍ TRỊ MOBILE: Ép điện thoại hiểu là đang trong luồng phát tự động
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
          }}
          onCanPlay={(e) => {
            if (pendingSyncRef.current) {
              e.currentTarget.currentTime = pendingSyncRef.current.time;
              setProgress(pendingSyncRef.current.time);
              lastTimeRef.current = pendingSyncRef.current.time;
              if (pendingSyncRef.current.isPlaying) safePlay();
              pendingSyncRef.current = null;
            } else if (isPlayingRef.current) {
              // Ép phát bù cho mobile nếu bị khựng
              safePlay();
            }
          }}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            if (Math.abs(time - lastTimeRef.current) >= 1) {
              setProgress(time);
              lastTimeRef.current = time;
            }
          }}
          onEnded={handleNextSong}
        />
      )}

      <div className={currentSong.id ? "pb-24" : ""}> 
        {children}
      </div>

      {currentSong.id && (
        <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-pink-100 shadow-[0_-10px_30px_rgba(255,192,203,0.3)] z-50 flex flex-col animate-in slide-in-from-bottom-10">
          
          {autoplayBlocked && (
            <div className="absolute -top-10 right-4 bg-pink-500 text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg font-medium animate-bounce flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
               </span>
               Nhấn Play để đồng bộ
               <div className="absolute -bottom-1.5 right-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-pink-500"></div>
            </div>
          )}

          <div className="w-full h-1 bg-gray-100 cursor-pointer" onClick={(e) => {
              if (duration === 0 || isLoadingAudio) return; 
              const bounds = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - bounds.left) / bounds.width;
              seekMusic(percent * duration);
          }}>
             <div className="h-full bg-linear-to-r from-pink-400 to-rose-500 transition-all ease-linear" style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }} />
          </div>
          
          <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 max-w-7xl mx-auto w-full gap-2 sm:gap-4 relative">
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
              
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border-2 border-pink-100 shadow-sm ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
                <img src={currentSong.thumbnail} alt="cover" className="w-full h-full object-cover bg-white" />
              </div>
              
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm sm:text-base text-gray-800 truncate pr-2">{currentSong.title}</span>
                <span className="text-xs text-pink-500 truncate">{isLoadingAudio ? 'Đang chuẩn bị nhạc...' : currentSong.channel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <button 
                onClick={isPlaying ? pauseMusic : playMusic} 
                disabled={isLoadingAudio} 
                className={`w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center rounded-full text-white shadow-md transition-all ${isLoadingAudio ? 'bg-gray-300' : 'bg-linear-to-br from-pink-500 to-rose-500 hover:scale-105 active:scale-95'} ${autoplayBlocked ? 'ring-4 ring-pink-300 animate-pulse' : ''}`}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-1" />
                )}
              </button>
              
              <button 
                onClick={handleNextSong} disabled={playlist.length === 0}
                className={`p-1.5 sm:p-2 transition-all ${playlist.length > 0 ? 'text-pink-500 hover:text-pink-700 hover:bg-pink-50 rounded-full' : 'text-gray-300'}`}
              >
                <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              </button>

              {/* 🌟 NÚT TẮT X CỰC KỲ TINH TẾ */}
              <div className="w-[1px] h-6 bg-gray-200 mx-1 sm:mx-2 hidden sm:block"></div>
              <button 
                onClick={closePlayer} 
                className="p-1.5 sm:p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-full ml-1"
                title="Đóng Trạm Phát Nhạc"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </MusicContext.Provider>
  );
};