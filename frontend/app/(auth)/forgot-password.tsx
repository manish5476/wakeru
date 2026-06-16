import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';

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
    <View className="flex-1 justify-center items-center p-4 bg-background">
      <View className="items-center mb-8 gap-2">
        <Text className="text-4xl font-bold text-text">Reset Password</Text>
        <Text className="text-lg text-textMuted text-center px-4">
          Enter your email address and we'll send you instructions to reset your password.
        </Text>
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

        <TouchableOpacity 
          className={`h-12 mt-4 rounded-lg flex-row justify-center items-center ${isSubmitting ? 'bg-primary/50' : 'bg-primary'} active:opacity-80`}
          onPress={handleResetPassword}
          disabled={isSubmitting}
        >
          <Text className="text-background font-bold text-lg">
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4 gap-2">
          <Text className="text-text">Remember your password?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="active:opacity-70">
              <Text className="text-primary font-bold">Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}
