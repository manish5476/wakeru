import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
// Import your actual hooks here
import { useLoginMutation } from '../../src/features/auth/hooks/useAuth';
import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';

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
    // MAIN CONTAINER: Stacked on mobile, side-by-side row on web (md:flex-row)
    <View className="flex-1 bg-background flex-col md:flex-row">
      
      {/* ── 1. HERO SECTION (Top on Mobile, Left on Web) ──────────────── */}
      <View className="flex-[0.35] md:flex-1 relative bg-slate-dark">
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1542314831-c6a42032207b?q=80&w=2000&auto=format&fit=crop' }}
          className="absolute inset-0 w-full h-full opacity-80"
          resizeMode="cover"
        />
        {/* Soft overlay to make text readable */}
        <View className="absolute inset-0 bg-black/20" />
        
        {/* Branding text over image */}
        <View className="absolute bottom-16 md:top-1/2 md:-translate-y-1/2 left-lg md:left-xxl right-lg">
          <Text className="font-display text-2xl md:text-3xl font-bold text-white mb-1">
            TripSplit.
          </Text>
          <Text className="font-body text-sm md:text-base text-white/80 font-medium leading-relaxed max-w-[300px]">
            Discover the world's most beautiful destinations and seamlessly share the journey.
          </Text>
        </View>
      </View>

      {/* ── 2. FORM SECTION (Overlapping on Mobile, Right on Web) ─────── */}
      <View className="flex-[0.65] md:flex-1 bg-surface rounded-t-[40px] md:rounded-none -mt-8 md:mt-0 p-lg md:p-xxl items-center justify-center z-10 shadow-float md:shadow-none">
        <View className="w-full max-w-[380px]">
          
          {/* Header */}
          <View className="mb-xl">
            <Text className="font-display text-2xl font-bold text-text-main mb-1 tracking-tight">
              Welcome back
            </Text>
            <Text className="font-body text-sm text-text-muted">
              Sign in to your account to continue
            </Text>
          </View>

          {/* Form Fields */}
          <View className="gap-md">
            
            {/* Email Input */}
            <View className="gap-xs">
              <Text className="font-body text-xs font-semibold text-text-muted tracking-widest uppercase">
                Email Address
              </Text>
              <View 
                className={`flex-row items-center h-[52px] rounded-md px-md border-[1.5px] transition-colors duration-200 ${
                  focusedInput === 'email' ? 'border-brand bg-surface' : 'border-border bg-background'
                }`}
              >
                <TextInput
                  className="flex-1 font-body text-base text-text-main outline-none"
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

            {/* Password Input */}
            <View className="gap-xs">
              <View className="flex-row justify-between items-center">
                <Text className="font-body text-xs font-semibold text-text-muted tracking-widest uppercase">
                  Password
                </Text>
                <Link href="/(auth)/forgot-password" asChild>
                  <TouchableOpacity>
                    <Text className="font-body text-xs font-semibold text-brand">Forgot Password?</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              <View 
                className={`flex-row items-center h-[52px] rounded-md px-md border-[1.5px] transition-colors duration-200 ${
                  focusedInput === 'password' ? 'border-brand bg-surface' : 'border-border bg-background'
                }`}
              >
                <TextInput
                  className="flex-1 font-body text-base text-text-main outline-none"
                  placeholder="••••••••"
                  placeholderTextColor="#A8A29E"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={secureText}
                />
                <TouchableOpacity onPress={() => setSecureText(!secureText)} className="p-2 -mr-2 opacity-60 hover:opacity-100">
                  <Text className="text-base">{secureText ? '👁' : '🙈'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loginMutation.isPending}
              className={`h-[54px] bg-brand rounded-pill items-center justify-center mt-sm shadow-glow-brand flex-row transition-transform active:scale-[0.98] ${
                loginMutation.isPending ? 'opacity-70' : 'opacity-100'
              }`}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-body text-base font-bold text-white tracking-wide">Log In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center gap-md my-sm">
              <View className="flex-1 h-[1px] bg-border" />
              <Text className="font-body text-xs text-text-muted font-medium">Or continue with</Text>
              <View className="flex-1 h-[1px] bg-border" />
            </View>

            {/* Social Buttons */}
            <View className="flex-row justify-center gap-md">
              <TouchableOpacity
                onPress={() => signInWithGoogle()}
                disabled={!isReady}
                className="w-14 h-14 rounded-pill border border-border bg-surface items-center justify-center transition-colors hover:bg-surface-hover active:scale-95"
              >
                {/* Replace with actual SVG/Icon */}
                <Text className="font-display text-lg font-bold text-text-main">G</Text>
              </TouchableOpacity>

              <TouchableOpacity className="w-14 h-14 rounded-pill border border-border bg-surface items-center justify-center transition-colors hover:bg-surface-hover active:scale-95">
                {/* Replace with actual SVG/Icon */}
                <Text className="font-display text-lg font-bold text-text-main">🍏</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View className="flex-row justify-center mt-sm">
              <Text className="font-body text-sm text-text-muted">Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="font-body text-sm font-bold text-brand">Sign up</Text>
                </TouchableOpacity>
              </Link>
            </View>

          </View>
        </View>
      </View>
      
    </View>
  );
}
// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   ActivityIndicator,
//   Alert,
//   Platform,
//   StyleSheet,
// } from 'react-native';
// import { Link } from 'expo-router';
// import { useLoginMutation } from '../../src/features/auth/hooks/useAuth';
// import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';
// import AuthLayout, { COLORS } from '../../src/components/AuthLayout';

// export default function LoginScreen() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [focusedInput, setFocusedInput] = useState<string | null>(null);
//   const [secureText, setSecureText] = useState(true);

//   const loginMutation = useLoginMutation();
//   const { signInWithGoogle, isReady } = useGoogleAuth();

//   const handleLogin = async () => {
//     if (!email || !password) {
//       Alert.alert('Error', 'Please enter both email and password.');
//       return;
//     }
//     try {
//       await loginMutation.mutateAsync({ email, password });
//     } catch (error: any) {
//       const message = error.response?.data?.error || error.message || 'Login failed.';
//       Alert.alert('Login Failed', message);
//     }
//   };

//   return (
//     <AuthLayout title="Welcome back" subtitle="Sign in to your account to continue">
//       <View style={styles.form}>

//         {/* ── Email ─────────────────────────────────── */}
//         <View>
//           <Text style={styles.label}>EMAIL ADDRESS</Text>
//           <View style={[styles.inputWrap, focusedInput === 'email' && styles.inputWrapFocused]}>
//             <TextInput
//               style={styles.input}
//               placeholder="e.g., hello@tripsplit.com"
//               placeholderTextColor="#A8A29E"
//               value={email}
//               onChangeText={setEmail}
//               onFocus={() => setFocusedInput('email')}
//               onBlur={() => setFocusedInput(null)}
//               keyboardType="email-address"
//               autoCapitalize="none"
//             />
//           </View>
//         </View>

//         {/* ── Password ──────────────────────────────── */}
//         <View>
//           <View style={styles.labelRow}>
//             <Text style={styles.label}>PASSWORD</Text>
//             <Link href="/(auth)/forgot-password" asChild>
//               <TouchableOpacity>
//                 <Text style={styles.forgotText}>Forgot Password?</Text>
//               </TouchableOpacity>
//             </Link>
//           </View>
//           <View style={[styles.inputWrap, focusedInput === 'password' && styles.inputWrapFocused]}>
//             <TextInput
//               style={[styles.input, { flex: 1 }]}
//               placeholder="••••••••"
//               placeholderTextColor="#A8A29E"
//               value={password}
//               onChangeText={setPassword}
//               onFocus={() => setFocusedInput('password')}
//               onBlur={() => setFocusedInput(null)}
//               secureTextEntry={secureText}
//             />
//             <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeBtn}>
//               <Text style={styles.eyeIcon}>{secureText ? '👁' : '🙈'}</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* ── Login Button ──────────────────────────── */}
//         <TouchableOpacity
//           style={[styles.primaryBtn, loginMutation.isPending && styles.primaryBtnDisabled]}
//           onPress={handleLogin}
//           disabled={loginMutation.isPending}
//         >
//           {loginMutation.isPending
//             ? <ActivityIndicator color="#FFFFFF" />
//             : <Text style={styles.primaryBtnText}>Log In</Text>
//           }
//         </TouchableOpacity>

//         {/* ── Divider ───────────────────────────────── */}
//         <View style={styles.dividerRow}>
//           <View style={styles.dividerLine} />
//           <Text style={styles.dividerText}>Or continue with</Text>
//           <View style={styles.dividerLine} />
//         </View>

//         {/* ── Social Buttons ────────────────────────── */}
//         <View style={styles.socialRow}>
//           <TouchableOpacity
//             style={styles.socialBtn}
//             onPress={() => signInWithGoogle()}
//             disabled={!isReady}
//           >
//             <Text style={styles.socialIcon}>G</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.socialBtn}>
//             <Text style={styles.socialIcon}>🍏</Text>
//           </TouchableOpacity>
//         </View>

//         {/* ── Footer ────────────────────────────────── */}
//         <View style={styles.footerRow}>
//           <Text style={styles.footerText}>Don't have an account? </Text>
//           <Link href="/(auth)/register" asChild>
//             <TouchableOpacity>
//               <Text style={styles.footerLink}>Sign up</Text>
//             </TouchableOpacity>
//           </Link>
//         </View>

//       </View>
//     </AuthLayout>
//   );
// }

// const styles = StyleSheet.create({
//   form: {
//     gap: 18,
//   },
//   label: {
//     fontSize: 11,
//     fontWeight: '600',
//     color: COLORS.textMuted,
//     letterSpacing: 1.2,
//     textTransform: 'uppercase',
//     marginBottom: 8,
//   },
//   labelRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 8,
//   },
//   forgotText: {
//     fontSize: 11,
//     fontWeight: '600',
//     color: COLORS.primary,
//   },
//   inputWrap: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     height: 52,
//     backgroundColor: COLORS.input,
//     borderRadius: 14,
//     paddingHorizontal: 16,
//     borderWidth: 1.5,
//     borderColor: 'transparent',
//   },
//   inputWrapFocused: {
//     borderColor: COLORS.primary,
//     backgroundColor: COLORS.inputFocus,
//   },
//   input: {
//     flex: 1,
//     fontSize: 14,
//     color: COLORS.text,
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//   },
//   eyeBtn: {
//     padding: 4,
//     marginLeft: 4,
//     opacity: 0.55,
//   },
//   eyeIcon: {
//     fontSize: 14,
//   },
//   primaryBtn: {
//     height: 54,
//     backgroundColor: COLORS.primary,
//     borderRadius: 100,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginTop: 6,
//     shadowColor: COLORS.primary,
//     shadowOffset: { width: 0, height: 6 },
//     shadowOpacity: 0.4,
//     shadowRadius: 16,
//     elevation: 6,
//   },
//   primaryBtnDisabled: {
//     opacity: 0.7,
//   },
//   primaryBtnText: {
//     color: '#FFFFFF',
//     fontSize: 15,
//     fontWeight: '700',
//     letterSpacing: 0.4,
//   },
//   dividerRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//     marginVertical: 4,
//   },
//   dividerLine: {
//     flex: 1,
//     height: 1,
//     backgroundColor: COLORS.border,
//   },
//   dividerText: {
//     fontSize: 12,
//     color: COLORS.textMuted,
//     fontWeight: '500',
//   },
//   socialRow: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     gap: 16,
//   },
//   socialBtn: {
//     width: 52,
//     height: 52,
//     borderRadius: 100,
//     backgroundColor: COLORS.input,
//     borderWidth: 1.5,
//     borderColor: COLORS.border,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   socialIcon: {
//     fontSize: 18,
//     fontWeight: '700',
//   },
//   footerRow: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     marginTop: 6,
//   },
//   footerText: {
//     fontSize: 13,
//     color: COLORS.textMuted,
//   },
//   footerLink: {
//     fontSize: 13,
//     fontWeight: '700',
//     color: COLORS.primary,
//   },
// });
