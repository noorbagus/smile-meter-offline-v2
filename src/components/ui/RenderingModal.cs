// src/components/ui/RenderingModal.tsx
import React from 'react';

interface RenderingModalProps {
  isOpen: boolean;
  progress: number;
  onCancel?: () => void;
}

export const RenderingModal: React.FC<RenderingModalProps> = ({
  isOpen,
  progress,
  onCancel
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 max-w-sm w-full mx-auto text-center">
        <h3 className="text-white text-lg font-semibold mb-4">
          Menyiapkan Video
        </h3>
        
        <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-white/80 text-sm mb-6">
          {progress < 30 && "Memulai proses..."}
          {progress >= 30 && progress < 60 && "Memperbaiki metadata durasi..."}
          {progress >= 60 && progress < 90 && "Mengoptimalkan untuk media sosial..."}
          {progress >= 90 && progress < 100 && "Finalisasi video..."}
          {progress === 100 && "Selesai! Video siap dibagikan."}
        </p>
        
        <div className="text-xs text-white/60 bg-black/20 p-3 rounded mb-4">
          <p>Proses ini memastikan video Anda kompatibel dengan Instagram dan editor video. Mohon tunggu sebentar.</p>
        </div>
        
        {onCancel && progress < 100 && (
          <button
            onClick={onCancel}
            className="text-white/60 hover:text-white text-sm"
          >
            Batalkan
          </button>
        )}
      </div>
    </div>
  );
};

export default RenderingModal;