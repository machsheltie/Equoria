/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'sky-blue': '#4FC3F7',
        navy: '#1E3A8A',
        forest: '#2F4F4F',
        lime: '#32CD32',
        silver: '#D3D3D3',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'cursive'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
