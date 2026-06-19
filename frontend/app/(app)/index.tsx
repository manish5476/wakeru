import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../src/features/auth/authStore';

export default function TripsDashboard() {
  const { clearSession } = useAuthStore();

  return (
    <View className="flex-1 items-center justify-center bg-background p-4">
      <Text className="text-2xl font-bold text-text mb-8">Trips Dashboard</Text>
      <Text className="text-base text-textMuted text-center mb-8">  Welcome to Wakeru! Your trips will appear here.  </Text>
      <TouchableOpacity onPress={clearSession} className="bg-primary px-6 py-3 rounded-full"      >
        <Text className="text-white font-semibold">Log out</Text>
      </TouchableOpacity>
    </View>
  );
}
