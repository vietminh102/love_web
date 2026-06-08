import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Heart, Mic, Square } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'partner';
  timestamp: number;
}

export const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedMsgIds = useRef<Set<string>>(new Set());
  
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // 1. CHẠY DUY NHẤT LÚC MỚI VÀO TRANG (F5)
  useEffect(() => {
    apiClient.get('/couple/chat/unread-count')
      .then(res => {
        if (res.data && res.data.unread_count !== undefined) {
          setUnreadCount(res.data.unread_count);
        }
      })
      .catch(err => console.error("Lỗi lấy thông báo đỏ:", err));
  }, []);

  // 2. XỬ LÝ KHI NHẬN ĐƯỢC TIN NHẮN WEBSOCKET TỪ NGƯỜI ẤY
  useEffect(() => {
    const handleRemoteSignaling = (e: any) => {
      const { action, payload } = e.detail;
      
      if (action === 'chat_message' && payload.text && payload.id) {
        if (processedMsgIds.current.has(payload.id)) return;
        processedMsgIds.current.add(payload.id);

        setMessages(prev => [...prev, {
          id: payload.id,
          text: payload.text,
          sender: 'partner',
          timestamp: payload.timestamp || Date.now()
        }]);
        
        if (!isOpenRef.current) {
          // Nếu hộp chat đang đóng -> Tăng số đếm
          setUnreadCount(prev => prev + 1);
        } else {
          // Nếu hộp chat đang mở -> Cập nhật mốc "Đã đọc" lên DB ngay lập tức
          apiClient.post('/couple/chat/mark-read').catch(console.error);
        }
      }
    };
    window.addEventListener('sync_video_event', handleRemoteSignaling);
    return () => window.removeEventListener('sync_video_event', handleRemoteSignaling);
  }, []);

  // 3. TẢI LỊCH SỬ KHI MỞ HỘP CHAT
  useEffect(() => {
    if (isOpen) {
      apiClient.get('/couple/chat/history')
        .then(res => {
          if (res.data && res.data.messages) {
            setMessages(res.data.messages);
            processedMsgIds.current = new Set(res.data.messages.map((m: any) => m.id));
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
          }
        }).catch(err => console.error("Lỗi tải lịch sử chat:", err));
    }
  }, [isOpen]);

  // Cuộn xuống khi có tin mới
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // HÀM ĐÓNG / MỞ ĐƯỢC BỌC THÉP
  const toggleChat = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // Dù mở hay đóng, luôn chốt mốc thời gian "Đã đọc" mới nhất lên Server
    apiClient.post('/couple/chat/mark-read').catch(console.error);

    if (newIsOpen) {
      setUnreadCount(0); // Tắt đèn đỏ ngay lập tức
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const sendCoreMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const currentTimestamp = Date.now();
    const newMsg: Message = {
      id: currentTimestamp.toString() + Math.random().toString(36).substring(2, 9),
      text: textToSend,
      sender: 'me',
      timestamp: currentTimestamp
    };

    processedMsgIds.current.add(newMsg.id);
    setMessages(prev => [...prev, newMsg]);
    
    apiClient.post('/couple/chat/mark-read').catch(console.error);
    apiClient.post('/couple/chat/send', {
      id: newMsg.id,
      text: newMsg.text,
      timestamp: currentTimestamp
    }).catch(console.error);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendCoreMessage(inputText.trim());
    setInputText('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          sendCoreMessage(`[VOICE]${base64Audio}`);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      alert("Hãy cấp quyền sử dụng Microphone để gửi tin nhắn thoại nhé!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRecordDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed bottom-24 left-4 sm:bottom-6 sm:left-6 z-100 flex flex-col items-start">
      {isOpen && (
        <div className="bg-white/95 backdrop-blur-xl w-[90vw] sm:w-87.5 h-112.5 rounded-2xl shadow-[0_10px_40px_rgba(255,192,203,0.4)] border border-pink-100 flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          
          <div className="bg-linear-to-r from-pink-500 to-rose-400 p-3 sm:p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-xs">
                <Heart className="w-4 h-4 fill-white animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Trạm Gửi Lời Yêu</h3>
                <p className="text-[10px] text-pink-100 opacity-90">Hỗ trợ tin nhắn thoại 🎙️</p>
              </div>
            </div>
            <button onClick={toggleChat} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#fffafa]">
            {messages.length === 0 ? (
              <div className="m-auto text-center flex flex-col items-center opacity-50">
                <MessageCircle className="w-10 h-10 text-pink-300 mb-2" />
                <p className="text-xs text-gray-500 font-medium">Hãy gửi một tin nhắn thoại<br/>cho người ấy nhé! 💕</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 relative group ${
                    msg.sender === 'me' 
                      ? 'bg-linear-to-br from-pink-500 to-rose-500 text-white rounded-br-sm shadow-sm' 
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                  }`}>
                    
                    {msg.text.startsWith('[VOICE]') ? (
                      <audio src={msg.text.replace('[VOICE]', '')} controls className="h-10 w-48 sm:w-56 outline-none" />
                    ) : (
                      <p className="text-sm wrap-break-word leading-relaxed">{msg.text}</p>
                    )}
                    
                    <span className={`text-[9px] mt-1 block ${msg.sender === 'me' ? 'text-pink-100 text-right' : 'text-gray-400 text-left'}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100 shrink-0">
            {isRecording ? (
              <div className="flex items-center justify-between bg-rose-50 rounded-full px-4 py-2 border border-rose-100 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-rose-600">{formatRecordDuration(recordingTime)}</span>
                  <span className="text-xs text-rose-400 font-medium">Đang thu âm...</span>
                </div>
                <button onClick={stopRecording} className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all hover:scale-105 shadow-md">
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Nhắn nhủ điều gì đó..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 transition-all text-gray-700 placeholder-gray-400"
                />
                {inputText.trim() ? (
                  <button type="submit" className="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center hover:bg-pink-600 transition-all shrink-0 shadow-md animate-in zoom-in">
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                ) : (
                  <button type="button" onClick={startRecording} className="w-10 h-10 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center hover:bg-pink-100 transition-all shrink-0">
                    <Mic className="w-4.5 h-4.5" />
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      <button onClick={toggleChat} className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95 z-50 ${isOpen ? 'bg-gray-800 hover:bg-gray-700' : 'bg-linear-to-br from-pink-500 to-rose-500 hover:shadow-[0_10px_20px_rgba(255,192,203,0.5)]'}`}>
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-[10px] font-bold border-2 border-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>
    </div>
  );
};