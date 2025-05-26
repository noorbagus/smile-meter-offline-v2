export type CameraState = 'initializing' | 'ready' | 'error';

export type RecordingState = 'idle' | 'recording' | 'processing';

export interface CameraKitConfig {
  apiToken: string;
  lensId: string;
  lensGroupId: string;
  canvas: {
    width: number;
    height: number;
  };
  camera: {
    facingMode: 'user' | 'environment';
    audio: boolean;
  };
  recording: {
    mimeType: string;
    videoBitsPerSecond: number;
  };
}

export interface ShareData {
  files: File[];
  title: string;
  text: string;
}

export interface CameraKitSession {
  applyLens: (lensId: string, lensGroupId: string) => Promise<void>;
  destroy: () => void;
}

export interface MediaRecorderOptions {
  mimeType: string;
  videoBitsPerSecond?: number;
}