const fs = require('fs');
const path = require('path');

// 1. Update (auth)/_layout.tsx
const authLayoutPath = 'd:/Split/New/TripSplit/src/app/(auth)/_layout.tsx';
let authLayout = fs.readFileSync(authLayoutPath, 'utf8');
if (!authLayout.includes('name="verify-email"')) {
  authLayout = authLayout.replace(
    '<Stack.Screen name="forgot-password" />',
    '<Stack.Screen name="forgot-password" />\n                <Stack.Screen name="verify-email" />'
  );
  fs.writeFileSync(authLayoutPath, authLayout, 'utf8');
  console.log('Updated (auth)/_layout.tsx');
}

// 2. Update register.tsx
const registerPath = 'd:/Split/New/TripSplit/src/app/(auth)/register.tsx';
let registerContent = fs.readFileSync(registerPath, 'utf8');
const oldRegisterSnippet = `            await registerWithEmail(trimmedEmail, password, trimmedName, '');
            showToast.success(
                'Account Created!',
                'A verification link was sent to your email. Please check your inbox.'
            );
            router.replace('/(app)/(tabs)/home');`;

const newRegisterSnippet = `            await registerWithEmail(trimmedEmail, password, trimmedName, '');
            showToast.success(
                'Account Created!',
                'A verification link was sent to your email. Please verify your email before logging in.'
            );
            router.replace({
                pathname: '/(auth)/verify-email',
                params: { email: trimmedEmail }
            });`;

if (registerContent.includes(oldRegisterSnippet)) {
  registerContent = registerContent.replace(oldRegisterSnippet, newRegisterSnippet);
  fs.writeFileSync(registerPath, registerContent, 'utf8');
  console.log('Updated register.tsx');
} else {
  console.log('register.tsx snippet already updated or not found');
}

// 3. Update login.tsx
const loginPath = 'd:/Split/New/TripSplit/src/app/(auth)/login.tsx';
let loginContent = fs.readFileSync(loginPath, 'utf8');
const oldLoginCatch = `        } catch (e: any) {
            if (e?.code === 'EMAIL_NOT_VERIFIED' || e?.message?.toLowerCase().includes('verify your email')) {
                Alert.alert(
                    'Email Verification Required',
                    'Your email address has not been verified yet. Please check your inbox and spam folder for the verification link.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Resend Email',
                            onPress: async () => {
                                try {
                                    await resendVerificationEmail(email.trim());
                                    showToast.success('Email Sent', \`A new verification link has been sent to \${email.trim()}.\`);
                                } catch (resendErr: any) {
                                    showToast.error('Resend Failed', resendErr.message || 'Could not resend verification email.');
                                }
                            }
                        }
                    ]
                );
            } else {
                showToast.fromError(e, 'Login Failed');
            }`;

const newLoginCatch = `        } catch (e: any) {
            if (e?.code === 'EMAIL_NOT_VERIFIED' || e?.message?.toLowerCase().includes('verify your email')) {
                router.push({
                    pathname: '/(auth)/verify-email',
                    params: { email: email.trim() }
                });
            } else {
                showToast.fromError(e, 'Login Failed');
            }`;

if (loginContent.includes(oldLoginCatch)) {
  loginContent = loginContent.replace(oldLoginCatch, newLoginCatch);
  fs.writeFileSync(loginPath, loginContent, 'utf8');
  console.log('Updated login.tsx');
}

// 4. Update auth.store.ts
const authStorePath = 'd:/Split/New/TripSplit/src/stores/auth.store.ts';
let authStoreContent = fs.readFileSync(authStorePath, 'utf8');

// In loginWithEmail: check emailVerified before token exchange
const oldLoginWithEmail = `            // 1. Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await userCredential.user.getIdToken(true);

            // 2. Backend login (exchange Firebase token for JWT)
            const response = await authApi.login(idToken);`;

const newLoginWithEmail = `            // 1. Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Enforce email verification for password accounts
            if (!userCredential.user.emailVerified) {
                await signOut(auth).catch(() => {});
                set({
                    firebaseUser: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
                const err = new Error('Please verify your email address before logging in.');
                err.code = 'EMAIL_NOT_VERIFIED';
                throw err;
            }

            const idToken = await userCredential.user.getIdToken(true);

            // 2. Backend login (exchange Firebase token for JWT)
            const response = await authApi.login(idToken);`;

if (authStoreContent.includes(oldLoginWithEmail)) {
  authStoreContent = authStoreContent.replace(oldLoginWithEmail, newLoginWithEmail);
  fs.writeFileSync(authStorePath, authStoreContent, 'utf8');
  console.log('Updated loginWithEmail in auth.store.ts');
} else {
  console.log('loginWithEmail already updated in auth.store.ts');
}

console.log('All frontend auth flow updates applied successfully.');
