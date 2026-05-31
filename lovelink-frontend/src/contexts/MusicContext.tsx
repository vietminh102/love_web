import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import apiClient from '../services/apiClient';
import ReactPlayer from 'react-player';

const MusicContext = createContext<any>(null);
export const useMusic = () => useContext(MusicContext);

export const MusicProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSong, setCurrentSong] = useState({ id: '', title: '', channel: '', thumbnail: '' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playlist, setPlaylist] = useState<any[]>([]);

  const Player: any = ReactPlayer; 
  const playerRef = useRef<any>(null); 
  const pendingSyncRef = useRef<{time: number, isPlaying: boolean} | null>(null);
  
  const currentSongIdRef = useRef(currentSong.id);
  const currentPlaylistRef = useRef(playlist);
  const isSyncingRef = useRef(false);
  const syncLockTimeoutRef = useRef<any>(null);
  const lastTimeRef = useRef(0);

  const setSongHD = (song: any) => {
    if (!song) return;
    const hdSong = {
      ...song,
      thumbnail: song.thumbnail ? song.thumbnail.replace(/-(mini|tiny|small|badge|large|crop)\.jpg/i, '-t500x500.jpg') : ''
    };
    setCurrentSong(hdSong);
  };

  const safeSeek = (time: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(time, 'seconds');
    }
  };

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

  useEffect(() => {
    const syncTimeout = setTimeout(() => { broadcastSignal('request_music_sync'); }, 1500);

    const handleRemoteSignaling = async (e: any) => {
      const { action, payload } = e.detail;
      
      if (action === 'request_music_sync') {
        if (currentSongIdRef.current && playerRef.current) {
          try {
            broadcastSignal('sync_music_state', { 
              song: currentSong, 
              time: progress,
              isPlaying: isPlaying, 
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
          setSongHD(payload.song); 
        } else {
          safeSeek(payload.time);
          setIsPlaying(payload.isPlaying);
        }
      }
      else if (action === 'change_song') {
        setSongHD(payload); 
        lockSync(5000);
      } 
      else if (action === 'play_next_song') {
        setSongHD(payload.nextSong); 
        setPlaylist(payload.remainingPlaylist);
        lockSync(5000);
      }
      else if (action === 'add_to_playlist') {
        setPlaylist(prev => [...prev, payload]);
      }
      else if (action === 'play_music') {
        lockSync();
        safeSeek(payload);
        setIsPlaying(true);
      } 
      else if (action === 'pause_music') {
        lockSync();
        safeSeek(payload);
        setIsPlaying(false);
      }
      else if (action === 'seek_music') {
        lockSync(1500);
        safeSeek(payload);
      }
    };

    window.addEventListener('sync_video_event', handleRemoteSignaling);
    return () => {
      clearTimeout(syncTimeout);
      window.removeEventListener('sync_video_event', handleRemoteSignaling);
    };
  }, [currentSong, isPlaying, progress]); 

  const playMusic = () => {
    if (!currentSong.id || isSyncingRef.current) return;
    window.dispatchEvent(new Event('stop_background_music'));
    setIsPlaying(true);
    broadcastSignal('play_music', progress);
  };

  const pauseMusic = () => {
    if (!currentSong.id || isSyncingRef.current) return;
    setIsPlaying(false);
    broadcastSignal('pause_music', progress);
  };

  const seekMusic = (newTime: number) => {
    if (!currentSong.id || isSyncingRef.current) return;
    
    // 🌟 KHÓA BẢO VỆ: Nếu nhạc chưa tải xong (0:00), TUYỆT ĐỐI không cho bấm tua để tránh kẹt lỗi!
    if (duration === 0) {
      console.warn("Chưa tải xong bài hát, không thể tua!");
      return; 
    }
    
    safeSeek(newTime);
    setProgress(newTime);
    lastTimeRef.current = newTime;
    broadcastSignal('seek_music', newTime);
  };

  const handleNextSong = () => {
    if (currentPlaylistRef.current.length > 0) {
      const nextSong = currentPlaylistRef.current[0];
      const remainingPlaylist = currentPlaylistRef.current.slice(1);
      setSongHD(nextSong); 
      setPlaylist(remainingPlaylist);
      broadcastSignal('play_next_song', { nextSong, remainingPlaylist });
    }
  };

  const addSongToPlaylist = (song: any) => {
    setPlaylist(prev => [...prev, song]);
    broadcastSignal('add_to_playlist', song);
  };

  const changeSongNow = (song: any) => {
    setSongHD(song); 
    broadcastSignal('change_song', song);
  };

  let finalPlayUrl = currentSong.id;
  if (finalPlayUrl && !finalPlayUrl.startsWith('http')) {
    finalPlayUrl = `https://www.youtube.com/watch?v=${finalPlayUrl}`;
  }

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
              // 🌟 Khóa bảo vệ thanh tua
              if (duration === 0) return; 
              
              const bounds = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - bounds.left) / bounds.width;
              seekMusic(percent * duration);
          }}>
             <div className="h-full bg-linear-to-r from-pink-400 to-rose-500 transition-all ease-linear" style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }} />
          </div>
          
          <div className="flex items-center justify-between px-4 py-2 sm:px-6 sm:py-3 max-w-7xl mx-auto w-full gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              
              {/* 🌟 THAY ĐỔI CẤU TRÚC ẢNH ĐĨA CD: GIẤU TRÌNH PHÁT VÀO SAU BỨC ẢNH NÀY */}
              <div className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border-2 border-pink-100 shadow-sm ${isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
                
                {/* Trình phát (Iframe) nằm lớp dưới cùng (z-0), hiện 100% rõ ràng */}
                <div className="absolute inset-0 w-full h-full z-0">
                  <Player
                    ref={playerRef}
                    url={finalPlayUrl} 
                    playing={isPlaying}
                    volume={1}           
                    width="100%"
                    height="100%"
                    onReady={() => {
                      if (pendingSyncRef.current) {
                        safeSeek(pendingSyncRef.current.time);
                        setIsPlaying(pendingSyncRef.current.isPlaying);
                        pendingSyncRef.current = null;
                      } else {
                        setIsPlaying(true);
                      }
                    }}
                    onDuration={(d: number) => setDuration(d)}
                    onProgress={(state: any) => {
                      if (Math.abs(state.playedSeconds - lastTimeRef.current) >= 1) {
                        setProgress(state.playedSeconds);
                        lastTimeRef.current = state.playedSeconds;
                      }
                    }}
                    onEnded={handleNextSong}
                    onError={(e: any) => {
                      console.error("Lỗi phát nhạc SoundCloud:", e);
                      setIsPlaying(false);
                    }}
                  />
                </div>
                
                {/* Ảnh bìa nằm đè lên trên cùng (z-10) để che giấu trình phát */}
                <img src={currentSong.thumbnail} alt="cover" className="absolute inset-0 w-full h-full object-cover z-10 bg-white" />
              </div>
              
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm sm:text-base text-gray-800 truncate">{currentSong.title}</span>
                <span className="text-xs text-pink-500 truncate">{currentSong.channel}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <button 
                onClick={isPlaying ? pauseMusic : playMusic} 
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-linear-to-br from-pink-500 to-rose-500 rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all"
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
    </MusicContext.Provider>
  );
};