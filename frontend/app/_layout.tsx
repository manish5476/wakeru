import '../global.css';

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../src/features/auth/authStore';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { Toaster } from 'sonner';
import { Platform } from 'react-native';

export default function RootLayout() {
  const { hydrate, isLoading } = useAuthStore();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    hydrate();
  }, []);

  // Hide splash screen when fonts are loaded and hydration is done
  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (isLoading || !fontsLoaded) {
    return null; // Or a nice custom splash screen
  }

  return (
    <QueryClientProvider client={queryClient}>
      {Platform.OS === 'web' && <Toaster position="top-center" richColors />}
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { token, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (token) {
      // Hide splash once we know auth state
      SplashScreen.hideAsync();
      
      // If user is authenticated and tries to access auth screens, redirect to tabs
      if (inAuthGroup || (segments as string[]).length === 0) {
        router.replace('/(tabs)');
      }
    } else {
      SplashScreen.hideAsync();
      
      // If not authenticated and NOT already in auth group, force redirect to login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    }
  }, [token, segments, isLoading]);
  
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="groups/create"
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modal"
          options={{
            title: 'Welcome',
            presentation: 'modal',
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
