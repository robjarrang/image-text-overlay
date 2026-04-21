'use client';

import { useEffect } from 'react';

/**
 * Applies SLDS dark theme when the OS prefers dark mode.
 *
 * Embedding note: when the app is loaded inside an iframe (e.g. as a
 * Salesforce Marketing Cloud Custom Block), we deliberately skip the
 * auto-dark behaviour. SFMC Content Builder is a light-themed surface,
 * and flipping the embedded editor to dark based on the designer's OS
 * preference looks jarring next to a light Salesforce UI. The standalone
 * deployment still honours the OS preference as before.
 */
export function ThemeProvider() {
  useEffect(() => {
    // Detect whether we're embedded in a parent frame. Comparing window
    // references is safe across origins — it doesn't access any cross-
    // origin properties. Wrapped in try/catch anyway as paranoid defence.
    let isEmbedded = false;
    try {
      isEmbedded = window.self !== window.top;
    } catch {
      // Accessing window.top can throw in sandboxed iframes; if it does,
      // treat that as "definitely embedded".
      isEmbedded = true;
    }
    if (isEmbedded) {
      // Force light theme when embedded so the editor matches SFMC's chrome.
      document.documentElement.classList.remove('slds-theme_dark');
      return;
    }

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.classList.add('slds-theme_dark');
      } else {
        document.documentElement.classList.remove('slds-theme_dark');
      }
    };

    updateTheme(darkModeMediaQuery);
    darkModeMediaQuery.addEventListener('change', updateTheme);
    return () => {
      darkModeMediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);

  return null;
}