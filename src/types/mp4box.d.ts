// src/types/mp4box.d.ts
declare module 'mp4box' {
    interface MP4Info {
      duration: number;
      timescale: number;
      videoTracks: MP4Track[];
      audioTracks: MP4Track[];
    }
  
    interface MP4Track {
      id: number;
      duration: number;
      movie_duration: number;
      timescale: number;
    }
  
    interface MP4File {
      onError: (error: any) => void;
      onReady: (info: MP4Info) => void;
      onSegment: (id: number, user: any, buffer: ArrayBuffer) => void;
      appendBuffer: (buffer: ArrayBuffer & { fileStart?: number }) => void;
      flush: () => void;
      start: () => void;
    }
  
    export function createFile(): MP4File;
  }