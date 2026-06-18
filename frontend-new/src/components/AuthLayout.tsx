import React from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <SafeAreaView className="flex-1 bg-surface-0">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Main Container: Stacked mobile, side-by-side on desktop */}
        <View className="flex-1 flex-col md:flex-row min-h-screen">

          {/* ── HERO SECTION ──────────────────────────── */}
          <View className="flex-[0.35] md:flex-[0.45] relative bg-neutral-900 overflow-hidden">
            {/* Background Image */}
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1542314831-c6a42032207b?q=80&w=2000&auto=format&fit=crop'
              }}
              className="absolute inset-0 w-full h-full opacity-85"
              resizeMode="cover"
            />

            {/* Gradient Overlays */}
            <View className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <View className="absolute inset-0 bg-gradient-to-r from-brand-primary/20 to-transparent" />

            {/* Top Brand Indicator */}
            <View className="absolute top-6 sm:top-8 md:top-10 left-6 sm:left-8 md:left-12">
              <View className="flex-row items-center bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 gap-2">
                <View className="w-2 h-2 rounded-full bg-brand-primary" />
                <Text className="text-white text-[11px] font-bold tracking-widest uppercase font-sans">
                  TripSplit
                </Text>
              </View>
            </View>

            {/* Brand Content */}
            <View className="absolute bottom-12 sm:bottom-16 md:bottom-auto md:top-1/2 md:-translate-y-1/2 left-6 sm:left-8 md:left-12 right-6 sm:right-8">
              <View className="animate-slide-up">
                {/* Main Heading */}
                <Text
                  className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 font-display tracking-tight"
                >
                  Split the journey,{'\n'}not the memories.
                </Text>

                {/* Subtitle */}
                <Text className="text-sm md:text-base text-white/80 font-medium leading-relaxed max-w-[320px] font-sans">
                  The most elegant way to track expenses and settle up across every destination.
                </Text>

                {/* Stats (Desktop only) */}
                <View className="hidden md:flex flex-row gap-8 mt-8">
                  <View className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <Text className="text-3xl text-white font-bold font-display">10k+</Text>
                    <Text className="text-sm text-white/70 font-sans">Active Travelers</Text>
                  </View>
                  <View className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                    <Text className="text-3xl text-white font-bold font-display">150+</Text>
                    <Text className="text-sm text-white/70 font-sans">Countries</Text>
                  </View>
                  <View className="animate-fade-in" style={{ animationDelay: '600ms' }}>
                    <Text className="text-3xl text-white font-bold font-display">4.9</Text>
                    <Text className="text-sm text-white/70 font-sans">User Rating</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Decorative Dots (Desktop) */}
            <View className="hidden md:flex absolute top-8 right-8 gap-2">
              {[...Array(9)].map((_, i) => (
                <View key={i} className="w-2 h-2 rounded-full bg-white/30" />
              ))}
            </View>
          </View>

          {/* ── FORM SECTION ─────────────────────────── */}
          <View className="flex-[0.65] md:flex-[0.55] bg-surface-1 md:bg-surface-0">
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="flex-1 justify-center px-6 sm:px-8 md:px-12 lg:px-16 py-8 md:py-0">
                {/* Mobile overlay card */}
                <View className="bg-surface-1 rounded-t-[40px] md:rounded-none -mt-10 md:mt-0 pt-10 md:pt-0 shadow-float md:shadow-none">
                  <View className="w-full max-w-[380px] mx-auto">

                    {/* Header */}
                    <View className="mb-8 md:mb-10 animate-fade-in">
                      <Text
                        className="text-3xl md:text-4xl font-bold text-text-primary mb-2 font-display tracking-tight"
                      >
                        {title}
                      </Text>
                      <Text className="text-sm md:text-base text-text-tertiary leading-relaxed font-sans">
                        {subtitle}
                      </Text>
                    </View>

                    {/* Form Content */}
                    <View className="animate-slide-up">
                      {children}
                    </View>

                  </View>
                </View>
              </View>
            </ScrollView>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
