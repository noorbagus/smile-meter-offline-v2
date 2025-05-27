import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/web-ar/',
  plugins: [react()],
  server: {
    host: true, // Allows access from mobile devices on same network
    port: 3000,
    https: {
        key: './localhost+2-key.pem',
        cert: './localhost+2.pem'
      }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // Add this line
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          camera: ['@snap/camera-kit'] // Add this line
        }
      }
    }
  }
})