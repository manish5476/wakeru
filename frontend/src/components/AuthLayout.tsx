import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
} from 'react-native';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

// ─── Design Tokens — "Dark Horizon" ───────────────────────────────
// Inspired by premium dark-mode travel apps like Panora.
// Deep charcoal backgrounds, warm amber accent, frost-white text.
const COLORS = {
  // Backgrounds
  bg: '#0E0E10',          // Deep near-black
  heroOverlay: 'rgba(14, 14, 16, 0.45)',
  card: '#18181B',         // Slightly lifted dark surface
  cardBorder: '#2A2A2F',   // Subtle separator

  // Brand
  primary: '#F4845F',      // Warm coral/amber — premium travel feel
  primaryGlow: 'rgba(244, 132, 95, 0.25)',

  // Text
  text: '#F5F4F0',          // Off-white
  textMuted: '#7F7F8C',     // Warm grey for labels/subtitles
  textDim: '#3F3F47',       // Dividers / placeholder hints

  // Inputs
  input: '#222228',         // Slightly lifted input background
  inputFocus: '#2C2C34',    // On focus

  // Misc
  border: '#2A2A2F',
  success: '#4ADE80',
};

export { COLORS };

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (isDesktop) {
    return (
      <View style={styles.webRoot}>
        {/* ── Left: Desert Hero ────────────────────── */}
        <View style={styles.webHero}>
          <ImageBackground
            source={require('../../assets/images/desert-hero.png')}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          {/* Dark gradient overlay from bottom */}
          <View style={styles.webHeroOverlay} />

          {/* Floating logo pill */}
          <View style={styles.webLogoPill}>
            <View style={styles.webLogoDot} />
            <Text style={styles.webLogoPillText}>TripSplit</Text>
          </View>

          <View style={styles.webHeroBrandBox}>
            <Text style={styles.webHeroBrand}>Split the journey,{'\n'}not the memories.</Text>
            <Text style={styles.webHeroTagline}>
              The most elegant way to track expenses{'\n'}across every destination.
            </Text>
          </View>
        </View>

        {/* ── Right: Form Panel ────────────────────── */}
        <View style={styles.webFormSide}>
          <ScrollView
            contentContainerStyle={styles.webFormScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.webCard}>
              {/* Eyebrow badge */}
              <View style={styles.eyebrowBadge}>
                <View style={styles.eyebrowDot} />
                <Text style={styles.eyebrowText}>TripSplit · Auth</Text>
              </View>

              <Text style={styles.heading}>{title}</Text>
              <Text style={styles.subheading}>{subtitle}</Text>

              {children}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ─── Mobile ───────────────────────────────────────────────────────
  return (
    <View style={styles.mobileRoot}>
      {/* Hero — top 42% */}
      <View style={styles.mobileHeroContainer}>
        <ImageBackground
          source={require('../../assets/images/desert-hero.png')}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <View style={styles.mobileHeroOverlay} />
        {/* Logo */}
        <View style={styles.mobileLogoPill}>
          <View style={[styles.eyebrowDot, { width: 6, height: 6 }]} />
          <Text style={styles.mobileLogoText}>TripSplit</Text>
        </View>
        <Text style={styles.mobileHeroTitle}>
          Split the journey,{'\n'}not the memories.
        </Text>
      </View>

      {/* White card slides up */}
      <KeyboardAvoidingView
        style={styles.mobileCard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.mobileScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.subheading}>{subtitle}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Web ──────────────────────────────────────────────────────────
  webRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
  },
  webHero: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  webHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Gradient from black at bottom to transparent at top
    backgroundColor: 'rgba(14,14,16,0.55)',
  },
  webLogoPill: {
    position: 'absolute',
    top: 28,
    left: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14,14,16,0.55)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  webLogoDot: {
    width: 8,
    height: 8,
    borderRadius: 100,
    backgroundColor: COLORS.primary,
  },
  webLogoPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  webHeroBrandBox: {
    padding: 44,
  },
  webHeroBrand: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 14,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  webHeroTagline: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '400',
  },

  // Right form panel
  webFormSide: {
    width: 540,  // Fixed, wider form panel
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFormScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 44,
    paddingVertical: 48,
  },
  webCard: {
    width: '100%',
    maxWidth: 460,  // Wider form card
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 40,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 8,
  },

  // Eyebrow badge
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 132, 95, 0.1)',
    alignSelf: 'flex-start',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(244, 132, 95, 0.2)',
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 100,
    backgroundColor: COLORS.primary,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },

  // ── Mobile ────────────────────────────────────────────────────────
  mobileRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  mobileHeroContainer: {
    height: '42%',
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 28,
    paddingBottom: 52,
  },
  mobileHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 14, 16, 0.5)',
  },
  mobileLogoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'absolute',
    top: 20,
    left: 24,
    backgroundColor: 'rgba(14,14,16,0.5)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mobileLogoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  mobileHeroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 34,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  mobileCard: {
    flex: 1,
    marginTop: -28,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  mobileScroll: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 60,
  },

  // ── Shared Typography ─────────────────────────────────────────────
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  subheading: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 28,
  },
});
