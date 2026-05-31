import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, Loader2 } from 'lucide-react';
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

  const audioRef = useRef<HTMLAudioElement>(null); 
  const pendingSyncRef = useRef<{time: number, isPlaying: boolean} | null>(null);
  
  // 🌟 KHU VỰC REFS: Tránh lỗi re-render vòng lặp vô tận
  const currentSongRef = useRef(currentSong);
  const isPlayingRef = useRef(isPlaying);
  const progressRef = useRef(progress);
  const playlistRef = useRef(playlist);
  const isSyncingRef = useRef(false);

  // Cập nhật Refs liên tục để EventListener luôn đọc được data mới nhất mà không bị lỗi
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

  // 🌟 ĐI LẤY LINK MP3 TỪ BACKEND KHI ĐỔI BÀI
  useEffect(() => {
    if (currentSong.id) {
      setIsLoadingAudio(true);
      setAudioSrc(''); 
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
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const safePlay = async () => {
    if (audioRef.current) {
      try { 
        await audioRef.current.play(); 
        setIsPlaying(true); 
      } catch (error) { 
        // 🌟 BẮT LỖI TRÌNH DUYỆT CẤM AUTOPLAY (Dành cho người vào sau)
        console.warn("Trình duyệt yêu cầu bạn click vào màn hình để phát nhạc!"); 
        setIsPlaying(false); 
      }
    }
  };

  const broadcastSignal = (action: string, payload: any = null) => {
    // Nếu đang bị người khác điều khiển (isSyncingRef = true) thì TUYỆT ĐỐI KHÔNG gửi ngược lại
    if (isSyncingRef.current) return;
    apiClient.post('/couple/video/sync', { action, payload }).catch(console.error);
  };

  // 🌟 TỔNG ĐÀI ĐỒNG BỘ: CHỈ CHẠY 1 LẦN DUY NHẤT LÚC MỞ WEB
  useEffect(() => {
    // Người mới vào phòng: Lập tức hô to hỏi xem có ai đang nghe nhạc không
    setTimeout(() => {
        apiClient.post('/couple/video/sync', { action: 'request_music_sync', payload: null }).catch(console.error);
    }, 1500);

    const handleRemoteSignaling = async (e: any) => {
      const { action, payload } = e.detail;
      
      // 1. NGƯỜI CŨ NHẬN ĐƯỢC LỜI HỎI THĂM TỪ NGƯỜI MỚI
      if (action === 'request_music_sync') {
        if (currentSongRef.current.id && isPlayingRef.current) {
          apiClient.post('/couple/video/sync', { 
            action: 'sync_music_state', 
            payload: { song: currentSongRef.current, time: progressRef.current, isPlaying: isPlayingRef.current, playlist: playlistRef.current } 
          }).catch(console.error);
        }
      }
      
      // 2. NGƯỜI MỚI NHẬN ĐƯỢC CÂU TRẢ LỜI ĐỂ CẬP NHẬT GIAO DIỆN
      else if (action === 'sync_music_state') {
        isSyncingRef.current = true; // Bật khóa cấm phản dame
        setPlaylist(payload.playlist || []);
        
        if (currentSongRef.current.id !== payload.song.id) {
          pendingSyncRef.current = { time: payload.time, isPlaying: payload.isPlaying };
          setSongHD(payload.song); 
        } else {
          safeSeek(payload.time);
          if (payload.isPlaying) safePlay(); else { audioRef.current?.pause(); setIsPlaying(false); }
        }
        setTimeout(() => { isSyncingRef.current = false; }, 1000); // Tắt khóa
      }
      
      // 3. ĐỒNG BỘ ĐỔI BÀI HÁT
      else if (action === 'change_song') {
        isSyncingRef.current = true; setSongHD(payload); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      } 
      else if (action === 'play_next_song') {
        isSyncingRef.current = true; setSongHD(payload.nextSong); setPlaylist(payload.remainingPlaylist); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (action === 'add_to_playlist') {
        setPlaylist(prev => [...prev, payload]);
      }
      
      // 4. ĐỒNG BỘ PLAY / PAUSE / TUA NHẠC
      else if (action === 'play_music') {
        isSyncingRef.current = true; safeSeek(payload); safePlay(); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      } 
      else if (action === 'pause_music') {
        isSyncingRef.current = true; safeSeek(payload); audioRef.current?.pause(); setIsPlaying(false); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (action === 'seek_music') {
        isSyncingRef.current = true; safeSeek(payload); setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
    };

    window.addEventListener('sync_video_event', handleRemoteSignaling);
    return () => window.removeEventListener('sync_video_event', handleRemoteSignaling);
  }, []); 

  // KHI ĐÃ CÓ LINK MP3
  useEffect(() => {
    if (audioSrc && audioRef.current) {
      if (pendingSyncRef.current) {
        safeSeek(pendingSyncRef.current.time);
        if (pendingSyncRef.current.isPlaying) safePlay();
        pendingSyncRef.current = null;
      } else {
        safePlay(); 
      }
    }
  }, [audioSrc]);

  // HÀM NGƯỜI DÙNG BẤM
  const playMusic = () => {
    if (!audioSrc) return;
    window.dispatchEvent(new Event('stop_background_music'));
    safePlay();
    broadcastSignal('play_music', audioRef.current?.currentTime || 0);
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

  return (
    <MusicContext.Provider value={{ 
      currentSong, isPlaying, progress, duration, playlist,
      playMusic, pauseMusic, seekMusic, handleNextSong, 
      addSongToPlaylist: (song: any) => { setPlaylist(prev => [...prev, song]); broadcastSignal('add_to_playlist', song); }, 
      changeSongNow: (song: any) => { setSongHD(song); broadcastSignal('change_song', song); }
    }}>
      
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            // Không bao giờ được phép gửi broadcast tự động trong hàm này!
            setProgress(e.currentTarget.currentTime);
          }}
          onEnded={handleNextSong}
        />
      )}

      <div className={currentSong.id ? "pb-24" : ""}> 
        {children}
      </div>

      {currentSong.id && (
        <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-pink-100 shadow-[0_-10px_30px_rgba(255,192,203,0.3)] z-50 flex flex-col animate-in slide-in-from-bottom-10">
          
          <div className="w-full h-1 bg-gray-100 cursor-pointer" onClick={(e) => {
              if (duration === 0 || isLoadingAudio) return; 
              const bounds = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - bounds.left) / bounds.width;
              seekMusic(percent * duration);
          }}>
             <div className="h-full bg-linear-to-r from-pink-400 to-rose-500 transition-all ease-linear" style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }} />
          </div>
          
          <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-3 max-w-7xl mx-auto w-full gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border-2 border-pink-100 shadow-sm ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
                <img src={currentSong.thumbnail} alt="cover" className="w-full h-full object-cover bg-white" />
              </div>
              
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm sm:text-base text-gray-800 truncate">{currentSong.title}</span>
                <span className="text-xs text-pink-500 truncate">{isLoadingAudio ? 'Đang chuẩn bị nhạc...' : currentSong.channel}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <button 
                onClick={isPlaying ? pauseMusic : playMusic} 
                disabled={isLoadingAudio} 
                className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full text-white shadow-md transition-all ${isLoadingAudio ? 'bg-gray-300' : 'bg-linear-to-br from-pink-500 to-rose-500 hover:scale-105 active:scale-95'}`}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-1" />
                )}
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
    </MusicContext.Provider>
  );
};