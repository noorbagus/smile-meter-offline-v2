// src/utils/RemoteApiService.ts
import { 
  HADIAH_API_SPEC_ID,
  RECORDING_API_SPEC_ID,
  getEndpoint,
  validateRequest,
  validateResponse
} from '../api/remoteApiSpec';

// Type definitions for Camera Kit
interface RemoteApiRequest {
  apiSpecId: string;
  endpointId: string;
  parameters: Record<string, string>;
  body: ArrayBuffer;
}

interface RemoteApiResponse {
  statusCode: number;  // 1 = success, other values = error
  body: string;
  metadata?: Record<string, string>;
}

interface Lens {
  id: string;
  name?: string;
  // Other lens properties
}

type RemoteApiRequestHandler = {
  send: () => RemoteApiResponse;
};

// Global state reference for accessing React context outside of components
let globalStateRef: any = null;

export const setGlobalStateRef = (ref: any) => {
  globalStateRef = ref;
};

/**
 * Remote API Service for handling requests from Lens Studio
 * Implements handlers for the following endpoints:
 * - get_hadiah_status: Check reward availability
 * - start_recording: Start recording and get ID
 * - stop_recording: Stop recording and save score
 */
export class CameraKitRemoteApiService {
  // Must match the ID in Lens Studio code
  apiSpecId = 'camera-kit-remote-api';
  
  /**
   * Main handler for all remote API requests
   */
  getRequestHandler(request: RemoteApiRequest, lens: Lens): RemoteApiRequestHandler | undefined {
    console.log(`[Remote API] Request received: ${request.endpointId} from API ${request.apiSpecId}`, {
      parameters: request.parameters,
      lens: lens.name || lens.id,
      hasBody: request.body?.byteLength > 0
    });
    
    // Validate request against API spec
    const validation = validateRequest(request.apiSpecId, request.endpointId, request.parameters);
    if (!validation.isValid) {
      console.warn(`[Remote API] Invalid request:`, validation.errors);
      return {
        send: () => ({
          statusCode: 400,
          body: JSON.stringify({ 
            success: false, 
            error: validation.errors.join(', ') 
          })
        })
      };
    }
    
    // Route to specific handlers based on endpoint
    switch (request.endpointId) {
      case 'get_hadiah_status':
        return this.handleGetHadiahStatus(request);
      case 'start_recording':
        return this.handleStartRecording(request);
      case 'stop_recording':
        return this.handleStopRecording(request);
      default:
        console.warn(`[Remote API] Unhandled endpoint: ${request.endpointId}`);
        return undefined;
    }
  }
  
  /**
   * Handler for 'get_hadiah_status' endpoint
   * Returns reward availability and count
   */
  private handleGetHadiahStatus(request: RemoteApiRequest): RemoteApiRequestHandler {
    return {
      send: () => {
        try {
          // Get data from global state
          const hadiahState = globalStateRef?.current || { 
            hadiahAvailable: true, 
            stockCount: 100
          };
          
          console.log(`[Remote API] Sending hadiah status:`, {
            available: hadiahState.hadiahAvailable,
            stock_count: hadiahState.stockCount
          });
          
          // Create response object
          const response = {
            available: hadiahState.hadiahAvailable,
            stock_count: hadiahState.stockCount
          };
          
          // Validate response format
          const responseValidation = validateResponse(
            HADIAH_API_SPEC_ID,
            'get_hadiah_status',
            response
          );
          
          if (!responseValidation.isValid) {
            console.error('[Remote API] Invalid response format:', responseValidation.errors);
          }
          
          return {
            statusCode: 1, // Success
            body: JSON.stringify(response)
          };
        } catch (error) {
          console.error('[Remote API] Error in get_hadiah_status:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              success: false, 
              error: 'Internal server error' 
            })
          };
        }
      }
    };
  }
  
  /**
   * Handler for 'start_recording' endpoint
   * Begins recording session and returns unique ID
   */
  private handleStartRecording(request: RemoteApiRequest): RemoteApiRequestHandler {
    return {
      send: () => {
        try {
          const scene = request.parameters.scene || 'unknown';
          const timestamp = Date.now();
          const recordingId = `rec_${timestamp}_${Math.floor(Math.random() * 10000)}`;
          
          console.log(`[Remote API] Starting recording for scene ${scene}, ID: ${recordingId}`);
          
          // Update global state if available
          if (globalStateRef?.current) {
            // Store recording ID in global state
            globalStateRef.current.recordingId = recordingId;
            
            // Call update method if it exists
            if (typeof globalStateRef.current.setRecordingId === 'function') {
              globalStateRef.current.setRecordingId(recordingId);
            }
            
            // Store scene info
            globalStateRef.current.currentScene = scene;
            if (typeof globalStateRef.current.setCurrentScene === 'function') {
              globalStateRef.current.setCurrentScene(scene);
            }
            
            // Store timestamp
            globalStateRef.current.recordingStartTime = timestamp;
          }
          
          // Also store in window for backup
          (window as any).currentRecordingId = recordingId;
          (window as any).currentScene = scene;
          
          // Create response
          const response = {
            recording_id: recordingId,
            success: true,
            timestamp
          };
          
          return {
            statusCode: 1, // Success
            body: JSON.stringify(response),
            metadata: {
              scene,
              timestamp: timestamp.toString()
            }
          };
        } catch (error) {
          console.error('[Remote API] Error in start_recording:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              success: false, 
              error: 'Internal server error'
            })
          };
        }
      }
    };
  }
  
  /**
   * Handler for 'stop_recording' endpoint
   * Finalizes recording and saves score
   */
  private handleStopRecording(request: RemoteApiRequest): RemoteApiRequestHandler {
    return {
      send: () => {
        try {
          // Extract parameters
          const scene = request.parameters.scene || '';
          const recordingId = request.parameters.recording_id || '';
          const scoreStr = request.parameters.score || '0';
          const score = parseInt(scoreStr, 10);
          
          console.log(`[Remote API] Stopping recording: ID=${recordingId}, score=${score}, scene=${scene}`);
          
          // Parse any JSON body data if available
          let bodyData = {};
          if (request.body && request.body.byteLength > 0) {
            try {
              const textDecoder = new TextDecoder();
              const jsonString = textDecoder.decode(request.body);
              bodyData = JSON.parse(jsonString);
              console.log('[Remote API] Request body data:', bodyData);
            } catch (bodyError) {
              console.warn('[Remote API] Failed to parse request body:', bodyError);
            }
          }
          
          // Validate recording ID matches stored value
          const storedRecordingId = globalStateRef?.current?.recordingId || 
                                  (window as any).currentRecordingId;
                                  
          if (recordingId && storedRecordingId && recordingId !== storedRecordingId) {
            console.warn(`[Remote API] Recording ID mismatch: ${recordingId} vs ${storedRecordingId}`);
          }
          
          // Update global state if available
          if (globalStateRef?.current) {
            // Update score
            globalStateRef.current.currentScore = score;
            if (typeof globalStateRef.current.setScore === 'function') {
              globalStateRef.current.setScore(score);
            }
            
            // Clear recording ID
            globalStateRef.current.recordingId = null;
            if (typeof globalStateRef.current.setRecordingId === 'function') {
              globalStateRef.current.setRecordingId(null);
            }
            
            // Store recording end time
            globalStateRef.current.recordingEndTime = Date.now();
            
            // Calculate duration if possible
            if (globalStateRef.current.recordingStartTime) {
              const durationMs = Date.now() - globalStateRef.current.recordingStartTime;
              globalStateRef.current.recordingDuration = Math.round(durationMs / 1000);
              console.log(`[Remote API] Recording duration: ${globalStateRef.current.recordingDuration}s`);
            }
          }
          
          // Also clear window backup
          (window as any).currentRecordingId = null;
          
          // Create success response
          const response = {
            success: true,
            score,
            recording_id: recordingId || storedRecordingId || null,
            processed_at: Date.now()
          };
          
          return {
            statusCode: 1, // Success
            body: JSON.stringify(response),
            metadata: {
              scene,
              score: score.toString()
            }
          };
        } catch (error) {
          console.error('[Remote API] Error in stop_recording:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({ 
              success: false, 
              error: 'Internal server error' 
            })
          };
        }
      }
    };
  }
  
  /**
   * Check if service is ready to handle requests
   */
  isReady(): boolean {
    return globalStateRef !== null;
  }
  
  /**
   * Get current state for debugging
   */
  getDebugInfo(): any {
    return {
      serviceReady: this.isReady(),
      hasGlobalRef: globalStateRef !== null,
      hasContext: globalStateRef?.current !== undefined,
      apiSpecId: this.apiSpecId,
      timestamp: Date.now()
    };
  }
}

// Create singleton instance
export const remoteApiService = new CameraKitRemoteApiService();

// Debug helper function
export function debugRemoteApi(): string {
  return JSON.stringify(remoteApiService.getDebugInfo(), null, 2);
}