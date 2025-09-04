// src/utils/RemoteApiService.ts
import { type RemoteApiRequest, type RemoteApiResponse, type RemoteApiRequestHandler } from '@snap/camera-kit';

// Global reference to access context outside React
let globalStateRef: any = null;
export const setGlobalStateRef = (ref: any) => {
  globalStateRef = ref;
};

// Handler for Recording Control API
const handleRecordingApi = (request: RemoteApiRequest): RemoteApiRequestHandler | undefined => {
  // Handle start_recording endpoint
  if (request.endpointId === "start_recording") {
    return (reply) => {
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
      
      const response: RemoteApiResponse = {
        status: "success",
        metadata: {},
        body: new TextEncoder().encode(JSON.stringify({
          recording_id: recordingId,
          success: true
        }))
      };
      
      reply(response);
    };
  }
  
  // Handle stop_recording endpoint
  if (request.endpointId === "stop_recording") {
    return (reply) => {
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
      
      const response: RemoteApiResponse = {
        status: "success",
        metadata: {},
        body: new TextEncoder().encode(JSON.stringify({
          success: true
        }))
      };
      
      reply(response);
    };
  }
  
  return undefined;
};

// Handler for Hadiah Status API
const handleHadiahStatusApi = (request: RemoteApiRequest): RemoteApiRequestHandler | undefined => {
  if (request.endpointId === "get_hadiah_status") {
    return (reply) => {
      // Get hadiah state from global context or use defaults
      const hadiahState = globalStateRef?.current || { 
        hadiahAvailable: true, 
        stockCount: 100
      };
      
      console.log(`[Remote API] Sending hadiah status:`, hadiahState);
      
      const response: RemoteApiResponse = {
        status: "success",
        metadata: {},
        body: new TextEncoder().encode(JSON.stringify({
          available: hadiahState.hadiahAvailable,
          stock_count: hadiahState.stockCount
        }))
      };
      
      reply(response);
    };
  }
  
  return undefined;
};

// Main Recording Control API service
export const recordingControlService = {
  apiSpecId: "554881fc-8ced-405b-bfea-f229c5dd9a4f", // Recording API spec ID
  
  getRequestHandler(request: RemoteApiRequest): RemoteApiRequestHandler | undefined {
    console.log(`[Recording API] Request received: ${request.endpointId}`, request.parameters);
    return handleRecordingApi(request);
  }
};

// Hadiah Status API service
export const hadiahStatusService = {
  apiSpecId: "1449890e-5eed-4797-8be9-8941ad055157", // Hadiah API spec ID
  
  getRequestHandler(request: RemoteApiRequest): RemoteApiRequestHandler | undefined {
    console.log(`[Hadiah API] Request received: ${request.endpointId}`, request.parameters);
    return handleHadiahStatusApi(request);
  }
};

// Combined service for backward compatibility
export const remoteApiService = {
  apiSpecId: "554881fc-8ced-405b-bfea-f229c5dd9a4f",
  
  getRequestHandler(request: RemoteApiRequest): RemoteApiRequestHandler | undefined {
    console.log(`[Remote API] Request received: ${request.endpointId} from API: ${request.apiSpecId}`);
    
    // Check which API spec we're dealing with
    if (request.apiSpecId === "554881fc-8ced-405b-bfea-f229c5dd9a4f") {
      return handleRecordingApi(request);
    } 
    else if (request.apiSpecId === "1449890e-5eed-4797-8be9-8941ad055157") {
      return handleHadiahStatusApi(request);
    }
    
    return undefined;
  }
};

// Export all services for registration
export const remoteApiServices = [recordingControlService, hadiahStatusService];