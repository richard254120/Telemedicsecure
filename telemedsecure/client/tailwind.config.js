/** @type {import('tailwindcss').Config} */

// System-wide typography ramp.
//
// The dashboards are read by clinicians who are often standing or at a
// distance from the screen, so the whole type scale is lifted well above
// Tailwind's defaults (e.g. text-xs 12px -> 15px, text-base 16px -> 20px).
// Overriding `fontSize` here scales every named `text-*` utility at once
// (~1000 call sites) without editing a single component. The tiny arbitrary
// pixel sizes (text-[8/9/10/11px]) cannot be reached from the theme, so they
// are re-mapped in src/index.css instead.
const fontSize = {
  xs: ['0.9375rem', { lineHeight: '1.4' }],     // 15px
  sm: ['1.0625rem', { lineHeight: '1.45' }],    // 17px
  base: ['1.25rem', { lineHeight: '1.5' }],     // 20px
  lg: ['1.375rem', { lineHeight: '1.45' }],     // 22px
  xl: ['1.625rem', { lineHeight: '1.35' }],     // 26px
  '2xl': ['1.875rem', { lineHeight: '1.25' }],  // 30px
  '3xl': ['2.375rem', { lineHeight: '1.2' }],   // 38px
  '4xl': ['2.875rem', { lineHeight: '1.15' }],  // 46px
  '5xl': ['3.75rem', { lineHeight: '1.1' }],    // 60px
  '6xl': ['4.5rem', { lineHeight: '1.05' }],    // 72px
  '7xl': ['5.5rem', { lineHeight: '1.05' }],    // 88px
  '8xl': ['7rem', { lineHeight: '1' }],         // 112px
  '9xl': ['9rem', { lineHeight: '1' }],         // 144px
};

export default {
  darkMode: 'class', // enable class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize,
    },
  },
  plugins: [],
}
