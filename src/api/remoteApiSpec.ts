// src/api/remoteApiSpec.ts

/**
 * Remote API Specification
 * Based on configuration from Lens Studio
 */

// API Spec IDs - match exactly with Lens Studio configuration
export const HADIAH_API_SPEC_ID = '1449890e-5eed-4797-8be9-8941ad055157';
export const RECORDING_API_SPEC_ID = '554881fc-8ced-405b-bfea-f229c5dd9a4f';

// Parameter location types
export type ParamLocation = 'QUERY' | 'BODY' | 'PATH' | 'HEADER';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Parameter definition
export interface RemoteApiParameter {
  name: string;
  type: string;
  location: ParamLocation;
  required: boolean;
  constant: boolean;
  description: string;
  defaultValue?: string;
}

// Response property definition
export interface ResponseProperty {
  type: string;
  description: string;
  required?: boolean;
}

// Endpoint definition
export interface RemoteApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  description: string;
  parameters: RemoteApiParameter[];
  response: {
    type: string;
    properties: Record<string, ResponseProperty>;
  };
  previewUrl?: string;
}

// Full API spec definition
export interface RemoteApiSpec {
  apiSpecId: string;
  name: string;
  provider: string;
  description: string;
  host: string;
  maxRequestSize: number;
  maxResponseSize: number;
  maxResponseTime: number;
  endpoints: RemoteApiEndpoint[];
  version?: number;
  visibility?: 'PUBLIC' | 'PRIVATE';
  allowedUsers?: string[];
  snapKitAppId?: string;
}

/**
 * Complete API Specification from Lens Studio configuration
 */
export const REMOTE_API_SPECS: RemoteApiSpec[] = [
  {
    apiSpecId: HADIAH_API_SPEC_ID,
    name: 'Hadiah Status API',
    provider: 'Netramaya',
    description: 'API untuk mengecek status hadiah dan game state',
    host: 'smile-meter-offline-v2.vercel.app',
    version: 4,
    visibility: 'PRIVATE',
    maxRequestSize: 1000,
    maxResponseSize: 1000,
    maxResponseTime: 3000,
    allowedUsers: ['noorbagus', 'nugrohoroyd'],
    snapKitAppId: '6c331dfc-3713-40b6-a3f6-3976957e92da',
    endpoints: [
      {
        id: 'get_hadiah_status',
        method: 'GET',
        path: 'api/game/hadiah-status',
        description: 'Mengecek ketersediaan hadiah',
        parameters: [],
        response: {
          type: 'object',
          properties: {
            available: { type: 'boolean', description: 'Ketersediaan hadiah' },
            stock_count: { type: 'number', description: 'Jumlah hadiah yang tersisa' }
          }
        },
        previewUrl: 'https://smile-meter-offline-v2.vercel.app/api/game/hadiah-status'
      }
    ]
  },
  {
    apiSpecId: RECORDING_API_SPEC_ID,
    name: 'Recording Control API',
    provider: 'Netramaya',
    description: 'API untuk mengontrol recording video saat game AR berlangsung. Digunakan untuk start/stop recording dari Lens ke Camera Kit.',
    host: 'smile-meter-offline-v2.vercel.app',
    version: 2,
    visibility: 'PRIVATE',
    maxRequestSize: 1000,
    maxResponseSize: 1000,
    maxResponseTime: 3000,
    allowedUsers: ['noorbagus', 'nugrohoroyd'],
    snapKitAppId: '6c331dfc-3713-40b6-a3f6-3976957e92da',
    endpoints: [
      {
        id: 'start_recording',
        method: 'POST',
        path: 'api/recording/start',
        description: 'Memulai perekaman dan mendapatkan ID unik',
        parameters: [
          {
            name: 'scene',
            type: 'string',
            location: 'QUERY',
            required: true,
            constant: false,
            description: 'Scene identifier'
          }
        ],
        response: {
          type: 'object',
          properties: {
            recording_id: { type: 'string', description: 'ID perekaman unik' },
            success: { type: 'boolean', description: 'Status keberhasilan' }
          }
        },
        previewUrl: 'https://smile-meter-offline-v2.vercel.app/api/recording/start?scene=<scene>'
      },
      {
        id: 'stop_recording',
        method: 'POST',
        path: 'api/recording/stop',
        description: 'Mengakhiri perekaman dengan data skor',
        parameters: [
          {
            name: 'scene',
            type: 'string',
            location: 'QUERY',
            required: true,
            constant: false,
            description: 'Scene identifier'
          },
          {
            name: 'recording_id',
            type: 'string',
            location: 'BODY',
            required: false,
            constant: false,
            description: 'ID dari perekaman yang dimulai'
          },
          {
            name: 'score',
            type: 'number',
            location: 'BODY',
            required: false,
            constant: false,
            description: 'Nilai skor akhir'
          }
        ],
        response: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Status keberhasilan' }
          }
        },
        previewUrl: 'https://smile-meter-offline-v2.vercel.app/api/recording/stop?scene=<scene>'
      }
    ]
  }
];

/**
 * Helper Functions
 */

// Get API spec by ID
export function getApiSpec(apiSpecId: string): RemoteApiSpec | undefined {
  return REMOTE_API_SPECS.find(spec => spec.apiSpecId === apiSpecId);
}

// Get endpoint by API ID and endpoint ID
export function getEndpoint(apiSpecId: string, endpointId: string): RemoteApiEndpoint | undefined {
  const apiSpec = getApiSpec(apiSpecId);
  if (!apiSpec) return undefined;
  
  return apiSpec.endpoints.find(endpoint => endpoint.id === endpointId);
}

// Validate request parameters against API spec
export function validateRequest(apiSpecId: string, endpointId: string, parameters: Record<string, string>): {
  isValid: boolean;
  errors: string[];
} {
  const endpoint = getEndpoint(apiSpecId, endpointId);
  if (!endpoint) {
    return { isValid: false, errors: [`Unknown endpoint: ${endpointId} in API spec: ${apiSpecId}`] };
  }
  
  const errors: string[] = [];
  
  // Check required parameters
  endpoint.parameters
    .filter(param => param.required)
    .forEach(param => {
      if (parameters[param.name] === undefined) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    });
  
  // Check parameter types (basic validation)
  endpoint.parameters.forEach(param => {
    const value = parameters[param.name];
    if (value !== undefined) {
      if (param.type === 'number' && isNaN(Number(value))) {
        errors.push(`Parameter ${param.name} must be a number`);
      }
      if (param.type === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
        errors.push(`Parameter ${param.name} must be a boolean`);
      }
    }
  });
  
  return { 
    isValid: errors.length === 0,
    errors
  };
}

// Validate response against API spec
export function validateResponse(apiSpecId: string, endpointId: string, response: any): {
  isValid: boolean;
  errors: string[];
} {
  const endpoint = getEndpoint(apiSpecId, endpointId);
  if (!endpoint) {
    return { isValid: false, errors: [`Unknown endpoint: ${endpointId} in API spec: ${apiSpecId}`] };
  }
  
  const errors: string[] = [];
  
  // Check response properties
  Object.entries(endpoint.response.properties).forEach(([key, property]) => {
    if (property.required && response[key] === undefined) {
      errors.push(`Missing required response property: ${key}`);
    }
    
    if (response[key] !== undefined) {
      const valueType = typeof response[key];
      if (property.type === 'number' && valueType !== 'number') {
        errors.push(`Response property ${key} should be a number`);
      }
      if (property.type === 'boolean' && valueType !== 'boolean') {
        errors.push(`Response property ${key} should be a boolean`);
      }
      if (property.type === 'string' && valueType !== 'string') {
        errors.push(`Response property ${key} should be a string`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Get full URL for endpoint
export function getEndpointUrl(apiSpecId: string, endpointId: string, parameters?: Record<string, string>): string {
  const endpoint = getEndpoint(apiSpecId, endpointId);
  const apiSpec = getApiSpec(apiSpecId);
  
  if (!endpoint || !apiSpec) return '';
  
  let url = `https://${apiSpec.host}/${endpoint.path}`;
  
  // Add query parameters
  if (parameters) {
    const queryParams = endpoint.parameters
      .filter(param => param.location === 'QUERY' && parameters[param.name] !== undefined)
      .map(param => `${param.name}=${encodeURIComponent(parameters[param.name])}`);
    
    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }
  }
  
  return url;
}

// Export full API spec as JSON for documentation
export function exportSpecToJson(): string {
  return JSON.stringify(REMOTE_API_SPECS, null, 2);
}

// Create a lens-compatible remote API definition
export function createLensRemoteApiDefinition(): string {
  const definition = REMOTE_API_SPECS.map(spec => ({
    name: spec.name,
    api_spec_id: spec.apiSpecId,
    endpoints: spec.endpoints.map(endpoint => ({
      id: endpoint.id,
      reference_id: endpoint.id,
      path: endpoint.path,
      method: endpoint.method
    }))
  }));
  
  return JSON.stringify(definition, null, 2);
}