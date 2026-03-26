'use client';

import { useState, useEffect, createContext, useContext } from 'react';

const DEFAULTS = {
  logo_url: null,
  company_name: 'VEMIO',
  tagline: 'Network Intelligence',
  primary_color: '#F59E0B',
  accent_color: '#14B8A6',
  show_powered_by: true,
  powered_by_text: 'Powered by Vinay Enterprises',
  tenant_name: '',
  tenant_slug: '',
};

const BrandingContext = createContext(DEFAULTS);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchBranding() {
      try {
        const res = await fetch('/api/branding');
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) {
          setBranding({ ...DEFAULTS, ...json.branding });
        }
      } catch {
        // Keep defaults on error
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchBranding();
    return () => { cancelled = true; };
  }, []);

  // Inject CSS custom properties for tenant color overrides
  useEffect(() => {
    if (!loaded) return;

    const root = document.documentElement;
    if (branding.primary_color !== DEFAULTS.primary_color) {
      root.style.setProperty('--color-vemio-amber', branding.primary_color);
      // Also update rgba variants for backgrounds/borders
      root.style.setProperty('--brand-primary', branding.primary_color);
    }
    if (branding.accent_color !== DEFAULTS.accent_color) {
      root.style.setProperty('--brand-accent', branding.accent_color);
    }

    return () => {
      // Clean up on unmount (shouldn't happen, but safe)
      root.style.removeProperty('--color-vemio-amber');
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-accent');
    };
  }, [branding, loaded]);

  return (
    <BrandingContext.Provider value={{ ...branding, loaded }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}