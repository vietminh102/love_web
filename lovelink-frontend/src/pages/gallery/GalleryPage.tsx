import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { galleryService } from '../../services/galleryService'; 
import { Camera, Heart, Download, Trash2, X } from 'lucide-react';


interface Photo {
  id: string;
  image_url: string;
  created_at: string;
  likes: string[];
}

export function GalleryPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const [uploading, setUploading] = useState(false);
  const [heartAnim, setHeartAnim] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<{ [key: string]: number }>({});
  // Lấy ID user hiện tại để kiểm tra ai đã thả tim
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const myUserId = currentUser.id?.toString();

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const data = await galleryService.getPhotos();
      setPhotos(data);
    } catch (error) {
      console.error("Lỗi tải ảnh:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploading(true);
    try {
      const res = await galleryService.uploadPhoto(file);
      if (res.success) {
        setPhotos([res.photo, ...photos]); // Đẩy ảnh mới lên đầu
      }
    } catch (error) {
      alert("Lỗi tải ảnh lên, vui lòng thử lại!");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  //  Xử lý nháy đúp và thả tim API (Đã thêm phòng thủ mảng rỗng)
  const handleLike = async (photoId: string) => {
    // 1. Kích hoạt hiệu ứng nổ tim lập tức
    setHeartAnim(photoId);
    setTimeout(() => setHeartAnim(null), 800);

    // 2. Cập nhật UI tạm thời
    setPhotos(photos.map(p => {
      if (p.id === photoId) {
        
        const safeLikes = p.likes || []; 
        
        const isLiked = safeLikes.includes(myUserId);
        const newLikes = isLiked 
          ? safeLikes.filter(id => id !== myUserId) 
          : [...safeLikes, myUserId];
          
        return { ...p, likes: newLikes };
      }
      return p;
    }));

    // 3. Gọi API lưu vào Database
    try {
      await galleryService.toggleLike(photoId);
    } catch (error) {
      console.error("Lỗi thả tim");
    }
  };
// HÀM GIẢ LẬP DOUBLE TAP DÀNH RIÊNG CHO ĐIỆN THOẠI
  const handleTouchEnd = (photoId: string) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // Khoảng cách giữa 2 lần bấm tối đa là 300ms
    const lastTap = lastTapRef.current[photoId] || 0;

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      handleLike(photoId); // Kích hoạt thả tim nếu gõ nhanh 2 lần
    }
    lastTapRef.current[photoId] = now;
  };
  //Hàm dịch logic hiển thị ai đã tim
  const renderLikeText = (likes: string[]) => {
    if (!likes || likes.length === 0) return "";
    const hasMe = likes.includes(myUserId);
    if (likes.length === 1 && hasMe) return "Bạn đã thả tim";
    if (likes.length === 1 && !hasMe) return "Người ấy đã thả tim";
    if (likes.length >= 2) return "Cả hai đã thả tim";
    return "";
  };

  //Hàm tải ảnh về máy
  const handleDownload = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation(); // Ngăn mở lightbox khi bấm nút
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `kyniem_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Không thể tải ảnh ngay lúc này.");
    }
  };

  //Hàm xóa ảnh
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa kỷ niệm này không?")) return;
    try {
      const res = await galleryService.deletePhoto(id);
      if (res.success) {
        setPhotos(photos.filter(p => p.id !== id));
        setSelectedPhoto(null); // Đóng lightbox nếu đang mở
      }
    } catch (error) {
      alert("Không thể xóa ảnh.");
    }
  };

  // Xử lý nháy đúp thả tim (Hiệu ứng Instagram)
  const handleDoubleClick = (photoId: string) => {
  setHeartAnim(photoId);
  setTimeout(() => setHeartAnim(null), 800);
};

  // Hàm tạo lưới tự động (cứ tấm thứ 1 của mỗi cụm 3 tấm sẽ to ra)
  const getColSpan = (index: number) => {
    return index % 3 === 0 ? 'col-span-2' : 'col-span-1';
  };

  return (
    <div className="w-full mx-auto max-w-3xl px-4 flex flex-col items-center pb-24 h-full overflow-y-auto pt-30">
      
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl italic text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-rose-400 font-bold">
            Khoảnh Khắc
          </h2>
          <p className="text-xs text-pink-400 mt-1 italic">Nơi lưu giữ từng nhịp đập...</p>
        </div>
        
        {/* Nút Upload gắn với Input ẩn */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-12 h-12 bg-linear-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white shadow-md shadow-pink-200 hover:shadow-pink-400 transition-all active:scale-95 disabled:opacity-50 relative group"
        >
          {uploading ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <>
              <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {/* Hiệu ứng tỏa sáng lan tỏa quanh nút */}
              <span className="absolute inset-0 rounded-full border border-pink-400 animate-ping opacity-20" />
            </>
          )}
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
      </div>

      {/* Vùng hiển thị ảnh */}
      {loading ? (
        <div className="text-pink-400 animate-pulse mt-10">Đang tải kỷ niệm...</div>
      ) : photos.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-pink-200 rounded-3xl bg-white/50"
        >
          <Camera className="w-12 h-12 text-pink-200 mb-3" />
          <p className="text-gray-500 text-sm max-w-62.5">
            Chưa có kỷ niệm nào được lưu. Hãy tải lên tấm ảnh đầu tiên nhé, ví dụ như khoảnh khắc bên nhau tuyệt đẹp của hai bạn!
          </p>
        </motion.div>
      ) : (
        <div className="w-full grid grid-cols-2 gap-3">
          {photos.map((photo, index) => {
            const safeLikes = photo.likes || [];
            const isLikedByMe = safeLikes.includes(myUserId);

            return (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onDoubleClick={() => handleLike(photo.id)}   // Giữ double click cho Máy tính
                onTouchEnd={() => handleTouchEnd(photo.id)}    // 🌟 THÊM: Double Tap mượt mà cho Điện thoại
                onClick={() => setSelectedPhoto(photo)}
                className={`relative group rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-pink-200/50 aspect-square cursor-pointer ${getColSpan(index)}`}
              >
                <img src={`${API_BASE_URL}${photo.image_url}`} alt="Memory" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
                
                {/* Lớp phủ thông tin khi Hover hoặc Tap trên mobile */}
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  {safeLikes.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                      <span className="text-pink-100 text-xs font-medium drop-shadow-md">
                        {renderLikeText(safeLikes)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-xs">
                      {new Date(photo.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* THANH CÔNG CỤ NỔI: Sửa đổi để dễ dùng trên mobile */}
                <div className="absolute top-3 right-3 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">

                  <button onClick={(e) => handleDownload(e, photo.image_url)} className="p-2 bg-black/40 hover:bg-pink-500 rounded-full text-white backdrop-blur-sm transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  
                  <button onClick={(e) => handleDelete(e, photo.id)} className="p-2 bg-black/40 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/*  NÚT THẢ TIM  */}
                <div className="absolute bottom-3 right-3 z-30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLike(photo.id); }} 
                    className="p-2.5 bg-black/40 hover:bg-rose-500 rounded-full text-white backdrop-blur-sm transition-colors shadow-md"
                  >
                    <Heart className={`w-5 h-5 ${isLikedByMe ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
                  </button>
                </div>

                {/* Hiệu ứng tim bùng nổ khi double tap */}
                <AnimatePresence>
                  {heartAnim === photo.id && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0, rotate: -15 }} animate={{ scale: 1.5, opacity: 1, rotate: 0 }} exit={{ scale: 2, opacity: 0 }} transition={{ duration: 0.4 }}
                      className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                    >
                      <Heart className="w-16 h-16 text-rose-500 drop-shadow-2xl fill-rose-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MODAL XEM ẢNH FULLSCREEN */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <button className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 p-2 rounded-full transition-colors z-50">
              <X className="w-6 h-6" />
            </button>

            <motion.img
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
              src={selectedPhoto.image_url}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={() => handleLike(selectedPhoto.id)}
              onTouchEnd={() => handleTouchEnd(selectedPhoto.id)} // Thả tim màn hình lớn cho mobile
            />

            <AnimatePresence>
              {heartAnim === selectedPhoto.id && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2, opacity: 1 }} exit={{ scale: 3, opacity: 0 }} transition={{ duration: 0.4 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <Heart className="w-24 h-24 text-rose-500 drop-shadow-[0_0_20px_rgba(225,29,72,0.5)] fill-rose-500" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GalleryPage;