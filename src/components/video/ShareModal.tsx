// src/components/video/ShareModal.tsx
import React from 'react';
import { X, Share2, Download, Copy } from 'lucide-react';
import { 
  shareVideoAndroid, 
  showAndroidShareInstructions,
  checkSocialMediaCompatibility,
  detectAndroid 
} from '../../utils/androidRecorderFix';

interface ShareModalProps {
  recordedVideo: File | Blob;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  addLog: (message: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  recordedVideo,
  isOpen,
  onClose,
  onDownload,
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

  // Check if native sharing is available
  const canUseNativeShare = typeof navigator !== 'undefined' && 
    'share' in navigator && 
    typeof navigator.share === 'function';

  // Check if clipboard API is available
  const canUseClipboard = typeof navigator !== 'undefined' && 
    'clipboard' in navigator && 
    navigator.clipboard && 
    'write' in navigator.clipboard &&
    typeof navigator.clipboard.write === 'function';

  const handleNativeShare = async () => {
    try {
      addLog(`📱 Sharing ${isAndroid ? 'Android' : 'standard'} video (${duration}s)`);
      
      if (isAndroid) {
        const success = await shareVideoAndroid(file, addLog);
        if (!success) {
          showAndroidShareInstructions(file);
          onDownload();
        }
      } else {
        if (canUseNativeShare) {
          // Check if we can share this specific file
          const canShareFile = navigator.canShare ? navigator.canShare({ files: [file] }) : true;
          
          if (canShareFile) {
            await navigator.share({
              files: [file],
              title: 'My AR Video',
              text: `Check out this cool AR effect! 🎬 ${duration ? `(${duration}s)` : ''}`
            });
            addLog('✅ Video shared successfully');
          } else {
            addLog('❌ Cannot share this file type');
            onDownload();
          }
        } else {
          onDownload();
        }
      }
      onClose();
    } catch (error) {
      addLog(`❌ Sharing failed: ${error}`);
      onDownload();
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      if (canUseClipboard) {
        const clipboardItem = new ClipboardItem({
          [file.type]: file
        });
        await navigator.clipboard.write([clipboardItem]);
        addLog('✅ Video copied to clipboard');
        onClose();
      } else {
        addLog('❌ Clipboard not supported');
        onDownload();
      }
    } catch (error) {
      addLog(`❌ Copy failed: ${error}`);
      onDownload();
    }
  };

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

        {/* Share options */}
        <div className="space-y-3">
          {canUseNativeShare && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
            >
              <Share2 className="w-5 h-5" />
              <span>Share via Apps</span>
            </button>
          )}

          {canUseClipboard && (
            <button
              onClick={handleCopyToClipboard}
              className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-green-500 hover:bg-green-600 rounded-lg text-white font-medium transition-colors"
            >
              <Copy className="w-5 h-5" />
              <span>Copy to Clipboard</span>
            </button>
          )}

          <button
            onClick={() => {
              onDownload();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
          >
            <Download className="w-5 h-5" />
            <span>Download</span>
          </button>
        </div>

        {/* Platform tips */}
        {isAndroid && (
          <div className="mt-4 p-3 bg-green-500/10 rounded-lg text-xs text-green-300">
            💡 <strong>Android Tip:</strong> Your video is optimized for social media sharing!
          </div>
        )}
      </div>
    </div>
  );
};