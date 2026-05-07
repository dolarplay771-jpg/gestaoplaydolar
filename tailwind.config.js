/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
    "./App.tsx",
    "./index.tsx"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        gold: {
          100: '#FBF5E6',
          200: '#F3E2B5',
          300: '#EBCF84',
          400: '#E3BC53',
          500: '#D4AF37',
          600: '#AA8C2C',
          700: '#806921',
          800: '#554616',
          900: '#2B230B',
        },
        dark: {
          950: '#020202',
          900: '#080808',
          800: '#121212',
          700: '#1C1C1C',
        },
        primary: '#D4AF37',
        primaryDark: '#AA8C2C',
        surface: '#121212',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #E3BC53 0%, #F3E2B5 50%, #D4AF37 100%)',
        'gold-text': 'linear-gradient(to right, #E3BC53, #F3E2B5, #AA8C2C)',
        'premium-glow': 'radial-gradient(circle at center, rgba(212, 175, 55, 0.08) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(180deg, rgba(28, 28, 28, 0.4) 0%, rgba(18, 18, 18, 0.4) 100%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(212, 175, 55, 0.15)',
        'glow-hover': '0 0 30px rgba(212, 175, 55, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
