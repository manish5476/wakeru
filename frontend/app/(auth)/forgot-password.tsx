import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import AuthLayout, { COLORS } from '../../src/components/AuthLayout';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert('Check your inbox', 'A password reset link has been sent to your email address.');
      router.replace('/(auth)/login');
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

        {/* ── Send Reset Button ─────────────────────── */}
        <TouchableOpacity
          style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
          onPress={handleResetPassword}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryBtnText}>Send Reset Link</Text>
          }
        </TouchableOpacity>

        {/* ── Footer ────────────────────────────────── */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Remember your password? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign In</Text>
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: COLORS.input,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF9F7',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  primaryBtn: {
    height: 54,
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.4,
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
    color: COLORS.text,
    textDecorationLine: 'underline',
  },
});
