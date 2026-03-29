'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Read the OS / device preference. Falls back to 'dark' during SSR. */
function getSystemPreference(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default values for SSR/SSG - won't throw during static generation
    return {
      mode: 'dark' as ThemeMode,
      toggleTheme: () => {},
      isDark: true,
    };
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  // Track whether the user has explicitly chosen a theme (manual toggle)
  const userOverrideRef = useRef(false);

  // ── 1. On mount: localStorage > system preference > dark fallback ──
  useEffect(() => {
    setMounted(true);
    try {
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
      if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
        setMode(savedMode);
        userOverrideRef.current = true; // user previously chose this
        return;
      }
    } catch (e) {
      console.log('Could not access localStorage');
    }
    // No saved preference → follow OS / device setting
    setMode(getSystemPreference());
  }, []);

  // ── 2. Listen for real-time OS theme changes ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only follow OS changes when the user hasn't manually overridden
      if (!userOverrideRef.current) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ── 3. Manual toggle (overrides system preference) ──
  const toggleTheme = useCallback(() => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      userOverrideRef.current = true;
      try {
        localStorage.setItem('theme-mode', newMode);
      } catch (e) {
        console.log('Could not save to localStorage');
      }
      return newMode;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggleTheme,
      isDark: mode === 'dark',
    }),
    [mode, toggleTheme]
  );

  // During SSR / before hydration, just render children without provider
  // This prevents flash - actual theme is applied client-side
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ mode: 'dark', toggleTheme: () => {}, isDark: true }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
