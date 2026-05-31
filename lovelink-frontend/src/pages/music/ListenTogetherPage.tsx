import React, { useState } from 'react';
import { Search, Play, Pause, Music, Disc3, SkipForward } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useMusic } from '../../contexts/MusicContext'; // Đường dẫn import context

const ListenTogetherPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 🌟 MƯỢN TOÀN BỘ SỨC MẠNH TỪ MUSIC CONTEXT
  const { 
    currentSong, isPlaying, progress, duration, playlist,
    playMusic, pauseMusic, seekMusic, handleNextSong, addSongToPlaylist, changeSongNow 
  } = useMusic();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await apiClient.get(`/couple/video/search/soundcloud?q=${encodeURIComponent(searchQuery + ' audio')}`);
      if (response.data && response.data.items) setSearchResults(response.data.items);
    } catch (error) {
      console.error("Lỗi tìm kiếm:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const highResThumbnail = currentSong.thumbnail 
    ? currentSong.thumbnail.replace(/-(mini|tiny|small|badge|large|crop)\.jpg/i, '-t500x500.jpg') 
    : currentSong.thumbnail;

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-4 space-y-8 pt-24 min-h-screen">
      {/* Tiêu đề */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-rose-400 flex items-center justify-center gap-2">
          <Music className="w-8 h-8 text-pink-500" /> Trạm Phát Tình Yêu
        </h1>
        <p className="text-sm text-gray-500 font-medium">Giai điệu đồng bộ mọi nơi 💕</p>
      </div>

      {/* Thanh Tìm kiếm */}
      <div className="w-full relative z-20">
        <div className="flex bg-white rounded-full p-1.5 shadow-md border border-pink-100">
          <input 
            type="text" placeholder="Tìm bài hát, giai điệu..." 
            className="flex-1 px-4 py-2 bg-transparent outline-none text-gray-700 font-medium"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={isSearching} className="w-12 h-12 flex items-center justify-center bg-linear-to-r from-pink-400 to-rose-500 text-white rounded-full hover:scale-105 transition-transform">
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Kết quả tìm kiếm */}
        {searchResults.length > 0 && (
          <div className="absolute top-full mt-3 left-0 w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-pink-100 p-3 max-h-80 overflow-y-auto">
            <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-gray-100">
                <span className="font-bold text-xs text-gray-400 uppercase">Kết quả</span>
                <button onClick={() => setSearchResults([])} className="text-xs text-pink-500 font-bold hover:underline">Đóng</button>
            </div>
            
            {searchResults.map((song: any, idx: number) => {
              // 🌟 BƯỚC VÁ LỖI TẠI ĐÂY: Đổi "videoId" thành "id" để truyền vào MusicContext
              const formattedSong = {
                id: song.videoId,
                title: song.title,
                channel: song.channel,
                thumbnail: song.thumbnail
              };

              return (
                <div key={idx} className="flex gap-3 items-center p-2 rounded-xl hover:bg-pink-50 transition-colors">
                  <img 
                    src={formattedSong.thumbnail} alt="thumbnail" 
                    className="w-12 h-12 object-cover rounded-lg shadow-sm cursor-pointer" 
                    onClick={() => { changeSongNow(formattedSong); setSearchResults([]); }}
                  />
                  <div className="flex-1 flex flex-col min-w-0 cursor-pointer" onClick={() => { changeSongNow(formattedSong); setSearchResults([]); }}>
                    <span className="font-bold text-sm text-gray-800 truncate">{formattedSong.title}</span>
                    <span className="text-xs text-gray-500 truncate">{formattedSong.channel}</span>
                  </div>
                  <button onClick={() => { addSongToPlaylist(formattedSong); setSearchResults([]); }}
                    className="w-8 h-8 flex items-center justify-center bg-pink-100 text-pink-600 rounded-full hover:bg-pink-500 hover:text-white transition-colors" title="Thêm vào danh sách">
                    <span className="text-xl font-bold mb-1">+</span>
                  </button>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* Trình Phát Nhạc Khổng Lồ (Đĩa than) */}
      <div className="w-full bg-white p-8 rounded-[2.5rem] shadow-2xl border-2 border-pink-50/50 flex flex-col items-center relative overflow-hidden">
        {currentSong.thumbnail && <div className="absolute inset-0 opacity-10 bg-cover bg-center blur-2xl transition-all duration-1000" style={{ backgroundImage: `url(${currentSong.thumbnail})` }}/>}
        
        <div className={`relative w-48 h-48 mb-8 rounded-full shadow-2xl border-4 border-white overflow-hidden transition-all duration-700 ${isPlaying ? 'animate-[spin_8s_linear_infinite] scale-105' : 'scale-100'}`}>
          {currentSong.thumbnail ? <img src={highResThumbnail} alt="cover" className="w-full h-full object-cover scale-150" />
          : <div className="w-full h-full bg-pink-100 flex items-center justify-center"><Disc3 className="w-20 h-20 text-pink-300" /></div>}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-inner border border-gray-100"></div>
        </div>

        <div className="text-center w-full mb-6 z-10">
          <h2 className="text-xl font-bold text-gray-800 truncate px-2">{currentSong.title || 'Chưa chọn bài hát'}</h2>
          <p className="text-sm text-pink-500 font-medium truncate mt-1">{currentSong.channel || 'Hãy tìm một giai điệu nhé'}</p>
        </div>

        <div className="w-full z-10 mb-6">
          <input type="range" min={0} max={duration || 100} value={progress} disabled={!currentSong.id}
            onChange={(e) => seekMusic(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-pink-500 disabled:opacity-50"
          />
          <div className="flex justify-between items-center mt-2 text-[11px] font-bold text-gray-400">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 z-10">
          <button onClick={isPlaying ? pauseMusic : playMusic} className={`w-16 h-16 flex items-center justify-center rounded-full shadow-xl transition-all ${currentSong.id ? 'bg-linear-to-br from-pink-500 to-rose-500 hover:scale-110 active:scale-95 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
          </button>
          <button onClick={handleNextSong} disabled={playlist.length === 0} className={`p-3 transition-all ${playlist.length > 0 ? 'text-pink-500 hover:text-pink-700 hover:bg-pink-50 rounded-full active:scale-95' : 'text-gray-300 cursor-not-allowed'}`}>
            <SkipForward className="w-6 h-6 fill-current" />
          </button>
        </div>
      </div>

      {/* DANH SÁCH CHỜ (PLAYLIST) */}
      {playlist.length > 0 && (
        <div className="w-full bg-white/80 backdrop-blur-md p-5 rounded-3xl shadow-lg border border-pink-50 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Music className="w-4 h-4 text-pink-500" /> Tiếp theo sẽ phát ({playlist.length})
          </h3>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {playlist.map((song: any, index: number) => (
              <div key={index} className="flex gap-3 items-center group relative p-1">
                <span className="text-xs font-bold text-gray-300 w-4 text-center">{index + 1}</span>
                <img src={song.thumbnail} alt="thumb" className="w-10 h-10 object-cover rounded-md opacity-80" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-700 truncate">{song.title}</p>
                  <p className="text-xs text-gray-400 truncate">{song.channel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListenTogetherPage;