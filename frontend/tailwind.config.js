/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  
  presets: [require("nativewind/preset")],
  
  darkMode: 'class',
  
  theme: {
    extend: {
      // ═══════════════════════════════════════════
      // 1. DYNAMIC COLOR TOKENS (CSS Variables)
      // ═══════════════════════════════════════════
      colors: {
        // Brand colors
        brand: {
          primary: 'var(--brand-primary)',
          'primary-hover': 'var(--brand-primary-hover)',
          'primary-active': 'var(--brand-primary-active)',
          'primary-light': 'var(--brand-primary-light)',
          'primary-glow': 'var(--brand-primary-glow)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
        },
        
        // Surface hierarchy
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          glass: 'var(--surface-glass)',
          'glass-dark': 'var(--surface-glass-dark)',
        },
        
        // Text hierarchy
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          quaternary: 'var(--text-quaternary)',
          inverse: 'var(--text-inverse)',
          brand: 'var(--text-brand)',
          link: 'var(--text-link)',
        },
        
        // Border system
        border: {
          light: 'var(--border-light)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
          error: 'var(--border-error)',
        },
        
        // Semantic colors (not themed)
        success: {
          DEFAULT: '#10B981',
          bg: 'rgba(16, 185, 129, 0.1)',
          border: '#34D399',
          text: '#065F46',
        },
        error: {
          DEFAULT: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.1)',
          border: '#F87171',
          text: '#991B1B',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.1)',
          border: '#FBBF24',
          text: '#92400E',
        },
        info: {
          DEFAULT: '#3B82F6',
          bg: 'rgba(59, 130, 246, 0.1)',
          border: '#60A5FA',
          text: '#1E40AF',
        },
        
        // Static color scales (not themed)
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0A0A0A',
        },
        
        transparent: 'transparent',
        current: 'currentColor',
      },

      // ═══════════════════════════════════════════
      // 2. TYPOGRAPHY SYSTEM
      // ═══════════════════════════════════════════
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.05em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
        'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.03em' }],
        '5xl': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.03em' }],
        '6xl': ['3.75rem', { lineHeight: '4.25rem', letterSpacing: '-0.04em' }],
        'hero': ['4.5rem', { lineHeight: '5rem', letterSpacing: '-0.04em' }],
      },
      
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      
      lineHeight: {
        tight: 'var(--leading-tight)',
        snug: 'var(--leading-snug)',
        normal: 'var(--leading-normal)',
        relaxed: 'var(--leading-relaxed)',
        loose: 'var(--leading-loose)',
      },
      
      letterSpacing: {
        tighter: 'var(--tracking-tighter)',
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
        wider: 'var(--tracking-wider)',
        widest: 'var(--tracking-widest)',
      },

      // ═══════════════════════════════════════════
      // 3. SPACING SCALE
      // ═══════════════════════════════════════════
      spacing: {
        '0': 'var(--space-0)',
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        '24': 'var(--space-24)',
        '32': 'var(--space-32)',
        '112': '28rem',
        '128': '32rem',
      },

      // ═══════════════════════════════════════════
      // 4. BORDER RADIUS
      // ═══════════════════════════════════════════
      borderRadius: {
        'none': 'var(--radius-none)',
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'DEFAULT': 'var(--radius-md)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        'full': 'var(--radius-full)',
      },

      // ═══════════════════════════════════════════
      // 5. SHADOWS / ELEVATION
      // ═══════════════════════════════════════════
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow-md)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        'glow-brand': 'var(--shadow-glow-brand)',
        'float': 'var(--shadow-float)',
      },

      // ═══════════════════════════════════════════
      // 6. ANIMATION
      // ═══════════════════════════════════════════
      transitionDuration: {
        'instant': 'var(--duration-instant)',
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'very-slow': 'var(--duration-very-slow)',
      },
      
      transitionTimingFunction: {
        'default': 'var(--ease-default)',
        'in': 'var(--ease-in)',
        'out': 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        'spring': 'var(--ease-spring)',
        'bounce': 'var(--ease-bounce)',
      },
      
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-left': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--brand-primary-glow)' },
          '50%': { boxShadow: '0 0 0 12px transparent' },
        },
      },
      
      animation: {
        'slide-up': 'slide-up var(--duration-normal) var(--ease-out)',
        'slide-down': 'slide-down var(--duration-normal) var(--ease-out)',
        'slide-left': 'slide-left var(--duration-normal) var(--ease-out)',
        'fade-in': 'fade-in var(--duration-normal) var(--ease-out)',
        'scale-in': 'scale-in var(--duration-normal) var(--ease-spring)',
        'float': 'float 3s var(--ease-in-out) infinite',
        'pulse-glow': 'pulse-glow 2s var(--ease-in-out) infinite',
      },

      // ═══════════════════════════════════════════
      // 7. LAYOUT & SIZING
      // ═══════════════════════════════════════════
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      
      maxWidth: {
        'container-sm': 'var(--container-sm)',
        'container-md': 'var(--container-md)',
        'container-lg': 'var(--container-lg)',
        'container-xl': 'var(--container-xl)',
        'container-2xl': 'var(--container-2xl)',
      },

      // ═══════════════════════════════════════════
      // 8. Z-INDEX
      // ═══════════════════════════════════════════
      zIndex: {
        '0': 'var(--z-base)',
        '10': 'var(--z-docked)',
        '20': 'var(--z-dropdown)',
        '30': 'var(--z-sticky)',
        '40': 'var(--z-overlay)',
        '50': 'var(--z-modal)',
        '60': 'var(--z-toast)',
        '70': 'var(--z-tooltip)',
      },
    },
  },
  
  plugins: [
    // Custom plugin for TripSplit utilities
    function({ addUtilities, addComponents, theme }) {
      addUtilities({
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.text-pretty': {
          'text-wrap': 'pretty',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      });
      
      addComponents({
        '.glassmorphism': {
          'backdrop-filter': 'blur(20px)',
          'background': 'var(--surface-glass)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
          'box-shadow': 'var(--shadow-lg)',
        },
      });
    },
  ],
};