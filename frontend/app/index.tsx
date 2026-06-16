import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  // The actual routing logic is handled securely in app/_layout.tsx inside the RootLayoutNav useEffect.
  // This screen just renders a loader until the redirect happens.
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <ActivityIndicator size="large" className="text-primary" />
    </View>
  );
}
