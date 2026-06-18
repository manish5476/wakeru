import { View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../src/features/auth/authStore';

export default function Home() {
  const { logout } = useAuthStore();

  return (
    <View className="flex-1 items-center justify-center bg-surface-0">
      <View className="glass-card p-8 items-center max-w-sm w-full mx-4">
        <Text className="heading-2 text-brand-primary mb-4">Welcome back!</Text>
        <Text className="body-default text-text-secondary mb-8 text-center">
          You have successfully logged in. This is your fresh, clean dashboard.
        </Text>
        
        <TouchableOpacity 
          className="btn-primary w-full h-12 flex items-center justify-center"
          onPress={() => logout()}
        >
          <Text className="text-white font-semibold text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
