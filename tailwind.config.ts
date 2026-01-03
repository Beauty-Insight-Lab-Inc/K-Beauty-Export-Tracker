import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom "Report" Theme Palette
        'report-blue': {
          DEFAULT: '#1e3a8a', // Deep Navy (Financial Trust)
          50: '#eff6ff',
          100: '#dbeafe',
          900: '#1e3a8a',
        },
        'report-teal': {
          DEFAULT: '#0d9488', // Teal (Growth/Positive)
          50: '#f0fdfa',
          100: '#ccfbf1',
          600: '#0d9488',
        },
        'report-rose': {
          DEFAULT: '#e11d48', // Rose Pink (Decline/Negative/China)
          50: '#fff1f2',
          100: '#ffe4e6',
          600: '#e11d48',
        }
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          'sans-serif'
        ],
      }
    },
  },
  plugins: [],
};

export default config;
