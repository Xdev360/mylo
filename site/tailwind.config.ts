import type { Config } from 'tailwindcss';

/* Every value here comes from the developer handoff. Colours are CSS
   variables rather than literals because dark mode follows the system, so a
   token has to resolve differently without anything toggling a class. */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--bg-page)',
        sheet: 'var(--bg-sheet)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        brand: '#111114',
        green: 'var(--green)',
        amber: 'var(--amber)',
        red: 'var(--red)'
      },
      borderRadius: {
        sheet: '28px',
        card: '24px',
        inner: '16px',
        input: '16px',
        pill: '999px'
      },
      boxShadow: {
        // the only shadow in the system: phones and floating cards
        float: '0 24px 60px rgba(0,0,0,.12)'
      },
      maxWidth: {
        content: '1124px',
        lead: '640px',
        body: '520px'
      },
      spacing: {
        sidebar: '300px',
        topbar: '68px',
        section: '62px'
      },
      screens: {
        // the handoff's three bands, named after what they are
        tablet: '768px',
        desktop: '1280px'
      }
    }
  },
  plugins: []
};
export default config;
