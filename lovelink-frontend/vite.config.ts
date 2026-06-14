import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // 1. Tăng nhẹ giới hạn cảnh báo
    chunkSizeWarningLimit: 1000, 
    
    // 2. Cắt nhỏ các thư viện nặng ra thành từng file riêng biệt
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Tách thư viện hiệu ứng (Nặng nhất)
            if (id.includes('framer-motion') || id.includes('motion')) {
              return 'vendor-motion';
            }
            // Tách thư viện Icon
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            // Tách thư viện lõi của React
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // Gom các thư viện lặt vặt còn lại
            return 'vendor-others';
          }
        }
      }
    }
  }
})