'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

/**
 * VEMIO™ — Theme System
 *
 * Three modes: 'dark' (default), 'light', 'system'
 * Persistence:
 *   1. localStorage (instant, no flash)
 *   2. DB via /api/user/preferences (syncs across devices)
 * Applied via data-theme attribute on <html>.
 * CSS variables are overridden in globals.css for [data-theme="light"].
 *
 * A blocking <script> in layout.jsx reads localStorage before paint
 * to prevent the dark→light flash on page load.
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

function applyTheme(resolved) {
  document.documentElement.setAttribute('data-theme', resolved);
  // Toggle class for Tailwind dark: variants
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }
  // Swap favicon to match theme
  const faviconHref = resolved === 'dark' ? '/favicon-dark.ico' : '/favicon-light.ico';
  let link = document.querySelector('link[rel="icon"][data-theme-favicon]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.setAttribute('data-theme-favicon', 'true');
    document.head.appendChild(link);
  }
  link.href = faviconHref;
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState('dark');
  const [theme, setTheme] = useState('dark');
  const [loaded, setLoaded] = useState(false);

  // Initialize: localStorage first (instant), then DB (authoritative)
  useEffect(() => {
    // 1. Read localStorage (already applied by blocking script, just sync state)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['dark', 'light', 'system'].includes(stored)) {
      setPreferenceState(stored);
      const resolved = resolveTheme(stored);
      setTheme(resolved);
      applyTheme(resolved);
    }

    // 2. Fetch from DB — if different from localStorage, DB wins
    async function loadFromDB() {
      try {
        const res = await fetch('/api/user/preferences');
        if (res.ok) {
          const data = await res.json();
          const dbPref = data.preferences?.theme;
          if (dbPref && ['dark', 'light', 'system'].includes(dbPref)) {
            // DB is authoritative — update localStorage and state
            if (dbPref !== stored) {
              localStorage.setItem(STORAGE_KEY, dbPref);
              setPreferenceState(dbPref);
              const resolved = resolveTheme(dbPref);
              setTheme(resolved);
              applyTheme(resolved);
            }
          } else if (stored) {
            // DB has no theme preference but localStorage does — push to DB
            fetch('/api/user/preferences', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ theme: stored }),
            }).catch(() => {});
          }
        }
      } catch {
        // API unavailable — localStorage preference stands
      } finally {
        setLoaded(true);
      }
    }
    loadFromDB();
  }, []);

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      const resolved = e.matches ? 'light' : 'dark';
      setTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = useCallback((pref) => {
    if (!['dark', 'light', 'system'].includes(pref)) return;

    // Update state immediately
    setPreferenceState(pref);
    const resolved = resolveTheme(pref);
    setTheme(resolved);
    applyTheme(resolved);

    // Persist to localStorage (instant on next load)
    localStorage.setItem(STORAGE_KEY, pref);

    // Persist to DB (sync across devices)
    fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: pref }),
    }).catch(() => {
      // Preference saved locally even if API fails
    });
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