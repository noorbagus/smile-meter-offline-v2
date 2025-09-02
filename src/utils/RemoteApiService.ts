// src/utils/RemoteApiService.ts
import type { RemoteApiRequest, Lens } from '@snap/camera-kit';

// Global reference to access context outside React
let globalStateRef: any = null;
export const setGlobalStateRef = (ref: any) => {
  globalStateRef = ref;
};

export class CameraKitRemoteApiService {
  apiSpecId = 'camera-kit-remote-api'; // This must match the ID in Lens Studio
  
  getRequestHandler(request: RemoteApiRequest, lens: Lens) {
    console.log(`[Remote API] Request received: ${request.endpointId}`, request.parameters);
    
    switch (request.endpointId) {
      case 'get_hadiah_status':
        return this.handleGetHadiahStatus(request);
      case 'start_recording':
        return this.handleStartRecording(request);
      case 'stop_recording':
        return this.handleStopRecording(request);
      default:
        console.warn(`[Remote API] Unknown endpoint: ${request.endpointId}`);
        return undefined;
    }
  }
  
  private handleGetHadiahStatus(request: RemoteApiRequest) {
    return {
      send: () => {
        // You can replace this with actual API calls to your backend
        const hadiahState = globalStateRef?.current || { 
          hadiahAvailable: true, 
          stockCount: 100
        };
        
        console.log(`[Remote API] Sending hadiah status:`, hadiahState);
        
        return {
          statusCode: 1, // Success
          body: JSON.stringify({
            available: hadiahState.hadiahAvailable,
            stock_count: hadiahState.stockCount
          })
        };
      }
    };
  }
  
  private handleStartRecording(request: RemoteApiRequest) {
    return {
      send: () => {
        const scene = request.parameters.scene || 'unknown';
        const recordingId = `rec_${Date.now()}`;
        
        console.log(`[Remote API] Starting recording for scene ${scene}, ID: ${recordingId}`);
        
        // Update global state
        if (globalStateRef?.current) {
          globalStateRef.current.recordingId = recordingId;
          globalStateRef.current.setRecordingId?.(recordingId);
        }
        
        // Also store in window for backup
        (window as any).currentRecordingId = recordingId;
        
        return {
          statusCode: 1,
          body: JSON.stringify({
            recording_id: recordingId,
            success: true
          })
        };
      }
    };
  }
  
  private handleStopRecording(request: RemoteApiRequest) {
    return {
      send: () => {
        const recordingId = request.parameters.recording_id || '';
        const score = parseInt(request.parameters.score || '0', 10);
        const scene = request.parameters.scene || '';
        
        console.log(`[Remote API] Stopping recording: ID=${recordingId}, score=${score}, scene=${scene}`);
        
        // Update global state
        if (globalStateRef?.current) {
          globalStateRef.current.currentScore = score;
          globalStateRef.current.setScore?.(score);
          globalStateRef.current.recordingId = null;
          globalStateRef.current.setRecordingId?.(null);
        }
        
        return {
          statusCode: 1,
          body: JSON.stringify({
            success: true
          })
        };
      }
    };
  }
}

// Singleton instance
export const remoteApiService = new CameraKitRemoteApiService();