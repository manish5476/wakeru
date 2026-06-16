import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Dynamically resolve BaseURL for Web, Android Emulator, or iOS/Physical
// Note: 10.0.2.2 is the alias to the host loopback interface for Android Emulator
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  
  return 'http://localhost:8000/api/v1';
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Inject JWT if available and add Idempotency-Key
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // For web, SecureStore falls back to localStorage/cookies depending on implementation,
      // but in Expo web it throws if not polyfilled. We wrap in try/catch.
      const token = Platform.OS === 'web' 
        ? localStorage.getItem('auth_token') 
        : await SecureStore.getItemAsync('auth_token');

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add Idempotency-Key for mutation operations
      if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
        config.headers['Idempotency-Key'] = Crypto.randomUUID();
      }
    } catch (error) {
      console.warn('Failed to retrieve token for request:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

import { useAuthStore } from '../features/auth/authStore';

// Response Interceptor: Catch 401 Unauthorized globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Handle token expiration/invalid token
      console.log('Session expired. Wiping tokens and redirecting to login...');
      
      try {
        if (Platform.OS === 'web') {
          localStorage.removeItem('auth_token');
        } else {
          await SecureStore.deleteItemAsync('auth_token');
        }
      } catch (err) {
        console.warn('Failed to wipe tokens:', err);
      }

      // Immediately log the user out globally via Zustand, which will trigger the Router redirect
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
