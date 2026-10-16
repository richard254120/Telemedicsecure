import React, { useEffect, useState } from 'react';

/**
 * ThemeToggle – a simple dark / light mode switch.
 * Persists choice in localStorage and respects OS preference.
 */
export default function ThemeToggle() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="flex items-center space-x-1 px-3 py-1 rounded-md transition-colors bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
      aria-label="Toggle dark / light theme"
    >
      {darkMode ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m8.66-12.66l-.71.71M5.05 18.95l-.71.71M21 12h-1M4 12H3m15.66 4.66l-.71-.71M5.05 5.05l-.71-.71"
          />
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={2} fill="none" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 2.03a1 1 0 011.41 0l1.42 1.42a1 1 0 01-1.42 1.41l-1.41-1.4a1 1 0 010-1.43zM18 9a1 1 0 110 2h-2a1 1 0 110-2h2zm-2.34 6.97a1 1 0 010 1.41l-1.42 1.42a1 1 0 11-1.41-1.42l1.4-1.41a1 1 0 011.43 0zM10 16a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zm-5.66-2.34a1 1 0 011.41 0l1.42-1.42a1 1 0 10-1.42-1.41l-1.41 1.4a1 1 0 010 1.43zM4 9a1 1 0 110 2H2a1 1 0 110-2h2z" />
        </svg>
      )}
      <span className="text-xs font-medium">{darkMode ? 'Dark' : 'Light'}</span>
    </button>
  );
}
