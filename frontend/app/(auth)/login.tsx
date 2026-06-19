// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { useLoginMutation } from '@/features/auth/hooks/useAuth';
import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import AuthLayout from '@/components/AuthLayout';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [secureText, setSecureText] = useState(true);

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
      const message = error.response?.data?.error || error.message || 'Login failed.';
      Alert.alert('Login Failed', message);
    }
  };

  const getInputStyle = (fieldName: string) => {
    return `flex-row items-center h-[52px] rounded-2xl px-4 border-[1.5px] transition-colors duration-300 ${focusedInput === fieldName
        ? 'border-brand-primary bg-surface-1 shadow-glow-brand'
        : 'border-border-light bg-surface-0 md:bg-surface-1 hover:border-border-default'
      }`;
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account to continue planning your next adventure."
    >
      <View className="gap-5">

        {/* Email Input */}
        <View className="gap-2">
          <Text className="text-xs font-semibold text-text-quaternary tracking-widest uppercase font-sans">
            Email Address
          </Text>
          <View className={getInputStyle('email')}>
            <TextInput
              className="flex-1 text-sm text-text-primary h-full font-sans"
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
            />
            {email.length > 0 && (
              <TouchableOpacity
                onPress={() => setEmail('')}
                className="p-1 -mr-1 opacity-40 hover:opacity-70"
              >
                <Text className="text-base text-text-primary">✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Password Input */}
        <View className="gap-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-text-quaternary tracking-widest uppercase font-sans">
              Password
            </Text>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text className="text-xs font-bold text-brand-primary font-sans">
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
          <View className={getInputStyle('password')}>
            <TextInput
              className="flex-1 text-sm text-text-primary h-full font-sans"
              placeholder="••••••••"
              placeholderTextColor="#A8A29E"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              secureTextEntry={secureText}
              autoComplete="current-password"
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              onPress={() => setSecureText(!secureText)}
              className="p-2 -mr-2 opacity-60 hover:opacity-100 transition-opacity"
              accessibilityLabel={secureText ? "Show password" : "Hide password"}
            >
              <Text className="text-lg">{secureText ? '👁' : '🙈'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loginMutation.isPending}
          className={`h-14 rounded-full items-center justify-center mt-2 flex-row transition-all duration-200 active:scale-[0.98] ${loginMutation.isPending ? 'opacity-70' : 'opacity-100'
            }`}
          style={{
            backgroundColor: '#DE6B48',
            shadowColor: '#DE6B48',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 8,
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-sm font-bold text-white tracking-wide font-sans">
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View className="flex-row items-center gap-4 my-2">
          <View className="flex-1 h-px bg-border-light" />
          <Text className="text-xs text-text-quaternary font-medium uppercase tracking-wide font-sans">
            Or continue with
          </Text>
          <View className="flex-1 h-px bg-border-light" />
        </View>

        {/* Social Buttons */}
        <View className="flex-row justify-center gap-4">
          <TouchableOpacity
            onPress={() => signInWithGoogle()}
            disabled={!isReady}
            className={`w-14 h-14 rounded-full border border-border-light bg-surface-1 items-center justify-center transition-all hover:bg-surface-2 active:scale-95 shadow-sm ${!isReady ? 'opacity-50' : 'opacity-100'
              }`}
            accessibilityLabel="Sign in with Google"
          >
            <Text className="text-xl font-bold text-text-primary font-display">G</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-14 h-14 rounded-full border border-border-light bg-surface-1 items-center justify-center transition-all hover:bg-surface-2 active:scale-95 shadow-sm"
            accessibilityLabel="Sign in with Apple"
          >
            <Text className="text-xl font-bold text-text-primary font-display"></Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-sm text-text-tertiary font-sans">
            Don't have an account?{' '}
          </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text className="text-sm font-bold text-brand-primary ml-1 font-sans">
                Sign up
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

      </View>
    </AuthLayout>
  );
}