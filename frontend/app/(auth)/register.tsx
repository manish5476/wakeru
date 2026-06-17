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
import { useRegisterMutation } from '../../src/features/auth/hooks/useAuth';
import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';
import AuthLayout, { COLORS } from '../../src/components/AuthLayout';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [secureText, setSecureText] = useState(true);
  const [agreed, setAgreed] = useState(false);

  const registerMutation = useRegisterMutation();
  const { signInWithGoogle, isReady } = useGoogleAuth();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (!agreed) {
      Alert.alert('Terms Required', 'Please agree to the Terms & Conditions to continue.');
      return;
    }
    try {
      await registerMutation.mutateAsync({ name, email, password });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Registration failed.';
      Alert.alert('Registration Failed', message);
    }
  };

  return (
    <AuthLayout title="Create an account" subtitle="Join TripSplit and start splitting elegantly.">
      <View style={styles.form}>

        {/* ── Full Name ─────────────────────────────── */}
        <View>
          <Text style={styles.label}>FULL NAME</Text>
          <View style={[styles.inputWrap, focusedInput === 'name' && styles.inputWrapFocused]}>
            <TextInput
              style={styles.input}
              placeholder="e.g., John Doe"
              placeholderTextColor="#A8A29E"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedInput('name')}
              onBlur={() => setFocusedInput(null)}
              autoCapitalize="words"
            />
          </View>
        </View>

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
          <Text style={styles.label}>PASSWORD</Text>
          <View style={[styles.inputWrap, focusedInput === 'password' && styles.inputWrapFocused]}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Min. 8 characters"
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

        {/* ── Terms Checkbox ────────────────────────── */}
        <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.7}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxText}>
            I agree to the{' '}
            <Text style={styles.checkboxLink}>Terms & Conditions</Text>
          </Text>
        </TouchableOpacity>

        {/* ── Register Button ───────────────────────── */}
        <TouchableOpacity
          style={[styles.primaryBtn, registerMutation.isPending && styles.primaryBtnDisabled]}
          onPress={handleRegister}
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryBtnText}>Create Account</Text>
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
          <Text style={styles.footerText}>Already have an account? </Text>
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.input,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  checkboxText: {
    fontSize: 13,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  checkboxLink: {
    color: COLORS.primary,
    fontWeight: '600',
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
