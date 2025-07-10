// src/components/video/ShareModal.tsx
import React from 'react';
import { X, Share2, Download } from 'lucide-react';
import { 
  checkSocialMediaCompatibility,
  detectAndroid 
} from '../../utils/androidRecorderFix';

interface ShareModalProps {
  recordedVideo: File | Blob;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onProcessAndShare: () => void;
  addLog: (message: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  recordedVideo,
  isOpen,
  onClose,
  onDownload,
  onProcessAndShare,
  addLog
}) => {
  if (!isOpen) return null;

  const file = recordedVideo instanceof File ? 
    recordedVideo : 
    new File([recordedVideo], `lens-video-${Date.now()}.mp4`, {
      type: 'video/mp4',
      lastModified: Date.now()
    });

  const isAndroid = detectAndroid();
  const duration = (file as any).recordingDuration;
  const compatibility = checkSocialMediaCompatibility(file);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 max-w-sm w-full mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-lg font-semibold">Share Video</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video info */}
        <div className="text-white/80 text-sm mb-4">
          <p className="mb-2">
            📹 {duration ? `${duration}s` : 'Recording'} • {isAndroid ? 'MP4' : 'WebM'} format
          </p>
          
          {/* Compatibility status */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${compatibility.instagram ? 'bg-pink-500/20 text-pink-300' : 'bg-gray-500/20 text-gray-400'}`}>
              Instagram {compatibility.instagram ? '✓' : '✗'}
            </span>
            <span className={`px-2 py-1 rounded ${compatibility.tiktok ? 'bg-black/20 text-white' : 'bg-gray-500/20 text-gray-400'}`}>
              TikTok {compatibility.tiktok ? '✓' : '✗'}
            </span>
            <span className={`px-2 py-1 rounded ${compatibility.youtube ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-400'}`}>
              YouTube {compatibility.youtube ? '✓' : '✗'}
            </span>
          </div>
        </div>

        {/* Main share button */}
        <div className="space-y-3">
          <button
            onClick={() => {
              addLog('🎬 Starting video processing...');
              onProcessAndShare();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span>Process & Share</span>
          </button>

          <button
            onClick={() => {
              onDownload();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>Download Only</span>
          </button>
        </div>

        {/* Info tip */}
        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-xs text-blue-300">
          💡 <strong>Process & Share:</strong> Optimizes video metadata for Instagram and other apps
        </div>
      </div>
    </div>
  );
};