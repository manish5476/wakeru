const fs = require('fs');
const path = 'd:/Split/New/TripSplit/src/app/(auth)/verify-email.tsx';

const content = `// app/(auth)/verify-email.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    useWindowDimensions,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../stores/auth.store';
import { useTheme } from '../../providers/ThemeProvider';
import { GlassCard } from '../../components/ui/GlassCard';
import { Typography } from '../../components/ui/Typography';
import AppIcon from '../../components/common/AppIcon';
import { showToast } from '../../utils/toast';
import { haptics } from '../../utils/haptics';

export default function VerifyEmailScreen() {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && width > 768;

    const params = useLocalSearchParams<{ email?: string }>();
    const email = params.email || '';

    const { resendVerificationEmail } = useAuthStore();

    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (cooldown > 0 || isResending) return;
        haptics.light();
        setIsResending(true);
        try {
            await resendVerificationEmail(email);
            showToast.success('Email Sent!', 'A fresh verification link has been sent to ' + email + '.');
            setCooldown(60);
        } catch (err) {
            showToast.error('Resend Failed', err.message || 'Could not send verification email.');
        } finally {
            setIsResending(false);
        }
    };

    const handleProceedToLogin = () => {
        haptics.medium();
        router.replace({
            pathname: '/(auth)/login',
            params: { email }
        });
    };

    return (
        <View style={styles.container}>
            <View style={[styles.cardWrapper, isDesktop && styles.desktopCardWrapper]}>
                <Animated.View entering={FadeInUp.duration(500)}>
                    <GlassCard style={styles.card} intensity={theme.isDark ? 25 : 15}>
                        {/* Top Icon Badge */}
                        <View style={styles.iconCircleOuter}>
                            <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryBg }]}>
                                <AppIcon name="mail" size={36} color={theme.colors.primary} />
                            </View>
                        </View>

                        {/* Title & Description */}
                        <View style={styles.headerBlock}>
                            <Typography variant="h2" weight="bold" color="textPrimary" style={styles.title}>
                                Verify Your Email
                            </Typography>
                            <Typography variant="body" color="textSecondary" style={styles.subtitle}>
                                We have sent a verification link to:
                            </Typography>
                            <View style={[styles.emailBadge, { backgroundColor: theme.colors.cardSurface }]}>
                                <AppIcon name="at-sign" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                                <Typography variant="subtitle" weight="bold" color="textPrimary" numberOfLines={1}>
                                    {email || 'your account email'}
                                </Typography>
                            </View>
                        </View>

                        {/* Instructions */}
                        <View style={[styles.infoBox, { backgroundColor: theme.isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.06)' }]}>
                            <AppIcon name="info" size={18} color="#3B82F6" style={{ marginTop: 2, marginRight: 10 }} />
                            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                                Please check your inbox (and spam folder) and click the link to activate your account. You cannot log in until your email is verified.
                            </Text>
                        </View>

                        {/* Primary Button: Proceed to Login */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.primaryBtn,
                                { backgroundColor: theme.colors.primary },
                                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }
                            ]}
                            onPress={handleProceedToLogin}
                        >
                            <Text style={styles.primaryBtnText}>I Have Verified My Email &bull; Log In</Text>
                            <AppIcon name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                        </Pressable>

                        {/* Secondary Button: Resend */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.secondaryBtn,
                                { borderColor: theme.colors.borderLight },
                                pressed && { backgroundColor: theme.colors.primaryBg },
                                (isResending || cooldown > 0) && { opacity: 0.6 }
                            ]}
                            onPress={handleResend}
                            disabled={isResending || cooldown > 0}
                        >
                            {isResending ? (
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                            ) : (
                                <>
                                    <AppIcon name="refresh-cw" size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                                    <Text style={[styles.secondaryBtnText, { color: theme.colors.textPrimary }]}>
                                        {cooldown > 0 ? 'Resend email in ' + cooldown + 's' : 'Resend Verification Email'}
                                    </Text>
                                </>
                            )}
                        </Pressable>

                        {/* Back Link */}
                        <Pressable
                            style={styles.backLink}
                            onPress={() => router.replace('/(auth)/login')}
                        >
                            <AppIcon name="arrow-left" size={14} color={theme.colors.textTertiary} style={{ marginRight: 4 }} />
                            <Typography variant="caption" weight="semibold" color="textTertiary">
                                Back to Sign In
                            </Typography>
                        </Pressable>
                    </GlassCard>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    cardWrapper: {
        width: '100%',
        maxWidth: 440,
    },
    desktopCardWrapper: {
        maxWidth: 480,
    },
    card: {
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
    },
    iconCircleOuter: {
        marginBottom: 20,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBlock: {
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 14,
        lineHeight: 20,
    },
    emailBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        maxWidth: '100%',
    },
    infoBox: {
        flexDirection: 'row',
        padding: 14,
        borderRadius: 14,
        marginBottom: 24,
        width: '100%',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    primaryBtn: {
        width: '100%',
        height: 52,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 15,
    },
    secondaryBtn: {
        width: '100%',
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    secondaryBtnText: {
        fontWeight: '600',
        fontSize: 14,
    },
    backLink: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
});
`;

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully wrote verify-email.tsx');
