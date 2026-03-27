'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * VEMIO™ — Device Category Context
 *
 * Provides a global 'network' | 'all' preference that persists to the DB.
 * Consumed by: TopBar (toggle), Device Health, Overview, Alerts, Topology.
 *
 * Network types: firewall, core_switch, access_switch, access_point, router, server, p2p_link
 * Other types:   printer, cctv, ups, access_control, nas, other
 */

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

const DeviceCategoryContext = createContext({
  category: 'network',
  setCategory: () => {},
  isNetwork: true,
  networkTypes: NETWORK_TYPES,
  loading: true,
});

export function DeviceCategoryProvider({ children }) {
  const [category, setCategoryState] = useState('network');
  const [loading, setLoading] = useState(true);

  // Load preference on mount
  useEffect(() => {
    async function loadPreference() {
      try {
        const res = await fetch('/api/user/preferences');
        if (res.ok) {
          const data = await res.json();
          const saved = data.preferences?.deviceCategory;
          if (saved === 'network' || saved === 'all') {
            setCategoryState(saved);
          }
        }
      } catch {
        // Fallback to 'network' on error
      } finally {
        setLoading(false);
      }
    }
    loadPreference();
  }, []);

  // Persist preference to DB when changed
  const setCategory = useCallback(async (newCategory) => {
    if (newCategory !== 'network' && newCategory !== 'all') return;
    setCategoryState(newCategory);

    try {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCategory: newCategory }),
      });
    } catch {
      // Preference saved locally even if API fails
    }
  }, []);

  return (
    <DeviceCategoryContext.Provider value={{
      category,
      setCategory,
      isNetwork: category === 'network',
      networkTypes: NETWORK_TYPES,
      loading,
    }}>
      {children}
    </DeviceCategoryContext.Provider>
  );
}

export function useDeviceCategory() {
  return useContext(DeviceCategoryContext);
}

export { NETWORK_TYPES };