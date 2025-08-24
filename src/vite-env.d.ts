/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Camera Kit
  readonly VITE_CAMERA_KIT_API_TOKEN: string
  readonly VITE_CAMERA_KIT_LENS_ID: string
  readonly VITE_CAMERA_KIT_LENS_GROUP_ID: string
  
  // Snapchat OAuth for Push2Web
  readonly VITE_SNAPCHAT_CLIENT_ID: string
  readonly VITE_SNAPCHAT_REDIRECT_URI: string
  
  // Debug
  readonly VITE_DEBUG_CAMERA_KIT: string
  readonly VITE_DEBUG_LOGS: string
  readonly VITE_MODE: string
  
  // Add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}