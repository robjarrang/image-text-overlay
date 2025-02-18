'use client';

import { useEffect } from 'react';

export function ThemeProvider() {
  useEffect(() => {
    // Check if user prefers dark mode
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Function to update theme
    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.classList.add('slds-theme_dark');
      } else {
        document.documentElement.classList.remove('slds-theme_dark');
      }
    };

    // Initial check
    updateTheme(darkModeMediaQuery);

    // Listen for changes
    darkModeMediaQuery.addEventListener('change', updateTheme);

    return () => {
      darkModeMediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);

  return null;
}