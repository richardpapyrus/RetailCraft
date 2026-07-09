/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Brand accent — deep forest green. Reserved for key actions,
                // active states and important metrics only.
                brand: {
                    50: '#EEF6F4',
                    100: '#D9EDE8',
                    200: '#B0DDD2',
                    300: '#7BCCB7',
                    400: '#39AC8F',
                    500: '#235347',
                    600: '#1C4339',
                    700: '#15342C',
                    800: '#102621',
                    900: '#0B1B17',
                },
                primary: "#235347",
                // Calm neutral surfaces (white-dominant backgrounds)
                canvas: "#FAFAFA",
                surface: "#FFFFFF",
                "surface-muted": "#F3F3F3",
                "cool-grey": "#DCE3E3",
                "mid-grey": "#A9B0B0",
                charcoal: "#4A4A4A",
                "background-light": "#ffffff",
                "background-dark": "#0f172a",
            },
            fontFamily: {
                sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
                display: ["Inter", "sans-serif"],
            },
            boxShadow: {
                // Soft elevation system — premium cards never use harsh shadows
                soft: '0 1px 2px rgba(16, 42, 39, 0.04), 0 2px 8px rgba(16, 42, 39, 0.04)',
                card: '0 2px 12px rgba(16, 42, 39, 0.05)',
                lifted: '0 8px 30px rgba(16, 42, 39, 0.08)',
            },
            borderRadius: {
                'card': '1rem',
            },
            keyframes: {
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'slide-in-right': {
                    '0%': { opacity: '0', transform: 'translateX(24px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                'slide-in-left': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(0)' },
                },
            },
            animation: {
                'fade-in-up': 'fade-in-up 0.3s ease-out both',
                'fade-in': 'fade-in 0.2s ease-out both',
                'slide-in-right': 'slide-in-right 0.28s cubic-bezier(0.25, 0.1, 0.25, 1) both',
                'slide-in-left': 'slide-in-left 0.28s cubic-bezier(0.25, 0.1, 0.25, 1) both',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic':
                    'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
        },
    },
    plugins: [],
}
