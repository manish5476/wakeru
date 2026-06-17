/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- 1. CORE BRAND SCALES ---
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',      // Light Orange
          500: '#f97316',      // Brand Base (Orange)
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          DEFAULT: '#f97316',
          foreground: '#ffffff',
        },
        // Auth Section Theme
        auth: {
          dark: '#0A0A0A',
          webBg: '#09271E',      // Dark emerald for web gradient
          webCard: '#121212',
          webText: '#FFFFFF',
          webInput: '#1C1C1C',
          mobileBg: '#FFFFFF',
          mobileInput: '#E8EFE9', // Light pale green
          mobileBtn: '#3A5C45',   // Dark plant green
          mobileText: '#2D3A31',
        },

        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#a855f7',      // Purple
          600: '#9333ea',
          900: '#581c87',
          DEFAULT: '#a855f7',
          foreground: '#ffffff',
        },

        accent: {
          50: '#f0fdfa',
          500: '#14b8a6',      // Teal
          900: '#134e4a',
          DEFAULT: '#14b8a6',
        },
        
        // --- 2. NEUTRAL/GRAY SCALES (For UI depth, borders, text hierarchy) ---
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617', // Deepest background
        },

        // --- 3. SEMANTIC ALERTS & STATES ---
        success: { DEFAULT: '#10B981', background: '#d1fae5', border: '#34d399' },
        error: { DEFAULT: '#EF4444', background: '#fee2e2', border: '#f87171' },
        warning: { DEFAULT: '#F59E0B', background: '#fef3c7', border: '#fbbf24' },
        info: { DEFAULT: '#3B82F6', background: '#dbeafe', border: '#60a5fa' },

        // --- 4. ALIASED TOKENS (Abstracted for easy Dark/Light switching) ---
        background: '#020617', // Deep dark mode base
        surface: {
          DEFAULT: '#0f172a',  // Cards, Modals
          light: '#1e293b',    // Hover states, elevated cards
          dark: '#020617',
        },
        border: {
          DEFAULT: '#1e293b',
          focus: '#fb923c',    // Focus ring matches light orange
        },
        text: {
          DEFAULT: '#f8fafc',  // Primary Text
          muted: '#94a3b8',    // Secondary Text / Subtitles
          inverse: '#0f172a',  // Dark text on light backgrounds
        },
        textMuted: '#94a3b8', // Backward compatibility for existing screens
      },

      // --- 5. TYPOGRAPHY SCALES ---
      fontFamily: {
        sans: ['Inter', 'System', 'sans-serif'],
        bold: ['InterBold', 'System', 'sans-serif'],
        mono: ['Menlo', 'monospace'],
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'sm': ['14px', { lineHeight: '20px', letterSpacing: '0.01em' }],
        'base': ['16px', { lineHeight: '24px', letterSpacing: '0em' }],
        'lg': ['18px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        'xl': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        '3xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        '4xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.03em' }],
        '5xl': ['48px', { lineHeight: '48px', letterSpacing: '-0.04em' }],
      },

      // --- 6. SPACING, PADDING, BORDER WIDTHS ---
      borderWidth: {
        '3': '3px',
        '0.5': '0.5px',
      },
      spacing: {
        '4.5': '1.125rem', // 18px
        '18': '4.5rem',    // 72px
        '22': '5.5rem',    // 88px
        '26': '6.5rem',
        '30': '7.5rem',
        '112': '28rem',    // 448px (Standard Max Width for forms)
        '128': '32rem',
      },

      // --- 7. RADII (Border Radius) ---
      borderRadius: {
        'none': '0',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        'full': '9999px',
      },

      // --- 8. SHADOWS / ELEVATION ---
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)', // Deep shadow for glassmorphism panels
        'glow-primary': '0 0 15px -3px rgba(249, 115, 22, 0.4)', // Orange glow
        'none': '0 0 #0000',
      },

      // --- 9. Z-INDEX (Layering System) ---
      zIndex: {
        '0': '0',
        '10': '10',   // Sticky headers
        '20': '20',   // Overlays / Backdrops
        '30': '30',   // Floating Action Buttons (FAB)
        '40': '40',   // Modals / Bottom Sheets
        '50': '50',   // Toasts / Notifications / Popovers
      },

      // --- 10. OPACITY (For Glassmorphism & Overlays) ---
      opacity: {
        '3': '0.03',
        '5': '0.05',
        '15': '0.15',
        '85': '0.85',
        '95': '0.95',
      }
    },
  },
  plugins: [],
}

