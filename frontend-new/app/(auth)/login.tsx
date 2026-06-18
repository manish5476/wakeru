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
    return `flex-row items-center h-[52px] rounded-2xl px-4 border-[1.5px] transition-colors duration-300 ${
      focusedInput === fieldName
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
          className={`h-14 rounded-full items-center justify-center mt-2 flex-row transition-all duration-200 active:scale-[0.98] ${
            loginMutation.isPending ? 'opacity-70' : 'opacity-100'
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
            className={`w-14 h-14 rounded-full border border-border-light bg-surface-1 items-center justify-center transition-all hover:bg-surface-2 active:scale-95 shadow-sm ${
              !isReady ? 'opacity-50' : 'opacity-100'
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
// // app/(auth)/login.tsx
// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   ActivityIndicator,
//   Alert,
//   Image,
//   KeyboardAvoidingView,
//   ScrollView,
//   Platform,
// } from 'react-native';
// import { Link } from 'expo-router';
// import { useLoginMutation } from '@/features/auth/hooks/useAuth';
// import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';

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
//     <KeyboardAvoidingView
//       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//       className="flex-1"
//     >
//       <ScrollView
//         contentContainerStyle={{ flexGrow: 1 }}
//         keyboardShouldPersistTaps="handled"
//       >
//         {/* Main Layout: Stacked on mobile, side-by-side on tablet+ */}
//         <View className="flex-1 flex-col md:flex-row min-h-screen">
          
//           {/* ── HERO SECTION ──────────────────────────── */}
//           <View className="relative flex-[0.4] md:flex-1 overflow-hidden">
//             {/* Background Image */}
//             <Image
//               source={{ 
//                 uri: 'https://images.unsplash.com/photo-1542314831-c6a42032207b?q=80&w=2000&auto=format&fit=crop' 
//               }}
//               className="absolute inset-0 w-full h-full"
//               resizeMode="cover"
//             />
            
//             {/* Gradient Overlays */}
//             <View className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />
//             <View className="absolute inset-0 bg-gradient-to-r from-brand-primary/20 to-transparent" />
            
//             {/* Brand Content */}
//             <View className="absolute inset-x-0 bottom-12 md:bottom-auto md:top-1/2 md:-translate-y-1/2 p-8 md:p-12 lg:p-16">
//               <View className="animate-slide-up">
//                 {/* Logo/Brand */}
//                 <Text className="font-display text-4xl md:text-5xl lg:text-6xl text-white font-bold mb-4 tracking-tight">
//                   TripSplit
//                 </Text>
                
//                 {/* Tagline */}
//                 <Text className="font-sans text-base md:text-lg lg:text-xl text-white/90 font-medium leading-relaxed max-w-md">
//                   Discover the world's most beautiful destinations and seamlessly share the journey.
//                 </Text>
                
//                 {/* Stats (Desktop only) */}
//                 <View className="hidden md:flex flex-row gap-8 mt-8">
//                   <View>
//                     <Text className="font-display text-3xl text-white font-bold">10k+</Text>
//                     <Text className="font-sans text-sm text-white/70">Active Travelers</Text>
//                   </View>
//                   <View>
//                     <Text className="font-display text-3xl text-white font-bold">150+</Text>
//                     <Text className="font-sans text-sm text-white/70">Countries</Text>
//                   </View>
//                   <View>
//                     <Text className="font-display text-3xl text-white font-bold">4.9</Text>
//                     <Text className="font-sans text-sm text-white/70">User Rating</Text>
//                   </View>
//                 </View>
//               </View>
//             </View>
            
//             {/* Decorative dots pattern (desktop) */}
//             <View className="hidden md:flex absolute top-8 right-8 gap-2">
//               {[...Array(9)].map((_, i) => (
//                 <View key={i} className="w-2 h-2 rounded-full bg-white/30" />
//               ))}
//             </View>
//           </View>

//           {/* ── FORM SECTION ─────────────────────────── */}
//           <View className="flex-[0.6] md:flex-1 bg-surface-1 md:bg-surface-0">
//             <View className="flex-1 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-8 md:py-0 justify-center">
//               {/* Mobile overlay card */}
//               <View className="bg-surface-1 rounded-t-3xl md:rounded-none -mt-8 md:mt-0 pt-8 md:pt-0 
//                             shadow-float md:shadow-none">
//                 <View className="w-full max-w-md mx-auto">
                  
//                   {/* Header */}
//                   <View className="mb-8 animate-fade-in">
//                     <Text className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
//                       Welcome back
//                     </Text>
//                     <Text className="font-sans text-base text-text-tertiary">
//                       Sign in to continue your journey
//                     </Text>
//                   </View>

//                   {/* Form */}
//                   <View className="space-y-5">
                    
//                     {/* Email Field */}
//                     <View className="animate-slide-up" style={{ animationDelay: '100ms' }}>
//                       <Text className="caption text-text-tertiary mb-2">
//                         Email Address
//                       </Text>
//                       <View className={`
//                         flex-row items-center h-14 px-4 bg-surface-0 md:bg-surface-1 
//                         border-2 rounded-xl transition-all duration-200
//                         ${focusedInput === 'email' 
//                           ? 'border-brand-primary shadow-glow-brand bg-surface-1' 
//                           : 'border-border-light hover:border-border-default'
//                         }
//                       `}>
//                         <Text className="font-sans text-lg mr-3 text-text-quaternary">✉️</Text>
//                         <TextInput
//                           className="flex-1 font-sans text-base text-text-primary h-full"
//                           placeholder="hello@tripsplit.com"
//                           placeholderTextColor="var(--text-quaternary)"
//                           value={email}
//                           onChangeText={setEmail}
//                           onFocus={() => setFocusedInput('email')}
//                           onBlur={() => setFocusedInput(null)}
//                           keyboardType="email-address"
//                           autoCapitalize="none"
//                           autoComplete="email"
//                           accessibilityLabel="Email address"
//                           accessibilityHint="Enter your email address"
//                         />
//                         {email.length > 0 && (
//                           <TouchableOpacity onPress={() => setEmail('')} className="ml-2">
//                             <Text className="text-text-quaternary">✕</Text>
//                           </TouchableOpacity>
//                         )}
//                       </View>
//                     </View>

//                     {/* Password Field */}
//                     <View className="animate-slide-up" style={{ animationDelay: '200ms' }}>
//                       <View className="flex-row justify-between items-center mb-2">
//                         <Text className="caption text-text-tertiary">
//                           Password
//                         </Text>
//                         <Link href="/(auth)/forgot-password" asChild>
//                           <TouchableOpacity>
//                             <Text className="font-sans text-sm font-semibold text-brand-primary hover:text-brand-primary-hover">
//                               Forgot password?
//                             </Text>
//                           </TouchableOpacity>
//                         </Link>
//                       </View>
//                       <View className={`
//                         flex-row items-center h-14 px-4 bg-surface-0 md:bg-surface-1
//                         border-2 rounded-xl transition-all duration-200
//                         ${focusedInput === 'password'
//                           ? 'border-brand-primary shadow-glow-brand bg-surface-1'
//                           : 'border-border-light hover:border-border-default'
//                         }
//                       `}>
//                         <Text className="font-sans text-lg mr-3 text-text-quaternary">🔒</Text>
//                         <TextInput
//                           className="flex-1 font-sans text-base text-text-primary h-full"
//                           placeholder="••••••••"
//                           placeholderTextColor="var(--text-quaternary)"
//                           value={password}
//                           onChangeText={setPassword}
//                           onFocus={() => setFocusedInput('password')}
//                           onBlur={() => setFocusedInput(null)}
//                           secureTextEntry={secureText}
//                           autoComplete="current-password"
//                           accessibilityLabel="Password"
//                           accessibilityHint="Enter your password"
//                         />
//                         <TouchableOpacity 
//                           onPress={() => setSecureText(!secureText)} 
//                           className="ml-2 p-2"
//                           accessibilityLabel={secureText ? "Show password" : "Hide password"}
//                         >
//                           <Text className="text-lg">{secureText ? '👁️' : '🙈'}</Text>
//                         </TouchableOpacity>
//                       </View>
//                     </View>

//                     {/* Login Button */}
//                     <View className="animate-slide-up pt-2" style={{ animationDelay: '300ms' }}>
//                       <TouchableOpacity
//                         onPress={handleLogin}
//                         disabled={loginMutation.isPending}
//                         className={`
//                           h-14 bg-brand-primary rounded-xl items-center justify-center
//                           transition-all duration-200 shadow-lg shadow-brand-primary/20
//                           hover:bg-brand-primary-hover hover:shadow-xl hover:shadow-brand-primary/30
//                           active:scale-[0.98]
//                           ${loginMutation.isPending ? 'opacity-70' : 'opacity-100'}
//                         `}
//                         accessibilityRole="button"
//                         accessibilityLabel="Sign in"
//                         accessibilityState={{ disabled: loginMutation.isPending }}
//                       >
//                         {loginMutation.isPending ? (
//                           <ActivityIndicator color="white" size="small" />
//                         ) : (
//                           <Text className="font-sans text-base font-bold text-white tracking-wide">
//                             Sign In
//                           </Text>
//                         )}
//                       </TouchableOpacity>
//                     </View>

//                     {/* Divider */}
//                     <View className="animate-fade-in flex-row items-center gap-4 my-2" 
//                           style={{ animationDelay: '400ms' }}>
//                       <View className="flex-1 h-px bg-border-light" />
//                       <Text className="font-sans text-sm text-text-quaternary font-medium">
//                         or continue with
//                       </Text>
//                       <View className="flex-1 h-px bg-border-light" />
//                     </View>

//                     {/* Social Buttons */}
//                     <View className="animate-slide-up flex-row justify-center gap-4" 
//                           style={{ animationDelay: '500ms' }}>
//                       {/* Google */}
//                       <TouchableOpacity
//                         onPress={() => signInWithGoogle()}
//                         disabled={!isReady}
//                         className={`
//                           w-14 h-14 rounded-xl border-2 border-border-light bg-surface-1
//                           items-center justify-center
//                           transition-all duration-200
//                           hover:border-brand-primary hover:bg-brand-primary-light hover:scale-105
//                           active:scale-95
//                           ${!isReady ? 'opacity-50' : 'opacity-100'}
//                         `}
//                         accessibilityLabel="Sign in with Google"
//                       >
//                         <Text className="font-display text-xl font-bold text-text-primary">G</Text>
//                       </TouchableOpacity>

//                       {/* Apple */}
//                       <TouchableOpacity
//                         className="w-14 h-14 rounded-xl border-2 border-border-light bg-surface-1 
//                                   items-center justify-center
//                                   transition-all duration-200
//                                   hover:border-text-primary hover:bg-surface-2 hover:scale-105
//                                   active:scale-95"
//                         accessibilityLabel="Sign in with Apple"
//                       >
//                         <Text className="font-display text-xl font-bold text-text-primary">🍎</Text>
//                       </TouchableOpacity>

//                       {/* Microsoft */}
//                       <TouchableOpacity
//                         className="w-14 h-14 rounded-xl border-2 border-border-light bg-surface-1 
//                                   items-center justify-center
//                                   transition-all duration-200
//                                   hover:border-blue-500 hover:bg-blue-50 hover:scale-105
//                                   active:scale-95"
//                         accessibilityLabel="Sign in with Microsoft"
//                       >
//                         <Text className="font-display text-xl font-bold text-text-primary">⊞</Text>
//                       </TouchableOpacity>
//                     </View>

//                     {/* Sign Up Link */}
//                     <View className="animate-fade-in flex-row justify-center pt-4" 
//                           style={{ animationDelay: '600ms' }}>
//                       <Text className="font-sans text-base text-text-tertiary">
//                         Don't have an account?{' '}
//                       </Text>
//                       <Link href="/(auth)/register" asChild>
//                         <TouchableOpacity>
//                           <Text className="font-sans text-base font-bold text-brand-primary hover:text-brand-primary-hover">
//                             Create free account
//                           </Text>
//                         </TouchableOpacity>
//                       </Link>
//                     </View>

//                     {/* Terms */}
//                     <View className="animate-fade-in pt-2" style={{ animationDelay: '700ms' }}>
//                       <Text className="font-sans text-xs text-text-quaternary text-center leading-relaxed">
//                         By continuing, you agree to TripSplit's{' '}
//                         <Text className="text-brand-primary font-semibold">Terms of Service</Text>
//                         {' '}and{' '}
//                         <Text className="text-brand-primary font-semibold">Privacy Policy</Text>
//                       </Text>
//                     </View>

//                   </View>
//                 </View>
//               </View>
//             </View>
//           </View>
//         </View>
//       </ScrollView>
//     </KeyboardAvoidingView>
//   );
// }