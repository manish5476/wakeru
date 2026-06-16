import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { useAuthStore } from '../authStore';
import apiClient from '../../../services/api-client';
import { Alert } from 'react-native';

// Necessary for WebBrowser auth sessions to resolve correctly
WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuth = () => {
  const setSession = useAuthStore((state) => state.setSession);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    // You MUST provide these in the .env file for the respective platforms!
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;

      const credential = GoogleAuthProvider.credential(id_token);

      signInWithCredential(auth, credential)
        .then(async (userCredential) => {
          // Get the real Firebase token
          const token = await userCredential.user.getIdToken();

          // Send it to the backend to create/login the user in MongoDB
          try {
            const apiResponse = await apiClient.post('/auth/login', { idToken: token });
            if (apiResponse.data?.success && apiResponse.data?.data) {
              setSession(apiResponse.data.data.user, apiResponse.data.data.tokens.accessToken);
            }
          } catch (error: any) {
            console.log('Backend sync failed:', error);
            // If user doesn't exist, try register endpoint
            if (error.response?.status === 404) {
              const registerResponse = await apiClient.post('/auth/register', { idToken: token });
              if (registerResponse.data?.success && registerResponse.data?.data) {
                setSession(registerResponse.data.data.user, registerResponse.data.data.tokens.accessToken);
              }
            } else {
              Alert.alert('Google Sign-In Failed', 'Could not sync with backend database.');
            }
          }
        })
        .catch((error) => {
          console.error("Firebase Auth Error:", error);
          Alert.alert('Google Sign-In Failed', error.message);
        });
    }
  }, [response]);

  return {
    signInWithGoogle: () => {
      promptAsync();
    },
    isReady: !!request
  };
};
