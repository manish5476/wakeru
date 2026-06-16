import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface User {
  userId: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  upiId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setSession: (user: User, token: string) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true, // true initially until we try to hydrate

  setSession: async (user, token) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
      } else {
        await SecureStore.setItemAsync('auth_token', token);
        await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
      }
      set({ user, token });
    } catch (error) {
      console.error('Failed to save session securely', error);
    }
  },

  clearSession: async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      } else {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('auth_user');
      }
      set({ user: null, token: null });
    } catch (error) {
      console.error('Failed to clear session securely', error);
    }
  },

  hydrate: async () => {
    try {
      let token: string | null = null;
      let userStr: string | null = null;

      if (Platform.OS === 'web') {
        token = localStorage.getItem('auth_token');
        userStr = localStorage.getItem('auth_user');
      } else {
        token = await SecureStore.getItemAsync('auth_token');
        userStr = await SecureStore.getItemAsync('auth_user');
      }

      if (token && userStr) {
        set({ user: JSON.parse(userStr), token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to hydrate session', error);
      set({ isLoading: false });
    }
  }
}));
