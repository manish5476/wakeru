import 'react-native-gesture-handler';
// app/_layout.tsx
import '../global.css';

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../src/features/auth/authStore';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner';
import { Platform } from 'react-native';

// Fonts
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';

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

// Create a QueryClient with enterprise-grade defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: Platform.OS === 'web' ? 3 : 2,
      refetchOnWindowFocus: Platform.OS === 'web',
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: 2,
    },
  },
});

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
  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  useEffect(() => {
    if (fontError) {
      console.error('Font loading error:', fontError);
      SplashScreen.hideAsync();
    }
  }, [fontError]);
  if (isLoading || !fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {/* Toast notifications for web */}
        {Platform.OS === 'web' && (
          <Toaster
            position="top-center"
            richColors
            expand={false}
            duration={4000}
          />
        )}
        <RootLayoutNav />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { token, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Handle auth-based navigation
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (token) {
      // Authenticated user: redirect away from auth screens
      if (inAuthGroup || !segments[0]) {
        router.replace('/(app)');
      }
    } else {
      // Unauthenticated user: redirect to login
      if (!inAuthGroup && segments[0] !== undefined) {
        router.replace('/(auth)/login');
      }
    }
  }, [token, segments, isLoading]);

  // Custom theme based on design system
  const CustomLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#DE6B48',
      background: '#FDFCFB',
      card: '#FFFFFF',
      text: '#1C1917',
      border: '#E7E5E4',
      notification: '#DE6B48',
    },
  };

  const CustomDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#F97316',
      background: '#0F172A',
      card: '#1E293B',
      text: '#F8FAFC',
      border: '#334155',
      notification: '#F97316',
    },
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FDFCFB',
          },
          animation: 'fade',
          animationDuration: 200,
        }}
      >
        {/* Auth Group */}
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />

        {/* App Group */}
        <Stack.Screen
          name="(app)"
          options={{
            headerShown: false,
          }}
        />

        {/* Not Found Screen */}
        <Stack.Screen
          name="+not-found"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
