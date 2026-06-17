import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { Link } from 'expo-router';
import { useLoginMutation } from '../../src/features/auth/hooks/useAuth';
import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';
import AuthLayout, { COLORS } from '../../src/components/AuthLayout';

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

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account to continue">
      <View style={styles.form}>

        {/* ── Email ─────────────────────────────────── */}
        <View>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={[styles.inputWrap, focusedInput === 'email' && styles.inputWrapFocused]}>
            <TextInput
              style={styles.input}
              placeholder="e.g., hello@tripsplit.com"
              placeholderTextColor="#A8A29E"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* ── Password ──────────────────────────────── */}
        <View>
          <View style={styles.labelRow}>
            <Text style={styles.label}>PASSWORD</Text>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <View style={[styles.inputWrap, focusedInput === 'password' && styles.inputWrapFocused]}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor="#A8A29E"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              secureTextEntry={secureText}
            />
            <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{secureText ? '👁' : '🙈'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Login Button ──────────────────────────── */}
        <TouchableOpacity
          style={[styles.primaryBtn, loginMutation.isPending && styles.primaryBtnDisabled]}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryBtnText}>Log In</Text>
          }
        </TouchableOpacity>

        {/* ── Divider ───────────────────────────────── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Social Buttons ────────────────────────── */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={() => signInWithGoogle()}
            disabled={!isReady}
          >
            <Text style={styles.socialIcon}>G</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialBtn}>
            <Text style={styles.socialIcon}>🍏</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ────────────────────────────────── */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>

      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: COLORS.input,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.inputFocus,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 4,
    opacity: 0.55,
  },
  eyeIcon: {
    fontSize: 14,
  },
  primaryBtn: {
    height: 54,
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 100,
    backgroundColor: COLORS.input,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
