import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 justify-center items-center bg-background p-4">
        <Text className="text-2xl font-bold text-text">This screen doesn't exist.</Text>
        <Link href="/" asChild>
          <TouchableOpacity className="mt-4 p-4">
            <Text className="text-primary font-bold">Go to home screen!</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}
