import React from 'react';
import { View, Text, ImageBackground, Platform, ScrollView, useWindowDimensions } from 'react-native';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  isLogin?: boolean;
}

export default function AuthLayout({ children, title, subtitle, isLogin = false }: AuthLayoutProps) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width > 768;

  if (isWeb) {
    return (
      <View className="flex-1 flex-row bg-auth-dark">
        {/* Left Side: Hero Image / Gradient */}
        <View className="flex-1 bg-auth-webBg p-12 justify-center">
          <View className="max-w-md ml-auto mr-12">
            <Text className="text-white text-5xl font-bold mb-4">
              {isLogin ? "Welcome Back to Wakeru" : "Get Started with Us"}
            </Text>
            <Text className="text-gray-300 text-lg mb-12">
              {isLogin 
                ? "Sign in to manage your trips, track expenses, and settle up easily." 
                : "Complete these easy steps to register your account and start splitting expenses seamlessly."}
            </Text>

            {!isLogin && (
              <View className="flex-row gap-4 mt-8">
                <View className="bg-white/10 p-6 rounded-2xl flex-1 border border-white/20">
                  <View className="w-8 h-8 rounded-full bg-white items-center justify-center mb-4">
                    <Text className="text-auth-webBg font-bold text-xs">1</Text>
                  </View>
                  <Text className="text-white font-medium">Sign up your account</Text>
                </View>
                <View className="bg-white/5 p-6 rounded-2xl flex-1 border border-white/10">
                  <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center mb-4">
                    <Text className="text-white font-bold text-xs">2</Text>
                  </View>
                  <Text className="text-white/60 font-medium">Set up your profile</Text>
                </View>
                <View className="bg-white/5 p-6 rounded-2xl flex-1 border border-white/10">
                  <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center mb-4">
                    <Text className="text-white font-bold text-xs">3</Text>
                  </View>
                  <Text className="text-white/60 font-medium">Create your trip</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Right Side: Auth Form */}
        <View className="flex-1 justify-center items-center bg-auth-dark p-8">
          <View className="w-full max-w-md">
            {children}
          </View>
        </View>
      </View>
    );
  }

  // Mobile View
  return (
    <View className="flex-1 bg-auth-mobileBg">
      <ImageBackground 
        source={require('../../assets/images/auth-leaves.png')}
        className="w-full h-[40vh] justify-center items-center"
        imageStyle={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
      >
        <View className="absolute inset-0 bg-black/20" />
        <View className="px-6 w-full mt-10">
          <Text className="text-white text-4xl font-bold drop-shadow-md">
            The best app for
          </Text>
          <Text className="text-white text-4xl font-bold mt-1 drop-shadow-md">
            your trips
          </Text>
        </View>
      </ImageBackground>

      <View className="flex-1 bg-auth-mobileBg -mt-8 rounded-t-[40px] px-6 pt-10 shadow-lg">
        <Text className="text-3xl font-bold text-auth-mobileBtn text-center mb-2">
          {title}
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          {subtitle}
        </Text>
        
        {children}
      </View>
    </View>
  );
}
