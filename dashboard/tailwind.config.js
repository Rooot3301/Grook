/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:         '#0f1115',
        panel:      '#161923',
        'panel-2':  '#1c2030',
        border:     '#252a3a',
        text:       '#e6e8ee',
        'text-dim': '#8a91a5',
        accent:     '#e5b83c',
        'accent-h': '#f0c65b',
        danger:     '#e8524b',
        good:       '#59c39a',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        stamp: '0 0 0 1px #e5b83c inset',
      },
    },
  },
  plugins: [],
};
