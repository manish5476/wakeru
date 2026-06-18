import { useMutation } from '@tanstack/react-query';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import apiClient from '../../../services/api-client';
import { useAuthStore } from '../authStore';
import { useRouter } from 'expo-router';

export const useRegisterMutation = () => {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (data: { email: string; password: string; name: string }) => {
      // 1. Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      // 2. Get the real Firebase ID Token
      const idToken = await userCredential.user.getIdToken();

      // 3. Send it to our backend to create the MongoDB user and get our custom JWTs
      const response = await apiClient.post('/auth/register', {
        idToken,
        metadata: {
          name: data.name,
          email: data.email,
        }
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        setSession(data.data.user, data.data.tokens.accessToken);
      }
    },
  });
};

export const useLoginMutation = () => {
  const setSession = useAuthStore((state) => state.setSession);
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      // 1. Sign in to Firebase
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      
      // 2. Get the real Firebase ID Token
      const idToken = await userCredential.user.getIdToken();

      // 3. Send it to our backend to get our custom JWTs
      const response = await apiClient.post('/auth/login', { idToken });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        setSession(data.data.user, data.data.tokens.accessToken);
        router.replace('/(app)');
      }
    },
  });
};

export const useForgotPasswordMutation = () => {
  return useMutation({
    mutationFn: async (data: { email: string }) => {
      await sendPasswordResetEmail(auth, data.email);
      return { success: true, message: 'Password reset email sent via Firebase' };
    },
  });
};
