// app/(auth)/forgot-password.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import AuthLayout from '@/components/AuthLayout';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call - replace with actual mutation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsSent(true);
      Alert.alert(
        'Email Sent! 📧', 
        'A password reset link has been sent to your email address. Please check your inbox.',
        [
          { 
            text: 'OK', 
            onPress: () => router.replace('/(auth)/login') 
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send password reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send a link to reset your password."
    >
      <View className="gap-5">
        
        {/* ── Email ─────────────────────────────────── */}
        <View className="animate-slide-up">
          <Text className="text-xs font-semibold text-text-tertiary tracking-widest uppercase mb-2">
            Email Address
          </Text>
          <View className={`flex-row items-center h-14 px-4 bg-surface-1 border-2 rounded-xl transition-all duration-200 ${
            focusedInput === 'email'
              ? 'border-brand-primary shadow-glow-brand'
              : 'border-border-light hover:border-border-default'
          }`}>
            <Text className="text-lg mr-3 opacity-40">✉️</Text>
            <TextInput
              className="flex-1 font-sans text-base text-text-primary"
              placeholder="e.g., hello@tripsplit.com"
              placeholderTextColor="#A8A29E"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSent}
              accessibilityLabel="Email address"
              accessibilityHint="Enter the email address associated with your account"
            />
            {email.length > 0 && !isSent && (
              <TouchableOpacity onPress={() => setEmail('')} className="p-1">
                <Text className="text-text-quaternary text-base">✕</Text>
              </TouchableOpacity>
            )}
            {isSent && (
              <View className="bg-success/10 rounded-full p-1">
                <Text className="text-success text-base">✓</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Info Card ──────────────────────────────── */}
        {!isSent && (
          <View className="animate-fade-in bg-brand-primary-light rounded-xl p-4 border border-brand-primary/10"
                style={{ animationDelay: '200ms' }}>
            <View className="flex-row gap-3">
              <Text className="text-xl">💡</Text>
              <View className="flex-1">
                <Text className="font-sans text-sm font-semibold text-brand-primary mb-1">
                  Password Reset Instructions
                </Text>
                <Text className="font-sans text-sm text-text-secondary leading-relaxed">
                  We'll send a secure link to your email. Click the link to create a new password. 
                  The link expires in 30 minutes for security.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Success State ──────────────────────────── */}
        {isSent && (
          <View className="animate-scale-in bg-success/10 rounded-xl p-6 border border-success/20">
            <View className="items-center gap-4">
              <View className="w-16 h-16 bg-success/20 rounded-full items-center justify-center">
                <Text className="text-3xl">📧</Text>
              </View>
              <View className="items-center">
                <Text className="font-display text-xl font-bold text-success text-center mb-2">
                  Check Your Email
                </Text>
                <Text className="font-sans text-sm text-text-secondary text-center leading-relaxed">
                  We've sent a password reset link to{' '}
                  <Text className="font-semibold text-text-primary">{email}</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Send Reset Button ─────────────────────── */}
        {!isSent && (
          <TouchableOpacity
            className={`animate-slide-up h-14 bg-brand-primary rounded-xl items-center justify-center mt-2
              shadow-lg shadow-brand-primary/20 transition-all duration-200
              hover:bg-brand-primary-hover hover:shadow-xl hover:shadow-brand-primary/30
              active:scale-[0.98]
              ${isSubmitting ? 'opacity-70' : 'opacity-100'}
            `}
            style={{ animationDelay: '300ms' }}
            onPress={handleResetPassword}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Send reset link"
            accessibilityState={{ disabled: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="font-sans text-base font-bold text-white tracking-wide">
                Send Reset Link
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Resend Option (when sent) ──────────────── */}
        {isSent && (
          <View className="animate-fade-in items-center gap-3" 
                style={{ animationDelay: '400ms' }}>
            <TouchableOpacity
              onPress={() => {
                setIsSent(false);
                handleResetPassword();
              }}
              className="h-12 px-8 border-2 border-brand-primary rounded-xl items-center justify-center
                transition-all duration-200 hover:bg-brand-primary-light active:scale-95"
            >
              <Text className="font-sans text-sm font-semibold text-brand-primary">
                Resend Email
              </Text>
            </TouchableOpacity>
            
            <Text className="font-sans text-xs text-text-quaternary">
              Didn't receive the email? Check your spam folder.
            </Text>
          </View>
        )}

        {/* ── Footer ────────────────────────────────── */}
        <View className="animate-fade-in flex-row justify-center pt-2" 
              style={{ animationDelay: '500ms' }}>
          <Text className="font-sans text-sm text-text-tertiary">
            Remember your password?{' '}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="font-sans text-sm font-bold text-brand-primary hover:text-brand-primary-hover">
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* ── Help Link ──────────────────────────────── */}
        <View className="items-center pt-1">
          <TouchableOpacity className="py-2">
            <Text className="font-sans text-xs text-text-quaternary underline">
              Need help? Contact Support
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </AuthLayout>
  );
}