// app/index.tsx
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../src/features/auth/authStore';

export default function Index() {
  const { token } = useAuthStore();

  return (
    <View className="flex-1 justify-center items-center bg-surface-0">
      {/* Animated logo or branding */}
      <View className="items-center gap-6 animate-fade-in">
        {/* Logo placeholder */}
        <View className="w-20 h-20 rounded-2xl bg-brand-primary items-center justify-center shadow-lg shadow-brand-primary/30">
          <Text className="text-3xl text-white font-bold font-display">TS</Text>
        </View>
        
        {/* Brand name */}
        <Text className="text-2xl font-bold text-text-primary font-display tracking-tight">
          TripSplit
        </Text>
        
        {/* Loading indicator */}
        <View className="flex-row items-center gap-3 mt-4">
          <ActivityIndicator size="small" color="#DE6B48" />
          <Text className="text-sm text-text-tertiary font-sans">
            {token ? 'Loading your journeys...' : 'Preparing your adventure...'}
          </Text>
        </View>
      </View>
    </View>
  );
}
// import { View, ActivityIndicator } from 'react-native';

// export default function Index() {
//   // The actual routing logic is handled securely in app/_layout.tsx inside the RootLayoutNav useEffect.
//   // This screen just renders a loader until the redirect happens.
//   return (
//     <View className="flex-1 justify-center items-center bg-background">
//       <ActivityIndicator size="large" className="text-primary" />
//     </View>
//   );
// }
