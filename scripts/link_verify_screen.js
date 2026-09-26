const fs = require('fs');

// 1. Update register.tsx to navigate to verify-email directly
const registerPath = 'd:/Split/New/TripSplit/src/app/(auth)/register.tsx';
let reg = fs.readFileSync(registerPath, 'utf8');

const oldBlock = `        setIsSubmitting(true);
        try {
            await registerWithEmail(trimmedEmail, password, trimmedName, '');
            showToast.success(
                'Account Created!',
                'Verification email sent. Please verify your email before logging in.'
            );
            Alert.alert(
                'Verify Your Email',
                \`A verification link has been sent to \${trimmedEmail}.\\n\\nPlease check your inbox (and spam folder) to verify your account before logging in.\`,
                [
                    {
                        text: 'Go to Login',
                        onPress: () => {
                            router.replace({
                                pathname: '/(auth)/login',
                                params: { email: trimmedEmail, unverified: '1' }
                            });
                        }
                    }
                ]
            );
        } catch (err: any) {`;

const newBlock = `        setIsSubmitting(true);
        try {
            await registerWithEmail(trimmedEmail, password, trimmedName, '');
            showToast.success(
                'Account Created!',
                'A verification link has been sent to your email.'
            );
            router.replace({
                pathname: '/(auth)/verify-email',
                params: { email: trimmedEmail }
            });
        } catch (err: any) {`;

if (reg.includes(oldBlock)) {
    reg = reg.replace(oldBlock, newBlock);
    fs.writeFileSync(registerPath, reg, 'utf8');
    console.log('Successfully updated register.tsx to navigate to verify-email');
} else {
    console.log('register.tsx oldBlock not found, checking alternative...');
}

// 2. Update login.tsx to navigate to verify-email on unverified
const loginPath = 'd:/Split/New/TripSplit/src/app/(auth)/login.tsx';
let log = fs.readFileSync(loginPath, 'utf8');

const oldLoginErr = `        } catch (e: any) {
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
            }
        }`;

const newLoginErr = `        } catch (e: any) {
            if (e?.code === 'EMAIL_NOT_VERIFIED' || e?.message?.toLowerCase().includes('verify your email')) {
                router.push({
                    pathname: '/(auth)/verify-email',
                    params: { email: email.trim() }
                });
            } else {
                showToast.fromError(e, 'Login Failed');
            }
        }`;

if (log.includes(oldLoginErr)) {
    log = log.replace(oldLoginErr, newLoginErr);
    fs.writeFileSync(loginPath, log, 'utf8');
    console.log('Successfully updated login.tsx to route to verify-email');
} else {
    console.log('login.tsx oldLoginErr not found');
}
