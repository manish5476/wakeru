import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useLoginMutation } from '../../src/features/auth/hooks/useAuth';
import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';
import AuthLayout from '../../src/components/AuthLayout';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const loginMutation = useLoginMutation();
  const { signInWithGoogle, isReady } = useGoogleAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      await loginMutation.mutateAsync({ email, password });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'An error occurred during login.';
      Alert.alert('Login Failed', message);
    }
  };

  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Login to your account"
      isLogin={true}
    >
      <View className="w-full gap-4">
        <View>
          <Text className="text-sm font-semibold mb-2 text-auth-mobileText md:text-white/80">Email</Text>
          <TextInput 
            className="h-14 px-4 rounded-xl bg-auth-mobileInput md:bg-auth-webInput text-auth-mobileText md:text-white"
            placeholder="user@mail.com" 
            placeholderTextColor={Platform.OS === 'web' ? '#666' : '#999'}
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        <View>
          <Text className="text-sm font-semibold mb-2 text-auth-mobileText md:text-white/80">Password</Text>
          <TextInput 
            className="h-14 px-4 rounded-xl bg-auth-mobileInput md:bg-auth-webInput text-auth-mobileText md:text-white"
            placeholder="••••••••" 
            placeholderTextColor={Platform.OS === 'web' ? '#666' : '#999'}
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry
          />
        </View>

        <View className="flex-row justify-between items-center mt-2">
          <View className="flex-row items-center gap-2">
            <View className="w-5 h-5 rounded border border-gray-300 md:border-gray-600 items-center justify-center">
              <View className="w-3 h-3 bg-auth-mobileBtn md:bg-white rounded-sm" />
            </View>
            <Text className="text-sm text-gray-500 md:text-gray-400 font-medium">Remember Me</Text>
          </View>
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity className="active:opacity-70">
              <Text className="text-sm font-semibold text-auth-mobileText md:text-white/70">Forgot Password?</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <TouchableOpacity 
          className={`h-14 mt-6 rounded-full md:rounded-xl flex-row justify-center items-center ${loginMutation.isPending ? 'opacity-70' : ''} bg-auth-mobileBtn md:bg-white active:opacity-80`}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color={Platform.OS === 'web' ? '#000' : '#fff'} />
          ) : (
            <Text className="text-white md:text-black font-bold text-lg">Login</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4 gap-1">
          <Text className="text-gray-500 md:text-gray-400">Don't have an account?</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity className="active:opacity-70">
              <Text className="font-bold text-auth-mobileBtn md:text-white underline">Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View className="mt-8 gap-6">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-[1px] bg-gray-200 md:bg-white/10" />
            <Text className="text-gray-400 md:text-gray-500 font-medium text-sm">Or continue with</Text>
            <View className="flex-1 h-[1px] bg-gray-200 md:bg-white/10" />
          </View>

          <View className="flex-row gap-4 justify-center">
            <TouchableOpacity 
              className="w-14 h-14 rounded-full md:rounded-xl md:w-32 bg-white md:bg-auth-webInput border border-gray-200 md:border-white/10 justify-center items-center shadow-sm active:opacity-80 flex-row gap-2"
              onPress={() => signInWithGoogle()}
              disabled={!isReady}
            >
              <Text className="text-xl">G</Text>
              {Platform.OS === 'web' && <Text className="text-white font-medium">Google</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity className="w-14 h-14 rounded-full md:rounded-xl md:w-32 bg-white md:bg-auth-webInput border border-gray-200 md:border-white/10 justify-center items-center shadow-sm active:opacity-80 flex-row gap-2">
              <Text className="text-xl text-[#1877F2]">f</Text>
              {Platform.OS === 'web' && <Text className="text-white font-medium">Facebook</Text>}
            </TouchableOpacity>

            <TouchableOpacity className="w-14 h-14 rounded-full md:rounded-xl md:w-32 bg-white md:bg-auth-webInput border border-gray-200 md:border-white/10 justify-center items-center shadow-sm active:opacity-80 flex-row gap-2">
              <Text className="text-xl">🍏</Text>
              {Platform.OS === 'web' && <Text className="text-white font-medium">Apple</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AuthLayout>
  );
}
