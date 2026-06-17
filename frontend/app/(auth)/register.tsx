import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useRegisterMutation } from '../../src/features/auth/hooks/useAuth';
import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';
import AuthLayout from '../../src/components/AuthLayout';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const registerMutation = useRegisterMutation();
  const { signInWithGoogle, isReady } = useGoogleAuth();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      await registerMutation.mutateAsync({ name, email, password });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'An error occurred during registration.';
      Alert.alert('Registration Failed', message);
    }
  };

  return (
    <AuthLayout 
      title="Register" 
      subtitle="Create your new account"
      isLogin={false}
    >
      <View className="w-full gap-4">
        <View>
          <Text className="text-sm font-semibold mb-2 text-auth-mobileText md:text-white/80">Full Name</Text>
          <TextInput
            className="h-14 px-4 rounded-xl bg-auth-mobileInput md:bg-auth-webInput text-auth-mobileText md:text-white"
            placeholder="John Doe"
            placeholderTextColor={Platform.OS === 'web' ? '#666' : '#999'}
            value={name}
            onChangeText={setName}
          />
        </View>

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

        <TouchableOpacity
          className={`h-14 mt-6 rounded-full md:rounded-xl flex-row justify-center items-center ${registerMutation.isPending ? 'opacity-70' : ''} bg-auth-mobileBtn md:bg-white active:opacity-80`}
          onPress={handleRegister}
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color={Platform.OS === 'web' ? '#000' : '#fff'} />
          ) : (
            <Text className="text-white md:text-black font-bold text-lg">Sign Up</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4 gap-1">
          <Text className="text-gray-500 md:text-gray-400">Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="active:opacity-70">
              <Text className="font-bold text-auth-mobileBtn md:text-white underline">Login</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View className="mt-8 gap-6">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-[1px] bg-gray-200 md:bg-white/10" />
            <Text className="text-gray-400 md:text-gray-500 font-medium text-sm">Or continue with</Text>
            <View className="flex-1 h-[1px] bg-gray-200 md:bg-white/10" />
          </View>

          <View className="flex-row gap-4 justify-center mb-8">
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
