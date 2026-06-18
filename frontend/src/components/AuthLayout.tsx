import React, { useState } from 'react';

/* ====================================================================
  NOTE: For your actual Expo app, use these native imports.
  The mocked versions below are solely to allow the Canvas previewer 
  to compile and display the responsive web design perfectly here.
  ====================================================================
  import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
  import { Link } from 'expo-router';
  import { useLoginMutation } from '../../src/features/auth/hooks/useAuth';
  import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';
*/

// --- CANVAS PREVIEW MOCKS (Delete these in your actual app) ---
const FontInjector = () => <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@300;400;600;700;800&display=swap');`}</style>;
const View = ({ children, className = '', style, ...props }: any) => <div className={`flex ${className.includes('flex-row') ? '' : 'flex-col'} ${className}`} style={style} {...props}>{children}</div>;
const Text = ({ children, className = '', style, ...props }: any) => <span className={className} style={{ fontFamily: '"Inter", sans-serif', ...style }} {...props}>{children}</span>;
const TextInput = ({ className = '', secureTextEntry, onChangeText, value, placeholder, style, ...props }: any) => (
  <input type={secureTextEntry ? 'password' : 'text'} className={`bg-transparent outline-none border-none m-0 p-0 ${className}`} value={value} placeholder={placeholder} onChange={(e) => onChangeText && onChangeText(e.target.value)} style={{ color: '#1C1917', ...style }} {...props} />
);
const TouchableOpacity = ({ children, className = '', onPress, disabled, style, ...props }: any) => (
  <button onClick={onPress} disabled={disabled} className={`cursor-pointer border-none outline-none flex items-center justify-center p-0 m-0 ${className}`} style={{ background: 'transparent', ...style }} {...props}>{children}</button>
);
const Image = ({ source, className = '', ...props }: any) => <img src={source?.uri} className={`object-cover ${className}`} {...props} />;
const ActivityIndicator = () => <span style={{ color: '#FFF', fontSize: '13px' }}>Loading...</span>;
const KeyboardAvoidingView = ({ children, className = '' }: any) => <div className={`flex flex-col ${className}`}>{children}</div>;
const ScrollView = ({ children, contentContainerClassName = '' }: any) => <div className={`overflow-y-auto ${contentContainerClassName}`}>{children}</div>;
const Alert = { alert: (title: string, msg: string) => alert(`${title}: ${msg}`) };
const Link = ({ children, href }: any) => React.cloneElement(children, { onClick: () => alert(`Navigating to ${href}`), style: { ...children.props.style, textDecoration: 'none' } });
const useLoginMutation = () => ({ mutateAsync: async () => new Promise(r => setTimeout(r, 1500)), isPending: false });
const useGoogleAuth = () => ({ signInWithGoogle: () => alert('Google Sign In Triggered'), isReady: true });
// --- END MOCKS ---


// ─────────────────────────────────────────────────────────────────────────────
// AUTH LAYOUT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    // MAIN CONTAINER: Stacked on mobile, side-by-side row on web (md:flex-row)
    <KeyboardAvoidingView 
      /* behavior={Platform.OS === 'ios' ? 'padding' : 'height'} */
      className="flex-1 min-h-screen bg-[#F7F6F3] flex-col md:flex-row overflow-hidden"
    >
      <FontInjector />

      {/* ── 1. HERO SECTION (Top on Mobile, Left on Desktop) ──────────────── */}
      <View className="flex-[0.4] md:flex-[0.45] relative bg-[#1E1B1A]">
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1542314831-c6a42032207b?q=80&w=2000&auto=format&fit=crop' }}
          className="absolute inset-0 w-full h-full opacity-85"
        />
        
        {/* Soft luxury gradient overlay */}
        <View className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Top-left eyebrow brand indicator */}
        <View className="absolute top-8 left-8 md:top-10 md:left-12 flex-row items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <View className="w-2 h-2 rounded-full bg-[#DE6B48]" />
          <Text className="text-white text-[11px] font-bold tracking-widest uppercase">TripSplit</Text>
        </View>

        {/* Branding text perfectly positioned */}
        <View className="absolute bottom-16 md:top-1/2 md:-translate-y-1/2 left-8 md:left-12 right-8">
          <Text 
            className="text-4xl md:text-5xl font-bold text-white mb-3" 
            style={{ fontFamily: '"Outfit", serif', letterSpacing: '-1px' }}
          >
            Split the journey,{'\n'}not the memories.
          </Text>
          <Text className="text-[13px] md:text-[14px] text-white/80 font-medium leading-relaxed max-w-[320px]">
            The most elegant way to track expenses and settle up across every destination.
          </Text>
        </View>
      </View>

      {/* ── 2. FORM SECTION (Overlapping on Mobile, Right on Desktop) ─────── */}
      <View className="flex-[0.6] md:flex-[0.55] bg-[#FFFFFF] rounded-t-[40px] md:rounded-none -mt-10 md:mt-0 z-10 shadow-[0_-12px_40px_rgba(0,0,0,0.06)] md:shadow-none overflow-hidden">
        
        <ScrollView 
          contentContainerClassName="flex-grow justify-center items-center p-8 md:p-16"
          /* showsVerticalScrollIndicator={false} */
          /* keyboardShouldPersistTaps="handled" */
        >
          {/* Form Inner Wrapper (Restricted width for elegance on large screens) */}
          <View className="w-full max-w-[360px]">
            
            {/* Header */}
            <View className="mb-10 text-left">
              <Text 
                className="text-[28px] font-bold text-[#1C1917] mb-2" 
                style={{ fontFamily: '"Outfit", serif', letterSpacing: '-0.5px' }}
              >
                {title}
              </Text>
              <Text className="text-[13px] text-[#78716C] leading-relaxed">
                {subtitle}
              </Text>
            </View>

            {/* Injected Screen Content (Login/Register Form) */}
            {children}

          </View>
        </ScrollView>
      </View>
      
    </KeyboardAvoidingView>
  );
}
// import React, { useState } from 'react';

// /* ====================================================================
//   NOTE: For your actual Expo app, use these native imports.
//   The mocked versions below are solely to allow the Canvas previewer 
//   to compile and display the responsive web design perfectly here.
//   ====================================================================
//   import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
//   import { Link } from 'expo-router';
//   import { useLoginMutation } from '../../src/features/auth/hooks/useAuth';
//   import { useGoogleAuth } from '../../src/features/auth/hooks/useGoogleAuth';
// */

// // --- CANVAS PREVIEW MOCKS (Delete these in your actual app) ---
// const FontInjector = () => <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@300;400;600;700;800&display=swap');`}</style>;
// const View = ({ children, className = '', style, ...props }: any) => <div className={`flex ${className.includes('flex-row') ? '' : 'flex-col'} ${className}`} style={style} {...props}>{children}</div>;
// const Text = ({ children, className = '', style, ...props }: any) => <span className={className} style={{ fontFamily: '"Inter", sans-serif', ...style }} {...props}>{children}</span>;
// const TextInput = ({ className = '', secureTextEntry, onChangeText, value, placeholder, style, ...props }: any) => (
//   <input type={secureTextEntry ? 'password' : 'text'} className={`bg-transparent outline-none border-none m-0 p-0 ${className}`} value={value} placeholder={placeholder} onChange={(e) => onChangeText && onChangeText(e.target.value)} style={{ color: '#1C1917', ...style }} {...props} />
// );
// const TouchableOpacity = ({ children, className = '', onPress, disabled, style, ...props }: any) => (
//   <button onClick={onPress} disabled={disabled} className={`cursor-pointer border-none outline-none flex items-center justify-center p-0 m-0 ${className}`} style={{ background: 'transparent', ...style }} {...props}>{children}</button>
// );
// const Image = ({ source, className = '', ...props }: any) => <img src={source?.uri} className={`object-cover ${className}`} {...props} />;
// const ActivityIndicator = () => <span style={{ color: '#FFF', fontSize: '13px' }}>Loading...</span>;
// const KeyboardAvoidingView = ({ children, className = '' }: any) => <div className={`flex flex-col ${className}`}>{children}</div>;
// const ScrollView = ({ children, contentContainerClassName = '' }: any) => <div className={`overflow-y-auto ${contentContainerClassName}`}>{children}</div>;
// const Alert = { alert: (title: string, msg: string) => alert(`${title}: ${msg}`) };
// const Link = ({ children, href }: any) => React.cloneElement(children, { onClick: () => alert(`Navigating to ${href}`), style: { ...children.props.style, textDecoration: 'none' } });
// const useLoginMutation = () => ({ mutateAsync: async () => new Promise(r => setTimeout(r, 1500)), isPending: false });
// const useGoogleAuth = () => ({ signInWithGoogle: () => alert('Google Sign In Triggered'), isReady: true });
// // --- END MOCKS ---


// // ─────────────────────────────────────────────────────────────────────────────
// // AUTH LAYOUT COMPONENT
// // ─────────────────────────────────────────────────────────────────────────────

// interface AuthLayoutProps {
//   children: React.ReactNode;
//   title: string;
//   subtitle: string;
// }

// export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
//   return (
//     // MAIN CONTAINER: Stacked on mobile, side-by-side row on web (md:flex-row)
//     <KeyboardAvoidingView 
//       /* behavior={Platform.OS === 'ios' ? 'padding' : 'height'} */
//       className="flex-1 min-h-screen bg-[#F7F6F3] flex-col md:flex-row overflow-hidden"
//     >
//       <FontInjector />

//       {/* ── 1. HERO SECTION (Top on Mobile, Left on Desktop) ──────────────── */}
//       <View className="flex-[0.4] md:flex-[0.45] relative bg-[#1E1B1A]">
//         <Image
//           source={{ uri: 'https://images.unsplash.com/photo-1542314831-c6a42032207b?q=80&w=2000&auto=format&fit=crop' }}
//           className="absolute inset-0 w-full h-full opacity-85"
//         />
        
//         {/* Soft luxury gradient overlay */}
//         <View className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
//         {/* Top-left eyebrow brand indicator */}
//         <View className="absolute top-8 left-8 md:top-10 md:left-12 flex-row items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
//           <View className="w-2 h-2 rounded-full bg-[#DE6B48]" />
//           <Text className="text-white text-[11px] font-bold tracking-widest uppercase">TripSplit</Text>
//         </View>

//         {/* Branding text perfectly positioned */}
//         <View className="absolute bottom-16 md:top-1/2 md:-translate-y-1/2 left-8 md:left-12 right-8">
//           <Text 
//             className="text-4xl md:text-5xl font-bold text-white mb-3" 
//             style={{ fontFamily: '"Outfit", serif', letterSpacing: '-1px' }}
//           >
//             Split the journey,{'\n'}not the memories.
//           </Text>
//           <Text className="text-[13px] md:text-[14px] text-white/80 font-medium leading-relaxed max-w-[320px]">
//             The most elegant way to track expenses and settle up across every destination.
//           </Text>
//         </View>
//       </View>

//       {/* ── 2. FORM SECTION (Overlapping on Mobile, Right on Desktop) ─────── */}
//       <View className="flex-[0.6] md:flex-[0.55] bg-[#FFFFFF] rounded-t-[40px] md:rounded-none -mt-10 md:mt-0 z-10 shadow-[0_-12px_40px_rgba(0,0,0,0.06)] md:shadow-none overflow-hidden">
        
//         <ScrollView 
//           contentContainerClassName="flex-grow justify-center items-center p-8 md:p-16"
//           /* showsVerticalScrollIndicator={false} */
//           /* keyboardShouldPersistTaps="handled" */
//         >
//           {/* Form Inner Wrapper (Restricted width for elegance on large screens) */}
//           <View className="w-full max-w-[360px]">
            
//             {/* Header */}
//             <View className="mb-10 text-left">
//               <Text 
//                 className="text-[28px] font-bold text-[#1C1917] mb-2" 
//                 style={{ fontFamily: '"Outfit", serif', letterSpacing: '-0.5px' }}
//               >
//                 {title}
//               </Text>
//               <Text className="text-[13px] text-[#78716C] leading-relaxed">
//                 {subtitle}
//               </Text>
//             </View>

//             {/* Injected Screen Content (Login/Register Form) */}
//             {children}

//           </View>
//         </ScrollView>
//       </View>
      
//     </KeyboardAvoidingView>
//   );
// }


// // ─────────────────────────────────────────────────────────────────────────────
// // LOGIN SCREEN
// // ─────────────────────────────────────────────────────────────────────────────

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
//     <AuthLayout 
//       title="Welcome back" 
//       subtitle="Sign in to your account to continue planning your next adventure."
//     >
//       <View className="flex flex-col space-y-5">
        
//         {/* Email Input */}
//         <View className="flex flex-col space-y-2">
//           <Text className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-[1.5px]">
//             Email Address
//           </Text>
//           <View 
//             className={`flex-row items-center h-[52px] rounded-2xl px-4 border-[1.5px] transition-colors duration-300 ${
//               focusedInput === 'email' ? 'border-[#DE6B48] bg-[#FFFFFF]' : 'border-[#E7E5E4] bg-[#F7F6F3]'
//             }`}
//           >
//             <TextInput
//               className="flex-1 text-[14px] text-[#1C1917] w-full h-full"
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

//         {/* Password Input */}
//         <View className="flex flex-col space-y-2">
//           <View className="flex-row justify-between items-center">
//             <Text className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-[1.5px]">
//               Password
//             </Text>
//             <Link href="/(auth)/forgot-password" asChild>
//               <TouchableOpacity>
//                 <Text className="text-[11px] font-bold text-[#DE6B48]">Forgot Password?</Text>
//               </TouchableOpacity>
//             </Link>
//           </View>
//           <View 
//             className={`flex-row items-center h-[52px] rounded-2xl px-4 border-[1.5px] transition-colors duration-300 ${
//               focusedInput === 'password' ? 'border-[#DE6B48] bg-[#FFFFFF]' : 'border-[#E7E5E4] bg-[#F7F6F3]'
//             }`}
//           >
//             <TextInput
//               className="flex-1 text-[14px] text-[#1C1917] w-full h-full"
//               placeholder="••••••••"
//               placeholderTextColor="#A8A29E"
//               value={password}
//               onChangeText={setPassword}
//               onFocus={() => setFocusedInput('password')}
//               onBlur={() => setFocusedInput(null)}
//               secureTextEntry={secureText}
//             />
//             <TouchableOpacity onPress={() => setSecureText(!secureText)} className="p-2 -mr-2 opacity-60 hover:opacity-100 transition-opacity">
//               <Text className="text-[16px]">{secureText ? '👁' : '🙈'}</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* Login Button */}
//         <TouchableOpacity
//           onPress={handleLogin}
//           disabled={loginMutation.isPending}
//           className={`h-[56px] rounded-full items-center justify-center mt-2 flex-row transition-transform active:scale-[0.98] ${
//             loginMutation.isPending ? 'opacity-70' : 'opacity-100'
//           }`}
//           style={{ backgroundColor: '#DE6B48', boxShadow: '0 8px 24px rgba(222,107,72,0.25)' }}
//         >
//           {loginMutation.isPending ? (
//             <ActivityIndicator />
//           ) : (
//             <Text className="text-[14px] font-bold text-white tracking-[0.5px]">Log In</Text>
//           )}
//         </TouchableOpacity>

//         {/* Divider */}
//         <View className="flex-row items-center space-x-4 my-2">
//           <View className="flex-1 h-[1px] bg-[#E7E5E4]" />
//           <Text className="text-[11px] text-[#A8A29E] font-medium uppercase tracking-wide">Or continue with</Text>
//           <View className="flex-1 h-[1px] bg-[#E7E5E4]" />
//         </View>

//         {/* Social Buttons */}
//         <View className="flex-row justify-center space-x-4">
//           <TouchableOpacity
//             onPress={() => signInWithGoogle()}
//             disabled={!isReady}
//             className="w-[56px] h-[56px] rounded-full border border-[#E7E5E4] bg-[#FFFFFF] items-center justify-center transition-all hover:bg-[#F9FAFB] active:scale-95 shadow-sm"
//           >
//             <Text className="text-[20px] font-bold text-[#1C1917]" style={{ fontFamily: '"Outfit", serif' }}>G</Text>
//           </TouchableOpacity>

//           <TouchableOpacity className="w-[56px] h-[56px] rounded-full border border-[#E7E5E4] bg-[#FFFFFF] items-center justify-center transition-all hover:bg-[#F9FAFB] active:scale-95 shadow-sm">
//             <Text className="text-[20px] font-bold text-[#1C1917]" style={{ fontFamily: '"Outfit", serif' }}></Text>
//           </TouchableOpacity>
//         </View>

//         {/* Footer */}
//         <View className="flex-row justify-center mt-6">
//           <Text className="text-[13px] text-[#78716C]">Don't have an account? </Text>
//           <Link href="/(auth)/register" asChild>
//             <TouchableOpacity>
//               <Text className="text-[13px] font-bold text-[#DE6B48] ml-1">Sign up</Text>
//             </TouchableOpacity>
//           </Link>
//         </View>

//       </View>
//     </AuthLayout>
//   );
// }
// // import React from 'react';
// // import {
// //   View,
// //   Text,
// //   ImageBackground,
// //   Platform,
// //   useWindowDimensions,
// //   KeyboardAvoidingView,
// //   ScrollView,
// //   StyleSheet,
// // } from 'react-native';

// // interface AuthLayoutProps {
// //   children: React.ReactNode;
// //   title: string;
// //   subtitle: string;
// // }

// // // ─── Design Tokens — "Dark Horizon" ───────────────────────────────
// // // Inspired by premium dark-mode travel apps like Panora.
// // // Deep charcoal backgrounds, warm amber accent, frost-white text.
// // const COLORS = {
// //   // Backgrounds
// //   bg: '#0E0E10',          // Deep near-black
// //   heroOverlay: 'rgba(14, 14, 16, 0.45)',
// //   card: '#18181B',         // Slightly lifted dark surface
// //   cardBorder: '#2A2A2F',   // Subtle separator

// //   // Brand
// //   primary: '#F4845F',      // Warm coral/amber — premium travel feel
// //   primaryGlow: 'rgba(244, 132, 95, 0.25)',

// //   // Text
// //   text: '#F5F4F0',          // Off-white
// //   textMuted: '#7F7F8C',     // Warm grey for labels/subtitles
// //   textDim: '#3F3F47',       // Dividers / placeholder hints

// //   // Inputs
// //   input: '#222228',         // Slightly lifted input background
// //   inputFocus: '#2C2C34',    // On focus

// //   // Misc
// //   border: '#2A2A2F',
// //   success: '#4ADE80',
// // };

// // export { COLORS };

// // export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
// //   const { width } = useWindowDimensions();
// //   const isDesktop = Platform.OS === 'web' && width >= 768;

// //   if (isDesktop) {
// //     return (
// //       <View style={styles.webRoot}>
// //         {/* ── Left: Desert Hero ────────────────────── */}
// //         <View style={styles.webHero}>
// //           <ImageBackground
// //             source={require('../../assets/images/desert-hero.png')}
// //             style={StyleSheet.absoluteFillObject}
// //             resizeMode="cover"
// //           />
// //           {/* Dark gradient overlay from bottom */}
// //           <View style={styles.webHeroOverlay} />

// //           {/* Floating logo pill */}
// //           <View style={styles.webLogoPill}>
// //             <View style={styles.webLogoDot} />
// //             <Text style={styles.webLogoPillText}>TripSplit</Text>
// //           </View>

// //           <View style={styles.webHeroBrandBox}>
// //             <Text style={styles.webHeroBrand}>Split the journey,{'\n'}not the memories.</Text>
// //             <Text style={styles.webHeroTagline}>
// //               The most elegant way to track expenses{'\n'}across every destination.
// //             </Text>
// //           </View>
// //         </View>

// //         {/* ── Right: Form Panel ────────────────────── */}
// //         <View style={styles.webFormSide}>
// //           <ScrollView
// //             contentContainerStyle={styles.webFormScroll}
// //             showsVerticalScrollIndicator={false}
// //             keyboardShouldPersistTaps="handled"
// //           >
// //             <View style={styles.webCard}>
// //               {/* Eyebrow badge */}
// //               <View style={styles.eyebrowBadge}>
// //                 <View style={styles.eyebrowDot} />
// //                 <Text style={styles.eyebrowText}>TripSplit · Auth</Text>
// //               </View>

// //               <Text style={styles.heading}>{title}</Text>
// //               <Text style={styles.subheading}>{subtitle}</Text>

// //               {children}
// //             </View>
// //           </ScrollView>
// //         </View>
// //       </View>
// //     );
// //   }

// //   // ─── Mobile ───────────────────────────────────────────────────────
// //   return (
// //     <View style={styles.mobileRoot}>
// //       {/* Hero — top 42% */}
// //       <View style={styles.mobileHeroContainer}>
// //         <ImageBackground
// //           source={require('../../assets/images/desert-hero.png')}
// //           style={StyleSheet.absoluteFillObject}
// //           resizeMode="cover"
// //         />
// //         <View style={styles.mobileHeroOverlay} />
// //         {/* Logo */}
// //         <View style={styles.mobileLogoPill}>
// //           <View style={[styles.eyebrowDot, { width: 6, height: 6 }]} />
// //           <Text style={styles.mobileLogoText}>TripSplit</Text>
// //         </View>
// //         <Text style={styles.mobileHeroTitle}>
// //           Split the journey,{'\n'}not the memories.
// //         </Text>
// //       </View>

// //       {/* White card slides up */}
// //       <KeyboardAvoidingView
// //         style={styles.mobileCard}
// //         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
// //       >
// //         <ScrollView
// //           contentContainerStyle={styles.mobileScroll}
// //           showsVerticalScrollIndicator={false}
// //           keyboardShouldPersistTaps="handled"
// //         >
// //           <Text style={styles.heading}>{title}</Text>
// //           <Text style={styles.subheading}>{subtitle}</Text>
// //           {children}
// //         </ScrollView>
// //       </KeyboardAvoidingView>
// //     </View>
// //   );
// // }

// // const styles = StyleSheet.create({
// //   // ── Web ──────────────────────────────────────────────────────────
// //   webRoot: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     backgroundColor: COLORS.bg,
// //   },
// //   webHero: {
// //     flex: 1,
// //     position: 'relative',
// //     justifyContent: 'flex-end',
// //   },
// //   webHeroOverlay: {
// //     ...StyleSheet.absoluteFillObject,
// //     // Gradient from black at bottom to transparent at top
// //     backgroundColor: 'rgba(14,14,16,0.55)',
// //   },
// //   webLogoPill: {
// //     position: 'absolute',
// //     top: 28,
// //     left: 28,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     gap: 8,
// //     backgroundColor: 'rgba(14,14,16,0.55)',
// //     borderRadius: 100,
// //     paddingHorizontal: 14,
// //     paddingVertical: 8,
// //     borderWidth: 1,
// //     borderColor: 'rgba(255,255,255,0.1)',
// //   },
// //   webLogoDot: {
// //     width: 8,
// //     height: 8,
// //     borderRadius: 100,
// //     backgroundColor: COLORS.primary,
// //   },
// //   webLogoPillText: {
// //     color: '#FFFFFF',
// //     fontSize: 12,
// //     fontWeight: '600',
// //     letterSpacing: 0.5,
// //   },
// //   webHeroBrandBox: {
// //     padding: 44,
// //   },
// //   webHeroBrand: {
// //     fontSize: 36,
// //     fontWeight: '700',
// //     color: '#FFFFFF',
// //     lineHeight: 46,
// //     letterSpacing: -0.5,
// //     marginBottom: 14,
// //     fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
// //   },
// //   webHeroTagline: {
// //     fontSize: 15,
// //     lineHeight: 24,
// //     color: 'rgba(255,255,255,0.65)',
// //     fontWeight: '400',
// //   },

// //   // Right form panel
// //   webFormSide: {
// //     width: 540,  // Fixed, wider form panel
// //     backgroundColor: COLORS.bg,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },
// //   webFormScroll: {
// //     flexGrow: 1,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     paddingHorizontal: 44,
// //     paddingVertical: 48,
// //   },
// //   webCard: {
// //     width: '100%',
// //     maxWidth: 460,  // Wider form card
// //     backgroundColor: COLORS.card,
// //     borderRadius: 24,
// //     padding: 40,
// //     borderWidth: 1,
// //     borderColor: COLORS.cardBorder,
// //     shadowColor: '#000000',
// //     shadowOffset: { width: 0, height: 16 },
// //     shadowOpacity: 0.4,
// //     shadowRadius: 40,
// //     elevation: 8,
// //   },

// //   // Eyebrow badge
// //   eyebrowBadge: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     gap: 8,
// //     backgroundColor: 'rgba(244, 132, 95, 0.1)',
// //     alignSelf: 'flex-start',
// //     borderRadius: 100,
// //     paddingHorizontal: 12,
// //     paddingVertical: 6,
// //     marginBottom: 24,
// //     borderWidth: 1,
// //     borderColor: 'rgba(244, 132, 95, 0.2)',
// //   },
// //   eyebrowDot: {
// //     width: 6,
// //     height: 6,
// //     borderRadius: 100,
// //     backgroundColor: COLORS.primary,
// //   },
// //   eyebrowText: {
// //     fontSize: 11,
// //     fontWeight: '600',
// //     color: COLORS.primary,
// //     letterSpacing: 0.8,
// //   },

// //   // ── Mobile ────────────────────────────────────────────────────────
// //   mobileRoot: {
// //     flex: 1,
// //     backgroundColor: COLORS.bg,
// //   },
// //   mobileHeroContainer: {
// //     height: '42%',
// //     position: 'relative',
// //     justifyContent: 'flex-end',
// //     padding: 28,
// //     paddingBottom: 52,
// //   },
// //   mobileHeroOverlay: {
// //     ...StyleSheet.absoluteFillObject,
// //     backgroundColor: 'rgba(14, 14, 16, 0.5)',
// //   },
// //   mobileLogoPill: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     gap: 6,
// //     position: 'absolute',
// //     top: 20,
// //     left: 24,
// //     backgroundColor: 'rgba(14,14,16,0.5)',
// //     borderRadius: 100,
// //     paddingHorizontal: 12,
// //     paddingVertical: 6,
// //     borderWidth: 1,
// //     borderColor: 'rgba(255,255,255,0.12)',
// //   },
// //   mobileLogoText: {
// //     fontSize: 12,
// //     fontWeight: '600',
// //     color: '#FFFFFF',
// //     letterSpacing: 0.4,
// //   },
// //   mobileHeroTitle: {
// //     fontSize: 26,
// //     fontWeight: '700',
// //     color: '#FFFFFF',
// //     lineHeight: 34,
// //     letterSpacing: -0.3,
// //     fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
// //   },
// //   mobileCard: {
// //     flex: 1,
// //     marginTop: -28,
// //     backgroundColor: COLORS.card,
// //     borderTopLeftRadius: 32,
// //     borderTopRightRadius: 32,
// //     borderWidth: 1,
// //     borderColor: COLORS.cardBorder,
// //     shadowColor: '#000000',
// //     shadowOffset: { width: 0, height: -8 },
// //     shadowOpacity: 0.3,
// //     shadowRadius: 20,
// //     elevation: 8,
// //   },
// //   mobileScroll: {
// //     paddingHorizontal: 28,
// //     paddingTop: 32,
// //     paddingBottom: 60,
// //   },

// //   // ── Shared Typography ─────────────────────────────────────────────
// //   heading: {
// //     fontSize: 28,
// //     fontWeight: '700',
// //     color: COLORS.text,
// //     letterSpacing: -0.3,
// //     marginBottom: 6,
// //     fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
// //   },
// //   subheading: {
// //     fontSize: 14,
// //     color: COLORS.textMuted,
// //     lineHeight: 22,
// //     marginBottom: 28,
// //   },
// // });
