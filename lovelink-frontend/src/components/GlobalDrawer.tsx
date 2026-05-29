import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../services/apiClient'; 
import { Pencil, X, Eraser, MousePointer2 } from 'lucide-react';


export const GlobalDrawer = () => {
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#ec4899'); // Màu hồng mặc định
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  // Cập nhật cấu trúc lastPos để chứa cả tọa độ thực (local) và tọa độ đã chuẩn hóa (norm)
  const lastPos = useRef({ localX: 0, localY: 0, normX: 0, normY: 0 });

  // Tự động chỉnh kích thước kính bằng đúng kích thước màn hình
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Lắng nghe tín hiệu vẽ từ người ấy
  useEffect(() => {
    const handleRemoteDraw = (e: any) => {
      const { action, payload } = e.detail;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      if (action === 'global_draw') {
        // 🌟 GIẢI MÃ TỌA ĐỘ TỪ TÂM MÀN HÌNH ĐỂ KHỚP TỶ LỆ PC & MOBILE
        const minDim = Math.min(canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const x0 = (payload.x0 * minDim) + centerX;
        const y0 = (payload.y0 * minDim) + centerY;
        const x1 = (payload.x1 * minDim) + centerX;
        const y1 = (payload.y1 * minDim) + centerY;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = payload.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.closePath();
      } 
      else if (action === 'global_clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    window.addEventListener('sync_video_event', handleRemoteDraw);
    return () => window.removeEventListener('sync_video_event', handleRemoteDraw);
  }, []);

  const broadcastSignal = (action: string, payload: any = null) => {
    apiClient.post('/couple/video/sync', { action, payload }).catch(console.error);
  };

  // 🌟 CÔNG THỨC TOÁN HỌC NEO VÀO TÂM MÀN HÌNH
  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { localX: 0, localY: 0, normX: 0, normY: 0 };
    
    // Tương thích cho cả chuột PC và cảm ứng Mobile
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const minDim = Math.min(canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    return {
      localX: clientX, // Tọa độ thực tế để tự vẽ lên máy mình
      localY: clientY,
      normX: (clientX - centerX) / minDim, // Tọa độ chuẩn hóa để gửi đi
      normY: (clientY - centerY) / minDim
    };
  };

  const startDrawing = (e: any) => {
    if (!isDrawingMode) return;
    isDrawing.current = true;
    lastPos.current = getCoordinates(e);
  };

  const draw = (e: any) => {
    if (!isDrawing.current || !isDrawingMode) return;
    
    // KHÔNG dùng e.preventDefault() ở đây để tránh lỗi "Unable to preventDefault..." trên điện thoại
    const newPos = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (ctx && canvas) {
      // Vẽ lên màn hình của chính mình (dùng tọa độ thực)
      ctx.beginPath();
      ctx.moveTo(lastPos.current.localX, lastPos.current.localY);
      ctx.lineTo(newPos.localX, newPos.localY);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.closePath();
    }

    // Bắn tọa độ đã chuẩn hóa sang máy đối phương
    broadcastSignal('global_draw', { 
      x0: lastPos.current.normX, y0: lastPos.current.normY, 
      x1: newPos.normX, y1: newPos.normY, 
      color: drawColor 
    });

    lastPos.current = newPos;
  };

  const stopDrawing = () => { isDrawing.current = false; };

  const clearCanvas = (emit = true) => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    if (emit) broadcastSignal('global_clear');
  };

  return (
    <>
      {/* 🌟 TẤM KÍNH TRONG SUỐT PHỦ KÍN TRANG WEB */}
      <canvas
        ref={canvasRef}
        // z-[9998] để nằm dưới Modal Ảnh Fullscreen một chút nhưng đè lên mọi thứ khác
        className={`fixed top-0 left-0 w-screen h-screen ${isDrawingMode ? 'pointer-events-auto cursor-crosshair z-9998' : 'pointer-events-none z-50'}`}
        style={{ touchAction: 'none' }} // Chặn cuộn trang bằng CSS thay vì JS
        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
      />

      {/* 🌟 NÚT BẬT/TẮT CÔNG CỤ VẼ (TRÔI NỔI GÓC DƯỚI) */}
      <div className="fixed bottom-6 right-6 z-9999 flex flex-col items-end gap-3">
        
        {/* Hộp màu hiện ra khi bật chế độ vẽ */}
        {isDrawingMode && (
          <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-pink-100 flex flex-col gap-3 animate-fade-in origin-bottom-right">
            <div className="flex gap-2">
              {['#ec4899', '#ef4444', '#3b82f6', '#eab308', '#2dd4bf', '#000000'].map(c => (
                <button
                  key={c} onClick={() => setDrawColor(c)}
                  className={`w-8 h-8 rounded-full border-2 shadow-sm transition-transform ${drawColor === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => clearCanvas(true)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-all">
                <Eraser className="w-4 h-4" /> Xóa
              </button>
              <button onClick={() => setIsDrawingMode(false)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 font-semibold rounded-xl text-xs transition-all">
                <MousePointer2 className="w-4 h-4" /> Tắt vẽ
              </button>
            </div>
          </div>
        )}

        {/* Nút bấm tròn (Floating Action Button) */}
        <button
          onClick={() => setIsDrawingMode(!isDrawingMode)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${isDrawingMode ? 'bg-gray-800 text-white rotate-45' : 'bg-linear-to-tr from-pink-500 to-rose-400 text-white hover:scale-110 hover:shadow-pink-300/50'}`}
        >
          {isDrawingMode ? <X className="w-6 h-6" /> : <Pencil className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
};