import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useLoginMutation } from '../../src/features/auth/hooks/useAuth';
import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  
  const loginMutation = useLoginMutation();
  const { signInWithGoogle, isReady } = useGoogleAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      await loginMutation.mutateAsync({ email, password });
      // Removed router.replace('/') to prevent routing crash
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'An error occurred during login.';
      Alert.alert('Login Failed', message);
    }
  };

  return (
    <View className="flex-1 justify-center items-center p-4 bg-background">
      <View className="items-center mb-8 gap-2">
        <Text className="text-4xl font-bold text-text">Welcome Back</Text>
        <Text className="text-lg text-textMuted">Sign in to continue</Text>
      </View>

      <View className="w-full max-w-sm gap-4">
        <TextInput 
          className="h-12 px-4 rounded-lg bg-surface border border-border text-text placeholder:text-textMuted"
          placeholder="Email Address" 
          placeholderTextColor="#A0A0A0"
          value={email} 
          onChangeText={setEmail} 
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <TextInput 
          className="h-12 px-4 rounded-lg bg-surface border border-border text-text placeholder:text-textMuted"
          placeholder="Password" 
          placeholderTextColor="#A0A0A0"
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry
        />

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity className="self-end active:opacity-70">
            <Text className="text-primary font-medium">Forgot Password?</Text>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity 
          className={`h-12 mt-4 rounded-lg flex-row justify-center items-center ${loginMutation.isPending ? 'bg-primary/50' : 'bg-primary'} active:opacity-80`}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="#121212" />
          ) : (
            <Text className="text-background font-bold text-lg">Sign In</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4 gap-2">
          <Text className="text-text">Don't have an account?</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity className="active:opacity-70">
              <Text className="text-primary font-bold">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View className="mt-8 gap-4">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-[1px] bg-border" />
            <Text className="text-textMuted font-medium">Or continue with</Text>
            <View className="flex-1 h-[1px] bg-border" />
          </View>

          <View className="flex-row gap-3 justify-center mt-2">
            <TouchableOpacity 
              className="flex-1 h-12 rounded-lg bg-surface border border-border justify-center items-center active:opacity-80"
              onPress={() => signInWithGoogle()}
              disabled={!isReady}
            >
              <Text className="text-text font-semibold">Google</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 h-12 rounded-lg bg-surface border border-border justify-center items-center active:opacity-80">
              <Text className="text-text font-semibold">Facebook</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
