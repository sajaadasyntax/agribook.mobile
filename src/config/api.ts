import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

// Physical Device Configuration
// Your computer's IP address for physical device testing
const PHYSICAL_DEVICE_IP = '192.168.0.129';
const API_PORT = 3001;

// Development configuration
// - For iOS Simulator: Uses localhost (works automatically)
// - For Android Emulator: Uses 10.0.2.2 (special IP for host machine)
// - For Physical Device: Uses your computer's IP address (192.168.0.129)
const getApiUrl = () => {
  if (!__DEV__) {
    return `https://${PHYSICAL_DEVICE_IP}:${API_PORT}/api`; // Production URL
  }
  
  // Check if we're in an Android emulator
  if (process.env.EXPO_PUBLIC_ANDROID_EMULATOR === 'true') {
    return `http://10.0.2.2:${API_PORT}/api`; // Android emulator uses 10.0.2.2 for host
  }
  
  // For physical device testing, use your computer's IP
  // Make sure your phone and computer are on the same WiFi network
  // For iOS Simulator, localhost works, but using IP also works for physical devices
  return `http://${PHYSICAL_DEVICE_IP}:${API_PORT}/api`;
};

const API_BASE_URL = getApiUrl();

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
          const message = (error.response.data as { error?: string })?.error || 'An error occurred';
          return Promise.reject(new Error(message));
        } else if (error.request) {
          // Request made but no response
          const errorMessage = __DEV__
            ? `Network error. Check if backend is running on ${API_BASE_URL.replace('/api', '')}`
            : 'Network error. Please check your connection.';
          console.error('❌ API Error:', {
            message: errorMessage,
            url: API_BASE_URL,
            error: error.message,
          });
          return Promise.reject(new Error(errorMessage));
        } else {
          // Something else happened
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
}

export const apiClient = new ApiClient();
export default apiClient;
