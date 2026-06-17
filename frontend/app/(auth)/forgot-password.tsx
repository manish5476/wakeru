import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import AuthLayout from '../../src/components/AuthLayout';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real app, call Firebase sendPasswordResetEmail here
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert('Success', 'Password reset email sent! Please check your inbox.');
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send password reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout 
      title="Reset Password" 
      subtitle="Enter your email address and we'll send you instructions to reset your password."
      isLogin={false}
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

        <TouchableOpacity 
          className={`h-14 mt-6 rounded-full md:rounded-xl flex-row justify-center items-center ${isSubmitting ? 'opacity-70' : ''} bg-auth-mobileBtn md:bg-white active:opacity-80`}
          onPress={handleResetPassword}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Platform.OS === 'web' ? '#000' : '#fff'} />
          ) : (
            <Text className="text-white md:text-black font-bold text-lg">Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4 gap-1">
          <Text className="text-gray-500 md:text-gray-400">Remember your password?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="active:opacity-70">
              <Text className="font-bold text-auth-mobileBtn md:text-white underline">Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </AuthLayout>
  );
}
