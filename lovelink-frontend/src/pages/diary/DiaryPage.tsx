import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sparkles, CalendarHeart, PenLine, Quote, X, ImagePlus, MapPin, Type, Calendar as CalendarIcon, Save, MoreVertical, Edit, Trash2, Globe, Lock } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth để lấy ID người dùng

interface DiaryEntry {
  _id?: string;
  date: string;
  title: string;
  content: string;
  image_url?: string;
  location?: string;
  visibility?: string; // Thêm quyền xem
  author_id?: number | string; // Thêm ID tác giả để biết ai được quyền sửa/xóa
  liked_by?: string[];
}

export function DiaryPage() {
  const { user } = useAuth(); // Lấy thông tin user đang đăng nhập
  const [isWriting, setIsWriting] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null); // State để biết đang sửa bài nào

  // 2. Hàm tải dữ liệu
  const fetchDiaries = async () => {
    try {
      const response = await apiClient.get('/diaries');
      setEntries(response.data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách nhật ký:", error);
    }
  };
  
  // Hàm xử lý lưu (Thêm mới hoặc Cập nhật)
  const handleSaveEntry = (savedEntry: DiaryEntry, isEdit?: boolean) => {
    if (isEdit) {
      // Nếu là sửa, tìm và thay thế bài cũ
      setEntries(prevEntries => prevEntries.map(e => e._id === savedEntry._id ? savedEntry : e));
    } else {
      // Nếu là thêm mới, chèn vào đầu
      const newEntries = [savedEntry, ...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(newEntries);
    }
    setIsWriting(false);
    setEditingEntry(null);
  };

  // Hàm xử lý xóa
  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa trang nhật ký này không? Hành động này không thể hoàn tác.")) return;
    try {
      await apiClient.delete(`/diaries/${id}`);
      setEntries(prev => prev.filter(e => e._id !== id));
    } catch (error) {
      console.error("Lỗi xóa nhật ký:", error);
      alert("Không thể xóa nhật ký lúc này.");
    }
  };

  // 3. Chạy hàm này 1 lần duy nhất khi vào trang
  useEffect(() => {
    fetchDiaries();
  }, []);

  return (
    <div className="w-full  mx-auto max-w-3xl px-4 flex flex-col items-center pb-28 h-full overflow-y-auto pt-30 scroll-smooth">
      {/* Header Section */}
      <div className="w-full text-center mb-10 relative">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-block relative"
        >
          <Sparkles className="absolute -top-4 -left-6 w-5 h-5 text-pink-400 animate-pulse" />
          <h2 className="text-3xl font-serif text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-rose-600 font-bold mb-2">
            Nhật Ký Tình Yêu
          </h2>
          <Sparkles className="absolute -bottom-2 -right-6 w-5 h-5 text-rose-400 animate-pulse" />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-500 font-medium text-sm mt-2 italic flex items-center justify-center gap-2"
        >
          <Quote className="w-3 h-3 text-pink-300" />
          Lưu giữ từng khoảnh khắc chúng ta thuộc về nhau
          <Quote className="w-3 h-3 text-pink-300" />
        </motion.p>
        
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setEditingEntry(null); setIsWriting(true); }}
          className="absolute right-0 top-0 w-12 h-12 bg-linear-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-pink-300/50 transition-all z-10 group"
        >
          <PenLine className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        </motion.button>
      </div>

      {/* Timeline Layout */}
      <div className="w-full relative">
        {/* The elegant vertical timeline line */}
        <div className="absolute left-6 md:left-8 top-4 bottom-0 w-0.5 bg-linear-to-b from-pink-300 via-rose-200 to-transparent opacity-60" />

        <div className="space-y-12 w-full">
          <AnimatePresence>
            {entries.map((entry, index) => (
              <DiaryEntryCard 
                key={entry._id || index} 
                entry={entry} 
                index={index} 
                currentUserId={user?.id}
                currentUserGender={user?.gender}
                onEdit={() => { setEditingEntry(entry); setIsWriting(true); }}
                onDelete={() => entry._id && handleDeleteEntry(entry._id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal Viết Nhật Ký */}
      <AnimatePresence>
        {isWriting && (
          <WriteDiaryModal 
            onClose={() => { setIsWriting(false); setEditingEntry(null); }} 
            onSave={handleSaveEntry} 
            initialData={editingEntry}
          />
        )}
      </AnimatePresence>
      
    </div>
  );
}

function WriteDiaryModal({ onClose, onSave, initialData }: { onClose: () => void, onSave: (entry: DiaryEntry, isEdit?: boolean) => void, initialData?: DiaryEntry | null }) {
  // Điền dữ liệu cũ nếu đang trong chế độ Sửa
  const { user } = useAuth();
  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(initialData?.location || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [visibility, setVisibility] = useState(initialData?.visibility || 'couple');
  const [imageFile, setImageFile] = useState<File | null>(null); 
  const [previewUrl, setPreviewUrl] = useState<string>(initialData?.image_url || '');      

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content || !date) return;

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('date', date);
      formData.append('visibility', visibility); // Thêm trường quyền xem
      
      if (location) formData.append('location', location.trim());
      if (imageFile) formData.append('image', imageFile);

      if (initialData && initialData._id) {
        // GỌI API SỬA (PUT)
        const response = await apiClient.put(`/diaries/${initialData._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        onSave({
          ...initialData,
          title, content, date, location, visibility,
          image_url: response.data?.image_url || previewUrl // Lấy URL mới nếu có đổi ảnh, không thì dùng ảnh cũ
        }, true);
      } else {
        // GỌI API TẠO MỚI (POST)
        const response = await apiClient.post('/diaries', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const newEntry = {
            _id: response.data.id, 
            title: title,          
            content: content,      
            date: date,            
            location: location,    
            visibility: visibility,
            image_url: response.data.image_url,
            author_id: user?.id
        };
        onSave(newEntry, false); 
      }
      
      onClose();
    } catch (error) {
      console.error("Lỗi khi lưu nhật ký:", error);
      alert("Có lỗi xảy ra khi lưu nhật ký!");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (file) {
      setImageFile(file); 
      const tempUrl = URL.createObjectURL(file);
      setPreviewUrl(tempUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Decorative Header */}
        <div className="bg-linear-to-r from-pink-100 to-rose-100 p-5 flex items-center justify-between border-b border-pink-200">
          <div className="flex items-center gap-2 text-rose-600 font-serif font-semibold text-lg">
            <PenLine className="w-5 h-5" />
            <span>{initialData ? 'Sửa trang nhật ký' : 'Viết trang nhật ký mới'}</span>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 hover:bg-white text-rose-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-pink-400" />
              Tiêu đề <span className="text-red-400">*</span>
            </label>
            <input 
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="VD: Cùng nhau đón hoàng hôn..."
              className="w-full px-4 py-2.5 bg-pink-50/30 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-gray-800 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-pink-400" />
                Ngày <span className="text-red-400">*</span>
              </label>
              <input 
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-pink-50/30 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-gray-800"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-pink-400" />
                Địa điểm
              </label>
              <input 
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Nơi ấy..."
                className="w-full px-4 py-2.5 bg-pink-50/30 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-gray-800"
              />
            </div>
          </div>

          {/* Ô CHỌN QUYỀN RIÊNG TƯ (Vừa thêm vào) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-pink-400" />
              Ai có thể xem trang này?
            </label>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value)}
              className="w-full px-4 py-2.5 bg-pink-50/30 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-gray-800 cursor-pointer"
            >
              <option value="couple">Cả hai cùng xem (Mặc định)</option>
              <option value="private">Chỉ mình tôi (Bí mật)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <ImagePlus className="w-4 h-4 text-pink-400" />
              Tải hình ảnh lên (Tùy chọn)
            </label>
            
            <input 
              type="file"
              accept="image/*" 
              onChange={handleImageChange}
              className="w-full px-4 py-2 bg-pink-50/30 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all text-gray-800 text-sm 
                         file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-100 file:text-pink-600 hover:file:bg-pink-200 cursor-pointer"
            />
            
            {previewUrl && (
              <div className="mt-2 h-32 w-full rounded-lg overflow-hidden border border-pink-200 relative shadow-sm">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover" 
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setPreviewUrl('');
                  }}
                  className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm text-red-500 rounded-full p-1 hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-400" />
              Nội dung <span className="text-red-400">*</span>
            </label>
            <textarea 
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Hôm nay là một ngày tuyệt vời..."
              rows={4}
              className="w-full px-4 py-3 bg-pink-50/30 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all text-gray-800 resize-none leading-relaxed"
            />
          </div>
          
        </form>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-pink-100 bg-gray-50/50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!title || !content || !date}
            className="px-6 py-2.5 bg-linear-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white font-medium rounded-xl shadow-md shadow-pink-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {initialData ? 'Lưu thay đổi' : 'Lưu kỷ niệm'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DiaryEntryCard({ entry, index, currentUserId, currentUserGender, onEdit, onDelete }: { entry: DiaryEntry; index: number; currentUserId?: number | string; currentUserGender?: string; onEdit: () => void; onDelete: () => void; }) {
  const [showHearts, setShowHearts] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false); 

  // BƯỚC 1: QUẢN LÝ DANH SÁCH NGƯỜI ĐÃ THẢ TIM THAY VÌ CHỈ BOOLEAN
  const [likedByData, setLikedByData] = useState<string[]>(entry.liked_by || []);
  
  const isAuthor = currentUserId !== undefined && entry.author_id !== undefined && String(entry.author_id) === String(currentUserId);
  const isLiked = likedByData.includes(String(currentUserId)); // Kiểm tra xem mình đã tim chưa

  // BƯỚC 2: HÀM HIỂN THỊ CHỮ (Ai là người thả tim)
  const renderLikeStatus = () => {
    if (likedByData.length === 0) return null;

    const meLiked = likedByData.includes(String(currentUserId));
    const partnerLiked = likedByData.some(id => id !== String(currentUserId));

    let partnerName = "Người ấy";
    if (currentUserGender === 'male') {
      partnerName = "Vợ bạn"; 
    } else if (currentUserGender === 'female') {
      partnerName = "Chồng bạn"; 
    }

    if (meLiked && partnerLiked) {
      return "Hai bạn đã thả tim 💕";
    } else if (meLiked) {
      return "Bạn đã thả tim";
    } else if (partnerLiked) {
      return `${partnerName} đã thả tim`; 
    }
    return null;
  };

  // BƯỚC 3: XỬ LÝ KHI BẤM NÚT TIM
  const handleLike = async () => {
    const myIdStr = String(currentUserId);
    const currentlyLiked = isLiked;

    // Cập nhật giao diện lập tức (Optimistic UI)
    if (currentlyLiked) {
      setLikedByData(prev => prev.filter(id => id !== myIdStr)); // Xóa mình khỏi danh sách
    } else {
      setLikedByData(prev => [...prev, myIdStr]); // Thêm mình vào danh sách
      setShowHearts(true);
      setTimeout(() => setShowHearts(false), 2000); 
    }

    try {
      // Gọi API ngầm
      if (entry._id) {
        await apiClient.post(`/diaries/${entry._id}/like`);
      }
    } catch (error) {
      console.error("Lỗi khi thả tim:", error);
      // Nếu API lỗi, hoàn tác lại giao diện
      if (currentlyLiked) {
        setLikedByData(prev => [...prev, myIdStr]);
      } else {
        setLikedByData(prev => prev.filter(id => id !== myIdStr));
      }
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -30, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.1, duration: 0.6, ease: "easeOut" }}
      className="relative pl-16 md:pl-20 pr-2 w-full group"
    >
      <div className="absolute left-3 md:left-5 top-4 w-7 h-7 rounded-full bg-white shadow-md border-2 border-pink-200 flex items-center justify-center z-10 group-hover:border-rose-400 group-hover:scale-110 transition-all duration-300">
        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
        <div className="absolute inset-0 rounded-full bg-pink-400 blur-md opacity-20 group-hover:opacity-60 transition-opacity" />
      </div>

      <div className="mb-2 flex items-center gap-2 text-rose-500 font-medium text-sm bg-pink-50/80 px-3 py-1 rounded-full backdrop-blur-sm border border-pink-100 w-max">
        <CalendarHeart className="w-4 h-4" />
        <span>{entry.date.split('-').reverse().join('/')}</span>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 md:p-6 shadow-sm border border-pink-100 hover:shadow-xl hover:shadow-pink-100/50 transition-all duration-500 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-linear-to-br from-pink-200 to-rose-200 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />

        <div className="relative z-10">
          
          <div className="absolute top-0 right-0 flex items-center gap-2 z-20">
            {entry.visibility === 'private' && (
              <span title="Chỉ mình tôi" className="text-gray-400 bg-gray-100/50 p-1.5 rounded-full"><Lock className="w-4 h-4"/></span>
            )}
            
            {isAuthor && (
              <div className="relative">
                <button 
                  onClick={() => setShowMenu(!showMenu)} 
                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                >
                  <MoreVertical className="w-5 h-5"/>
                </button>
                
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
                    <div className="absolute right-0 mt-1 w-32 bg-white border border-pink-100 shadow-xl rounded-xl overflow-hidden z-20 py-1">
                      <button 
                        onClick={() => { setShowMenu(false); onEdit(); }} 
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-600 flex items-center gap-2 transition-colors"
                      >
                        <Edit className="w-4 h-4"/> Sửa
                      </button>
                      <button 
                        onClick={() => { setShowMenu(false); onDelete(); }} 
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4"/> Xóa
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <h3 className="font-serif font-bold text-xl text-gray-800 mb-1 pr-12 group-hover:text-rose-600 transition-colors">
            {entry.title}
          </h3>
          
          {entry.location && (
            <p className="text-xs text-gray-400 font-medium mb-4 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {entry.location}
            </p>
          )}

          {entry.image_url && (
            <div className="w-full h-55 rounded-2xl overflow-hidden mb-4 relative cursor-pointer"
            onClick={() => setSelectedImage(entry.image_url ?? null)} >
              <img 
                src={entry.image_url} 
                alt={entry.title} 
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
            </div>
          )}

          <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-4 whitespace-pre-wrap">
            {entry.content}
          </p>

          {/* SỬA LẠI KHUNG GIAO DIỆN Ở ĐÂY ĐỂ HIỂN THỊ CHỮ */}
          <div className="flex items-center justify-between border-t border-pink-50 pt-3 mt-2 min-h-10">
            
            {/* Cột Trái: Hiển thị trạng thái người thả tim */}
            <div className="text-sm font-medium text-pink-400 flex items-center gap-1.5 animate-in fade-in duration-300">
              {likedByData.length > 0 && (
                <>
                  <Heart className="w-3.5 h-3.5 fill-pink-400" />
                  <span>{renderLikeStatus()}</span>
                </>
              )}
            </div>

            {/* Cột Phải: Nút thả tim */}
            <button 
              onClick={handleLike}
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-pink-50 transition-colors"
            >
              <Heart 
                className={`w-5 h-5 transition-all duration-300 ${isLiked ? 'text-rose-500 fill-rose-500 scale-110' : 'text-gray-400'}`} 
              />
              <span className={`text-sm font-medium ${isLiked ? 'text-rose-500' : 'text-gray-500'}`}>
                {isLiked ? 'Đã yêu' : 'Yêu thích'}
              </span>
              
              <AnimatePresence>
                {showHearts && <MiniHearts />}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {selectedImage && createPortal(
        <div 
          style={{ zIndex: 999999 }}
          className="fixed inset-0 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
          onClick={() => setSelectedImage(null)} 
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-100000"
            onClick={(e) => {
              e.stopPropagation(); 
              setSelectedImage(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={selectedImage} 
            alt="Phóng to" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>,
        document.body 
      )}
    </motion.div>
  );
}

function MiniHearts() {
  const hearts = Array.from({ length: 6 });
  
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-50">
      {hearts.map((_, i) => {
        const randomX = (Math.random() - 0.5) * 60;
        const randomY = -40 - Math.random() * 60;
        const randomRotate = (Math.random() - 0.5) * 90;
        
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{ 
              opacity: [1, 1, 0], 
              scale: [0.5, 1.2, 0.8], 
              x: randomX, 
              y: randomY,
              rotate: randomRotate 
            }}
            transition={{ duration: 1 + Math.random(), ease: "easeOut" }}
            className="absolute"
          >
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
          </motion.div>
        );
      })}
    </div>
  );
}

export default DiaryPage;