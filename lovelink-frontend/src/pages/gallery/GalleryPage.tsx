import React from 'react';
import { motion } from 'motion/react';
import { Camera, Plus } from 'lucide-react';

const PHOTOS = [
  {
    id: 1,
    url: 'https://images.unsplash.com/photo-1670758108290-d3ef354bbffb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3VwbGUlMjByb21hbnRpY3xlbnwxfHx8fDE3Nzg2NDA3ODh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'Kỷ niệm 1',
    colSpan: 'col-span-2'
  },
  {
    id: 2,
    url: 'https://images.unsplash.com/photo-1506014299253-3725319c0f69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3VwbGUlMjBob2xkaW5nJTIwaGFuZHN8ZW58MXx8fHwxNzc4NTcwMDMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'Nắm tay nhau',
    colSpan: 'col-span-1'
  },
  {
    id: 3,
    url: 'https://images.unsplash.com/photo-1575388104683-e076ee9ccaa0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3VwbGUlMjBzdW5zZXR8ZW58MXx8fHwxNzc4NjQwNzk1fDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'Hoàng hôn',
    colSpan: 'col-span-1'
  }
];

export function GalleryPage() {
  return (
    <div className="w-full mx-auto max-w-3xl px-4 flex flex-col items-center pb-24 h-full overflow-y-auto pt-30">
      <div className="w-full flex justify-between items-center mb-6">
        <h2 className="text-2xl font-serif text-pink-600 font-medium">Khoảnh khắc</h2>
        <button className="w-10 h-10 bg-linear-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white shadow-md hover:shadow-lg transition-all">
          <Camera className="w-5 h-5" />
        </button>
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        {PHOTOS.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`relative group rounded-2xl overflow-hidden shadow-sm aspect-square ${photo.colSpan}`}
          >
            <img 
              src={photo.url} 
              alt={photo.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <span className="text-white font-medium text-sm">{photo.title}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default GalleryPage;