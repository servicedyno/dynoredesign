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

/**
 * Read the theme that the blocking script in _document.tsx already applied.
 * This ensures the first React render matches what the user already sees.
 */
function getInitialTheme(): ThemeMode {
  if (typeof document !== 'undefined') {
    const preset = document.documentElement.dataset.theme;
    if (preset === 'light' || preset === 'dark') return preset;
  }
  return 'dark'; // SSR fallback
}

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: 'dark' as ThemeMode,
      toggleTheme: () => {},
      isDark: true,
    };
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lazy initializer reads the data-theme attribute set by the blocking script
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  // Track whether the user has explicitly chosen a theme (manual toggle)
  const userOverrideRef = useRef(false);

  // ── 1. On mount: localStorage > system preference > blocking-script value ──
  useEffect(() => {
    setMounted(true);
    try {
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
      if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
        setMode(savedMode);
        userOverrideRef.current = true;
        return;
      }
    } catch (e) {
      console.log('Could not access localStorage');
    }
    // No saved preference → follow OS / device setting
    setMode(getSystemPreference());
  }, []);

  // ── 2. Keep data-theme attribute in sync so CSS always matches ──
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
      // Clear inline bg so MUI/CSS takes over (blocking script bg was just for first paint)
      document.documentElement.style.backgroundColor = '';
    }
  }, [mode]);

  // ── 3. Listen for real-time OS theme changes ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (!userOverrideRef.current) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ── 4. Manual toggle (overrides system preference) ──
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

  // Before hydration, use the theme the blocking script already set
  // so the first render matches what the user sees (no flash)
  if (!mounted) {
    const presetMode = getInitialTheme();
    return (
      <ThemeContext.Provider value={{ mode: presetMode, toggleTheme: () => {}, isDark: presetMode === 'dark' }}>
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
