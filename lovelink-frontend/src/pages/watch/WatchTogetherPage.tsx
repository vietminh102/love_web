import React, { useState, useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import apiClient from '../../services/apiClient';
import { useMusic } from '../../contexts/MusicContext';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const WatchTogetherPage = () => {
  const [viewMode, setViewMode] = useState<'youtube' | 'stream'>('youtube');

  // STATE YOUTUBE
  const [videoId, setVideoId] = useState('');
  const [startSeconds, setStartSeconds] = useState(0); 
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const ytPlayerRef = useRef<any>(null);
  const { pauseMusic } = useMusic();

  // STATE WEBRTC
  const [isHost, setIsHost] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Đang chờ phòng chiếu mở cửa... 💕');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const streamActiveRef = useRef(false); 
  const iceQueue = useRef<any[]>([]);

  // BỘ NHỚ PHỤ
  const currentVideoIdRef = useRef(videoId);
  const currentViewModeRef = useRef(viewMode);


  const isSyncingRef = useRef(false);
  const syncLockTimeoutRef = useRef<any>(null);

  const lockSync = (duration = 2000) => {
    isSyncingRef.current = true;
    if (syncLockTimeoutRef.current) clearTimeout(syncLockTimeoutRef.current);
    syncLockTimeoutRef.current = setTimeout(() => {
      isSyncingRef.current = false;
    }, duration); 
  };
  useEffect(() => {
    // Tắt Mini Player (Nhạc đôi)
    pauseMusic(); 
    // Tắt luôn Nhạc nền (nếu đang chạy)
    window.dispatchEvent(new Event('stop_background_music')); 
  }, []);

  useEffect(() => {
    currentVideoIdRef.current = videoId;
    currentViewModeRef.current = viewMode;
  }, [videoId, viewMode]);


  useEffect(() => {
    const syncTimeout = setTimeout(() => {
      broadcastSignal('request_sync');
    }, 1500);

    const handleRemoteSignaling = async (e: any) => {
      const { action, payload } = e.detail;

      // NGƯỜI KIA XIN ĐỒNG BỘ
      if (action === 'request_sync') {
        if (currentViewModeRef.current === 'youtube' && currentVideoIdRef.current && ytPlayerRef.current) {
          try {
            const currentTime = ytPlayerRef.current.getCurrentTime() || 0;
            const isPlaying = ytPlayerRef.current.getPlayerState() === 1;

            broadcastSignal('sync_full_state', {
              videoId: currentVideoIdRef.current,
              time: currentTime,
              isPlaying: isPlaying
            });
          } catch (err) {
            console.error("Lỗi khi đồng bộ trạng thái:", err);
          }
        }
      }

      // NHẬN ĐƯỢC TOÀN BỘ TRẠNG THÁI 
      else if (action === 'sync_full_state') {
        setViewMode('youtube');
        // Khóa lệnh 5s để tự do nạp phim mà không bắn bậy về máy Host
        lockSync(5000); 
        
        if (currentVideoIdRef.current !== payload.videoId) {
          setStartSeconds(Math.floor(payload.time)); // Tự động tua ngay từ trong bụng mẹ
          setVideoId(payload.videoId);
          setSearchResults([]);
        } else {
          if (ytPlayerRef.current) {
            ytPlayerRef.current.seekTo(payload.time, true);
            if (payload.isPlaying) ytPlayerRef.current.playVideo();
            else ytPlayerRef.current.pauseVideo();
          }
        }
      }
    
      // CHUYỂN CHẾ ĐỘ
      else if (action === 'switch_mode') {
        setViewMode(payload);
        if (payload === 'youtube' && streamActiveRef.current) {
            stopAllStreams();
        } else if (payload === 'stream' && ytPlayerRef.current) {
            ytPlayerRef.current.pauseVideo(); 
        }
      }

      // ĐỔI BÀI HÁT
      else if (action === 'change_url') {
        setViewMode('youtube');
        setStartSeconds(0); // Về 0s
        setVideoId(payload);
        setSearchResults([]);
        lockSync(5000);
      } 
      
      // NHẬN LỆNH PLAY
      else if (action === 'play') {
        if (ytPlayerRef.current && payload !== undefined) {
          lockSync(2000);
          if (Math.abs(ytPlayerRef.current.getCurrentTime() - payload) > 2) ytPlayerRef.current.seekTo(payload, true);
          ytPlayerRef.current.playVideo();
        }
      } 
      
      // NHẬN LỆNH PAUSE
      else if (action === 'pause') {
        if (ytPlayerRef.current && payload !== undefined) {
          lockSync(2000);
          ytPlayerRef.current.seekTo(payload, true);
          ytPlayerRef.current.pauseVideo();
        }
      }

      // XỬ LÝ WEBRTC (Giữ nguyên)
      else if (action === 'webrtc_offer') {
        setViewMode('stream'); 
        if (ytPlayerRef.current) ytPlayerRef.current.pauseVideo();
        setIsHost(false);
        setStreamActive(true);
        streamActiveRef.current = true;
        setStatusMessage("Đã kết nối! Đang tải phim từ người ấy... 🍿");

        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        broadcastSignal('webrtc_answer', answer);
        while (iceQueue.current.length > 0) {
          await pc.addIceCandidate(new RTCIceCandidate(iceQueue.current.shift()));
        }
      } 
      else if (action === 'webrtc_answer') {
        if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
      } 
      else if (action === 'webrtc_ice') {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(payload));
        else iceQueue.current.push(payload);
      } 
      else if (action === 'webrtc_stop') {
        stopAllStreams();
      }
    };

    window.addEventListener('sync_video_event', handleRemoteSignaling);
    return () => {
      clearTimeout(syncTimeout);
      window.removeEventListener('sync_video_event', handleRemoteSignaling);
    };
  }, []);

  const broadcastSignal = (action: string, payload: any = null) => {
    apiClient.post('/couple/video/sync', { action, payload }).catch(console.error);
  };


  //  YOUTUBE
 
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await apiClient.get(`/couple/video/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.data && response.data.items) setSearchResults(response.data.items);
    } catch (error) {
      console.error("Lỗi tìm kiếm:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const ytBroadcastAction = (action: string) => {

    if (isSyncingRef.current) return; 
    
    const payload = ytPlayerRef.current ? ytPlayerRef.current.getCurrentTime() : 0;
    broadcastSignal(action, payload);
  };


  // LOGIC WEBRTC
  const createPeerConnection = () => {
    if (pcRef.current) pcRef.current.close();
    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;
    
    pc.onicecandidate = (event) => { if (event.candidate) broadcastSignal('webrtc_ice', event.candidate); };
    pc.ontrack = (event) => {
      if (event.streams[0] && videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(e => console.log("Lưu ý: Bạn cần click vào web để phim có tiếng nhé!", e));
      }
    };
    return pc;
  };

  const startScreenShare = async () => {
    try {
      setStatusMessage("Đang khởi tạo màn hình chia sẻ...");
      let stream: MediaStream;
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser", frameRate: { ideal: 24, max: 30 } },
          audio: true 
        });
        setStatusMessage("Đang phát phim! Hãy mở web phim để cùng xem nhé... 🎬");
      } else {
        alert("Rất tiếc! Trình duyệt chặn tính năng chia sẻ màn hình trên Web.");
        setStatusMessage("Thiết bị chặn quyền chia sẻ màn hình.");
        return;
      }
      setIsHost(true); 
      setStreamActive(true); 
      streamActiveRef.current = true;
      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const pc = createPeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      broadcastSignal('webrtc_offer', offer);
      setStatusMessage("Đang phát phim! Hãy mở tab phim để cùng xem nhé... 🎬");

      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) {
      setStatusMessage("Bạn đã hủy chia sẻ màn hình.");
    }
  };

  const stopAllStreams = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => { track.stop(); });
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    
    setIsHost(false); setStreamActive(false); streamActiveRef.current = false;
    iceQueue.current = [];
    setStatusMessage('Phòng chiếu đã đóng cửa. 💕');
  };

  const stopScreenShare = () => { 
    broadcastSignal('webrtc_stop'); stopAllStreams(); 
  };

  useEffect(() => {
    return () => { stopAllStreams(); };
  }, []);


 
  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-6 pt-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-pink-600">Rạp Phim Tình Yêu 🍿</h1>
      </div>

      <div className="flex bg-pink-100 p-1 rounded-full shadow-inner">
        <button 
          onClick={() => { 
            setViewMode('youtube'); broadcastSignal('switch_mode', 'youtube'); 
          }}
          className={`px-6 py-2 rounded-full font-semibold transition-all ${viewMode === 'youtube' ? 'bg-pink-500 text-white shadow-md' : 'text-pink-600 hover:bg-pink-200'}`}
        >
          YouTube
        </button>
        <button 
          onClick={() => { 
            setViewMode('stream'); 
            if (ytPlayerRef.current) ytPlayerRef.current.pauseVideo();
            broadcastSignal('switch_mode', 'stream'); 
          }}
          className={`px-6 py-2 rounded-full font-semibold transition-all ${viewMode === 'stream' ? 'bg-pink-500 text-white shadow-md' : 'text-pink-600 hover:bg-pink-200'}`}
        >
          Share Phim
        </button>
      </div>
      
      {viewMode === 'youtube' && (
        <div className="w-full flex flex-col space-y-4 animate-fade-in">
          <div className="w-full relative">
            <div className="flex w-full gap-2">
              <input 
                type="text" placeholder="Bạn muốn xem phim hay nghe nhạc gì?..." 
                className="flex-1 px-4 py-3 border border-pink-200 rounded-2xl outline-none focus:border-pink-500 shadow-sm text-black"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} disabled={isSearching} className="px-6 py-2 bg-pink-500 text-white font-bold rounded-2xl hover:bg-pink-600 disabled:opacity-50">
                {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 left-0 w-full bg-white z-50 rounded-2xl shadow-2xl border border-pink-100 p-4 max-h-96 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-full flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="font-semibold text-gray-600">Kết quả tìm kiếm:</span>
                    <button onClick={() => setSearchResults([])} className="text-sm text-pink-500 hover:underline">Đóng</button>
                </div>
                {searchResults.map((video, idx) => (
                  <div key={`${video.videoId}-${idx}`} className="flex gap-3 items-start p-2 rounded-xl hover:bg-pink-50 cursor-pointer transition"
                    onClick={() => {
                      setStartSeconds(0); 
                      setVideoId(video.videoId); 
                      setSearchResults([]); 
                      broadcastSignal('change_url', video.videoId);
                    }}>
                    <img src={video.thumbnail} alt="thumbnail" className="w-32 aspect-video object-cover rounded-lg shadow-sm" />
                    <div className="flex-1 flex flex-col">
                      <span className="font-semibold text-sm line-clamp-2 text-gray-800">{video.title}</span>
                      <span className="text-xs text-gray-500 mt-1">{video.channel}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg border-2 border-pink-100 relative flex items-center justify-center">
            {videoId ? (
              <YouTube 
                videoId={videoId} 
                opts={{ 
                  height: '100%', 
                  width: '100%', 
                  playerVars: { 
                    autoplay: 1, 
                    start: startSeconds 
                  } 
                }} 
                className="absolute inset-0 w-full h-full"
                onPlay={() => ytBroadcastAction('play')} 
                onPause={() => ytBroadcastAction('pause')}
                onReady={(e) => { 
                  ytPlayerRef.current = e.target; 
                 
                }} 
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300 font-medium z-10 px-4 text-center">
                Gõ tên video ở trên để bắt đầu xem cùng nhau nhé! 💕
              </div>
            )}
          </div>
        </div>
      )}

      <div className={viewMode === 'stream' ? "w-full flex flex-col items-center space-y-4 animate-fade-in" : "hidden"}>
        <p className="text-xs text-gray-500">{statusMessage}</p>
        {!streamActive ? (
          <button onClick={startScreenShare} className="px-6 py-3 bg-pink-500 text-white font-bold rounded-full hover:bg-pink-600 shadow-md">
            📽️ Bắt đầu chia sẻ màn hình phát phim
          </button>
        ) : (
          isHost && (
            <button onClick={stopScreenShare} className="px-6 py-3 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 shadow-md">
              🛑 Dừng chia sẻ phim
            </button>
          )
        )}
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-pink-100 relative">
          <video ref={videoRef} autoPlay playsInline controls muted={isHost} className="w-full h-full object-contain" />
        </div>
      </div>
    </div>
  );
};

export default WatchTogetherPage;