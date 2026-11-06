import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * ThemeToggle – a dark / light mode switch for the whole page.
 *
 * Backed by ThemeContext (choice persisted in localStorage and applied to
 * <html> before first paint), so it works identically in the marketing
 * Navbar and inside the dashboard Shell header. The neutral utilities it
 * uses are themselves theme-tokenised (see tailwind.config.js), so the
 * button re-colours with the page in both modes.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={darkMode}
      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
    >
      {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden font-mono text-[10px] uppercase tracking-wider sm:block">
        {darkMode ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
