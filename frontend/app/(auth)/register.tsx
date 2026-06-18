// app/(auth)/register.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useRegisterMutation } from '@/features/auth/hooks/useAuth';
import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import AuthLayout from '@/components/AuthLayout';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [secureText, setSecureText] = useState(true);
  const [agreed, setAgreed] = useState(false);

  const registerMutation = useRegisterMutation();
  const { signInWithGoogle, isReady } = useGoogleAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (!agreed) {
      Alert.alert('Terms Required', 'Please agree to the Terms & Conditions to continue.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    try {
      await registerMutation.mutateAsync({ name, email, password });
      router.replace('/(app)');
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Registration failed.';
      Alert.alert('Registration Failed', message);
    }
  };

  const getInputStyle = (fieldName: string) => {
    return `flex-row items-center h-14 px-4 bg-surface-1 border-2 rounded-xl transition-all duration-200 ${
      focusedInput === fieldName
        ? 'border-brand-primary shadow-glow-brand'
        : 'border-border-light hover:border-border-default'
    }`;
  };

  return (
    <AuthLayout 
      title="Create an account" 
      subtitle="Join TripSplit and start splitting elegantly."
    >
      <View className="gap-5">
        
        {/* ── Full Name ─────────────────────────────── */}
        <View className="animate-slide-up">
          <Text className="text-xs font-semibold text-text-tertiary tracking-widest uppercase mb-2">
            Full Name
          </Text>
          <View className={getInputStyle('name')}>
            <Text className="text-lg mr-3 opacity-40">👤</Text>
            <TextInput
              className="flex-1 font-sans text-base text-text-primary"
              placeholder="e.g., John Doe"
              placeholderTextColor="#A8A29E"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
              autoCapitalize="words"
              accessibilityLabel="Full name"
              accessibilityHint="Enter your full name"
            />
            {name.length > 0 && (
              <TouchableOpacity onPress={() => setName('')} className="p-1">
                <Text className="text-text-quaternary text-base">✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Email ─────────────────────────────────── */}
        <View className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <Text className="text-xs font-semibold text-text-tertiary tracking-widest uppercase mb-2">
            Email Address
          </Text>
          <View className={getInputStyle('email')}>
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
              accessibilityLabel="Email address"
              accessibilityHint="Enter your email address"
            />
            {email.length > 0 && (
              <TouchableOpacity onPress={() => setEmail('')} className="p-1">
                <Text className="text-text-quaternary text-base">✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Password ──────────────────────────────── */}
        <View className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <Text className="text-xs font-semibold text-text-tertiary tracking-widest uppercase mb-2">
            Password
          </Text>
          <View className={getInputStyle('password')}>
            <Text className="text-lg mr-3 opacity-40">🔒</Text>
            <TextInput
              className="flex-1 font-sans text-base text-text-primary"
              placeholder="Min. 8 characters"
              placeholderTextColor="#A8A29E"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              secureTextEntry={secureText}
              autoComplete="new-password"
              accessibilityLabel="Password"
              accessibilityHint="Create a password with at least 8 characters"
            />
            <TouchableOpacity 
              onPress={() => setSecureText(!secureText)} 
              className="p-2"
              accessibilityLabel={secureText ? "Show password" : "Hide password"}
            >
              <Text className="text-lg opacity-50">{secureText ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>
          {/* Password strength indicator */}
          {password.length > 0 && (
            <View className="mt-2">
              <View className="flex-row gap-1 mb-1">
                {[1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    className={`flex-1 h-1 rounded-full ${
                      password.length >= level * 3
                        ? level <= 2
                          ? 'bg-red-400'
                          : level === 3
                          ? 'bg-yellow-400'
                          : 'bg-green-400'
                        : 'bg-border-light'
                    }`}
                  />
                ))}
              </View>
              <Text className="text-xs text-text-quaternary">
                {password.length < 4
                  ? 'Too weak'
                  : password.length < 8
                  ? 'Could be stronger'
                  : password.length < 12
                  ? 'Strong password'
                  : 'Very strong password'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Terms Checkbox ────────────────────────── */}
        <TouchableOpacity 
          className="animate-slide-up flex-row items-center gap-3 py-2"
          onPress={() => setAgreed(!agreed)} 
          activeOpacity={0.7}
          style={{ animationDelay: '300ms' }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
        >
          <View className={`w-5 h-5 rounded-md border-2 items-center justify-center transition-all duration-200 ${
            agreed 
              ? 'bg-brand-primary border-brand-primary' 
              : 'bg-surface-1 border-border-default'
          }`}>
            {agreed && <Text className="text-white text-xs font-bold">✓</Text>}
          </View>
          <Text className="flex-1 font-sans text-sm text-text-secondary leading-5">
            I agree to the{' '}
            <Text className="text-brand-primary font-semibold">Terms & Conditions</Text>
            {' '}and{' '}
            <Text className="text-brand-primary font-semibold">Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        {/* ── Register Button ───────────────────────── */}
        <TouchableOpacity
          className={`animate-slide-up h-14 bg-brand-primary rounded-xl items-center justify-center mt-2
            shadow-lg shadow-brand-primary/20 transition-all duration-200
            hover:bg-brand-primary-hover hover:shadow-xl hover:shadow-brand-primary/30
            active:scale-[0.98]
            ${registerMutation.isPending ? 'opacity-70' : 'opacity-100'}
          `}
          style={{ animationDelay: '400ms' }}
          onPress={handleRegister}
          disabled={registerMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Create account"
          accessibilityState={{ disabled: registerMutation.isPending }}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="font-sans text-base font-bold text-white tracking-wide">
              Create Account
            </Text>
          )}
        </TouchableOpacity>

        {/* ── Divider ───────────────────────────────── */}
        <View className="animate-fade-in flex-row items-center gap-4 my-1" 
              style={{ animationDelay: '500ms' }}>
          <View className="flex-1 h-px bg-border-light" />
          <Text className="font-sans text-sm text-text-quaternary font-medium">
            Or continue with
          </Text>
          <View className="flex-1 h-px bg-border-light" />
        </View>

        {/* ── Social Buttons ────────────────────────── */}
        <View className="animate-slide-up flex-row justify-center gap-4" 
              style={{ animationDelay: '600ms' }}>
          {/* Google */}
          <TouchableOpacity
            onPress={() => signInWithGoogle()}
            disabled={!isReady}
            className={`w-14 h-14 rounded-xl border-2 border-border-light bg-surface-1
              items-center justify-center transition-all duration-200
              hover:border-brand-primary hover:bg-brand-primary-light hover:scale-105
              active:scale-95
              ${!isReady ? 'opacity-50' : 'opacity-100'}
            `}
            accessibilityLabel="Sign up with Google"
          >
            <Text className="font-display text-xl font-bold text-text-primary">G</Text>
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity
            className="w-14 h-14 rounded-xl border-2 border-border-light bg-surface-1 
              items-center justify-center transition-all duration-200
              hover:border-text-primary hover:bg-surface-2 hover:scale-105
              active:scale-95"
            accessibilityLabel="Sign up with Apple"
          >
            <Text className="font-display text-xl font-bold text-text-primary">🍎</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ────────────────────────────────── */}
        <View className="animate-fade-in flex-row justify-center pt-2" 
              style={{ animationDelay: '700ms' }}>
          <Text className="font-sans text-sm text-text-tertiary">
            Already have an account?{' '}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="font-sans text-sm font-bold text-brand-primary hover:text-brand-primary-hover">
                Sign In
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

      </View>
    </AuthLayout>
  );
}