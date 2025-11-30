import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Configuration from Environment Variables
// These can be set in a .env file or through Expo's environment variables
// See .env.example for configuration options

// Production API URL (full URL including protocol)
// Example: https://api.agribooks.com/api
// Must be set via EXPO_PUBLIC_API_URL environment variable in production
const PRODUCTION_API_URL = process.env.EXPO_PUBLIC_API_URL || '';

// Development API Configuration
// Host: Your computer's IP address for physical device testing
// Port: Backend server port (default: 3001)
const DEV_API_HOST = process.env.EXPO_PUBLIC_API_HOST || 'localhost';
const DEV_API_PORT = process.env.EXPO_PUBLIC_API_PORT || '3001';
const IS_ANDROID_EMULATOR = process.env.EXPO_PUBLIC_ANDROID_EMULATOR === 'true';

/**
 * Get the appropriate API URL based on environment
 * 
 * Development:
 * - If EXPO_PUBLIC_API_URL is set, uses it (allows testing against production API)
 * - Otherwise: iOS Simulator uses localhost, Android Emulator uses 10.0.2.2, Physical Device uses EXPO_PUBLIC_API_HOST
 * 
 * Production:
 * - Uses EXPO_PUBLIC_API_URL (REQUIRED in production)
 * - Throws error if not set to prevent security issues
 */
const getApiUrl = (): string => {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  
  // If production API URL is explicitly set, use it (works in both dev and production)
  if (envApiUrl && envApiUrl.trim() !== '') {
    let url = envApiUrl.trim();
    
    // Remove trailing slashes to avoid double slashes
    url = url.replace(/\/+$/, '');
    
    // Validate protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.warn('⚠️ EXPO_PUBLIC_API_URL missing protocol, defaulting to https://');
      url = `https://${url}`;
    }
    
    // Ensure it ends with /api (but not /api/)
    if (url.endsWith('/api/')) {
      url = url.slice(0, -1); // Remove trailing slash after /api
    } else if (!url.endsWith('/api')) {
      url = `${url}/api`;
    }
    
    return url;
  }
  
  // Production mode - strict validation (only if EXPO_PUBLIC_API_URL not set)
  if (!__DEV__) {
    const errorMessage = '❌ CRITICAL: EXPO_PUBLIC_API_URL must be set for production builds. ' +
      'Production builds cannot use development configuration for security reasons. ' +
      'Please set EXPO_PUBLIC_API_URL in your .env file or build configuration before building. ' +
      'Example: EXPO_PUBLIC_API_URL=https://getbk.xyz';
    console.error(errorMessage);
    throw new Error('EXPO_PUBLIC_API_URL is required for production builds');
  }
  
  // Development mode only (when EXPO_PUBLIC_API_URL is not set)
  // Check if we're in an Android emulator
  if (IS_ANDROID_EMULATOR) {
    return `http://10.0.2.2:${DEV_API_PORT}/api`; // Android emulator uses 10.0.2.2 for host
  }
  
  // For physical device or iOS simulator, use configured host
  // For iOS Simulator, localhost works, but using IP also works for physical devices
  return `http://${DEV_API_HOST}:${DEV_API_PORT}/api`;
};

const API_BASE_URL = getApiUrl();

// Log API configuration in development
if (__DEV__) {
  console.log('🌐 API Configuration:', {
    baseURL: API_BASE_URL,
    host: DEV_API_HOST,
    port: DEV_API_PORT,
    isAndroidEmulator: IS_ANDROID_EMULATOR,
    productionUrl: PRODUCTION_API_URL || 'not set',
  });
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const userId = await SecureStore.getItemAsync('userId');
        if (userId && config.headers) {
          config.headers['x-user-id'] = userId;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error
          const statusCode = error.response.status;
          const responseData = error.response.data as { error?: string; code?: string };
          let message = responseData?.error || 'An error occurred';
          
          // Handle authentication errors specifically
          if (statusCode === 401 || statusCode === 403) {
            if (message.includes('Authentication required') || message.includes('x-user-id')) {
              message = __DEV__
                ? `Authentication Error: ${message}\n\nPlease ensure you are logged in.`
                : 'Authentication required. Please log in again.';
            } else if (message.includes('User not found')) {
              message = __DEV__
                ? `Authentication Error: ${message}\n\nYour user session may have expired. Please log in again.`
                : 'Session expired. Please log in again.';
            } else {
              message = __DEV__
                ? `Authentication Error (${statusCode}): ${message}`
                : 'Authentication failed. Please log in again.';
            }
          }
          
          return Promise.reject(new Error(message));
        } else if (error.request) {
          // Request made but no response (network error, timeout, etc.)
          let errorMessage: string;
          
          // Check for timeout
          if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage = __DEV__
              ? `Request timeout. The server at ${API_BASE_URL.replace('/api', '')} is not responding.`
              : 'Request timeout. Please check your connection and try again.';
          } else if (error.code === 'ENOTFOUND' || error.message.includes('getaddrinfo')) {
            // DNS resolution failed
            errorMessage = __DEV__
              ? `Cannot resolve host. Check if ${API_BASE_URL.replace('/api', '')} is correct.`
              : 'Cannot connect to server. Please check your connection.';
          } else if (error.code === 'ECONNREFUSED') {
            // Connection refused
            errorMessage = __DEV__
              ? `Connection refused. Check if backend is running on ${API_BASE_URL.replace('/api', '')}`
              : 'Cannot connect to server. Please check your connection.';
          } else {
            // Generic network error
            errorMessage = __DEV__
              ? `Network error. Check if backend is running on ${API_BASE_URL.replace('/api', '')}`
              : 'Network error. Please check your connection.';
          }
          
          console.error('❌ API Error:', {
            message: errorMessage,
            url: API_BASE_URL,
            error: error.message,
            code: error.code,
            request: error.request?.url || 'unknown',
          });
          return Promise.reject(new Error(errorMessage));
        } else {
          // Something else happened (configuration error, etc.)
          console.error('❌ API Configuration Error:', error.message);
          return Promise.reject(error);
        }
      }
    );
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  async postMultipart<T>(url: string, formData: FormData): Promise<T> {
    const userId = await SecureStore.getItemAsync('userId');
    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(userId && { 'x-user-id': userId }),
      },
    });
    return response.data;
  }

  async putMultipart<T>(url: string, formData: FormData): Promise<T> {
    const userId = await SecureStore.getItemAsync('userId');
    const response = await this.client.put<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(userId && { 'x-user-id': userId }),
      },
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
