import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — calm green "you're fine to spend", amber/red as the
        // weekly number depletes.
        brand: {
          DEFAULT: '#16a34a',
          fg: '#052e16',
          muted: '#dcfce7',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
