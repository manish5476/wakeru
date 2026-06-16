import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function TabOneScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center items-center bg-background">
      <Text className="text-2xl font-bold text-text mb-4">Home Tab</Text>

      {/* Temporary Floating Action Button for Group Creation */}
      <TouchableOpacity
        onPress={() => router.push('/groups/create')}
        className="absolute bottom-6 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-lg active:opacity-80"
      >
        <Text className="text-white text-3xl font-bold">+</Text>
      </TouchableOpacity>
    </View>
  );
}
