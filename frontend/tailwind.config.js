/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e8f0fe',
          100: '#c5d8fd',
          200: '#9db8fb',
          300: '#6f94f8',
          400: '#4c77f5',
          500: '#0073ea',
          600: '#0060c7',
          700: '#004da4',
          800: '#003980',
          900: '#002557',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
