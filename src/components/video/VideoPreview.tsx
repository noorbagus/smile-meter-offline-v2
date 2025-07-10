// src/components/video/VideoPreview.tsx
import React from 'react';
import { X, Download, Share2 } from 'lucide-react';
import { ControlButton } from '../ui';
import { checkSocialMediaCompatibility } from '../../utils/androidRecorderFix';

interface VideoPreviewProps {
  recordedVideo: Blob | File;
  onClose: () => void;
  onDownload: () => void;
  onProcessAndShare: () => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  recordedVideo,
  onClose,
  onDownload,
  onProcessAndShare
}) => {
  const isAndroidRecording = (recordedVideo as any).isAndroidRecording;
  const duration = (recordedVideo as any).recordingDuration;
  const compatibility = checkSocialMediaCompatibility(recordedVideo as File);

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/50 to-transparent z-20">
        <div className="flex justify-between items-center">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h2 className="text-white font-semibold">Preview</h2>
            {duration && (
              <div className="text-xs text-white/70 mt-1">
                {duration}s • Ready to share
              </div>
            )}
          </div>
          
          <div className="w-10" />
        </div>
        
        {/* Compatibility indicators */}
        <div className="flex justify-center mt-2 space-x-2 text-xs">
          <span className={`px-2 py-1 rounded ${compatibility.instagram ? 'bg-pink-500/20 text-pink-300' : 'bg-gray-500/20 text-gray-400'}`}>
            IG {compatibility.instagram ? '✓' : '✗'}
          </span>
          <span className={`px-2 py-1 rounded ${compatibility.tiktok ? 'bg-black/20 text-white' : 'bg-gray-500/20 text-gray-400'}`}>
            TT {compatibility.tiktok ? '✓' : '✗'}
          </span>
          <span className={`px-2 py-1 rounded ${compatibility.youtube ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-400'}`}>
            YT {compatibility.youtube ? '✓' : '✗'}
          </span>
        </div>
      </div>

      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center">
        <video
          src={URL.createObjectURL(recordedVideo)}
          controls
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/50 to-transparent z-20">
        <div className="flex items-center justify-center space-x-6">
          <ControlButton 
            icon={Download} 
            onClick={onDownload} 
            label="Download Only"
            size="lg"
          />
          
          <ControlButton 
            icon={Share2} 
            onClick={onProcessAndShare} 
            label="Share"
            size="lg"
          />
        </div>
        
        {/* Tip */}
        <div className="text-center mt-3">
          <p className="text-white/60 text-xs">
            💡 Process & Share optimizes video for Instagram/TikTok
          </p>
        </div>
      </div>
    </div>
  );
};