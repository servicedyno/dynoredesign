'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default values for SSR/SSG - won't throw during static generation
    return {
      mode: 'light' as ThemeMode,
      toggleTheme: () => {},
      isDark: false,
    };
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
      if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
        setMode(savedMode);
      }
    } catch (e) {
      console.log('Could not access localStorage');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
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
      <ThemeContext.Provider value={{ mode: 'light', toggleTheme: () => {}, isDark: false }}>
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
