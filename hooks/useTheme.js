'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

/**
 * VEMIO™ — Theme System
 *
 * Three modes: 'dark' (default), 'light', 'system'
 * Stored in localStorage. Applied via data-theme attribute on <html>.
 * CSS variables are overridden in globals.css for [data-theme="light"].
 */

const ThemeContext = createContext({
  theme: 'dark',        // current resolved theme (always 'dark' or 'light')
  preference: 'dark',   // user preference ('dark', 'light', or 'system')
  setPreference: () => {},
});

const STORAGE_KEY = 'vemio-theme-preference';

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(preference) {
  if (preference === 'system') return getSystemTheme();
  return preference;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState('dark');
  const [theme, setTheme] = useState('dark');

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['dark', 'light', 'system'].includes(stored)) {
      setPreferenceState(stored);
      const resolved = resolveTheme(stored);
      setTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }, []);

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      const resolved = e.matches ? 'light' : 'dark';
      setTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = useCallback((pref) => {
    setPreferenceState(pref);
    localStorage.setItem(STORAGE_KEY, pref);
    const resolved = resolveTheme(pref);
    setTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}