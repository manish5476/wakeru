// app/+not-found.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Oops!',
          headerShown: false,
        }}
      />
      {/* 404 Illustration */}
      <View className="flex-1 justify-center items-center bg-surface-0 px-8">
        <View className="items-center gap-6 mb-10">
          {/* Large 404 number */}
          <Text className="text-8xl font-bold text-brand-primary font-display opacity-80">
            404
          </Text>
          {/* Decorative element */}
          <View className="w-16 h-1 bg-brand-primary rounded-full" />

          {/* Message */}
          <Text className="text-2xl font-bold text-text-primary font-display text-center">
            Lost your way?
          </Text>
          <Text className="text-base text-text-tertiary font-sans text-center leading-relaxed max-w-[280px]">
            This page seems to have wandered off the map. Let's get you back on track.
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="gap-4 w-full max-w-[280px]">
          {/* Go Home */}
          <Link href="/" asChild>
            <TouchableOpacity
              className="h-14 bg-brand-primary rounded-full items-center justify-center shadow-lg shadow-brand-primary/25 active:scale-[0.98] transition-transform"
              accessibilityLabel="Go to home page" >
              <Text className="text-sm font-bold text-white font-sans tracking-wide">
                Back to Home
              </Text>
            </TouchableOpacity>
          </Link>

          {/* Go Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-14 border-2 border-border-default rounded-full items-center justify-center active:scale-[0.98] transition-transform hover:border-brand-primary"
            accessibilityLabel="Go back to previous page"
          >
            <Text className="text-sm font-semibold text-text-primary font-sans">
              Go Back
            </Text>
          </TouchableOpacity>
        </View>

        {/* Help Link */}
        <TouchableOpacity className="mt-8 py-2">
          <Text className="text-xs text-text-quaternary font-sans underline">
            Need help? Contact Support
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}