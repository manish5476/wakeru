import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useRegisterMutation } from '../../src/features/auth/hooks/useAuth';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const registerMutation = useRegisterMutation();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      await registerMutation.mutateAsync({
        name,
        email,
        password
      });

    } catch (error: any) {
      // Catch Firebase errors or backend errors
      const message = error.response?.data?.error || error.message || 'An error occurred during registration.';
      Alert.alert('Registration Failed', message);
    }
  };

  return (
    <View className="flex-1 justify-center items-center p-4 bg-background">
      <View className="items-center mb-8 gap-2">
        <Text className="text-4xl font-bold text-text">Create Account</Text>
        <Text className="text-lg text-textMuted">Sign up to get started</Text>
      </View>

      <View className="w-full max-w-sm gap-4">
        <TextInput
          className="h-12 px-4 rounded-lg bg-surface border border-border text-text placeholder:text-textMuted"
          placeholder="Full Name"
          placeholderTextColor="#A0A0A0"
          value={name}
          onChangeText={setName}
        />

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

        <TouchableOpacity
          className={`h-12 mt-4 rounded-lg flex-row justify-center items-center ${registerMutation.isPending ? 'bg-primary/50' : 'bg-primary'} active:opacity-80`}
          onPress={handleRegister}
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color="#121212" />
          ) : (
            <Text className="text-background font-bold text-lg">Sign Up</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4 gap-2">
          <Text className="text-text">Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="active:opacity-70">
              <Text className="text-primary font-bold">Sign In</Text>
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
            <TouchableOpacity className="flex-1 h-12 rounded-lg bg-surface border border-border justify-center items-center active:opacity-80">
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
