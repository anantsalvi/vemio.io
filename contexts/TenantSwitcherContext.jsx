/**
 * VEMIO™ — Tenant Switcher Context
 * 
 * Provides tenant selection state for MSP users.
 * - Fetches accessible tenants from /api/tenants on mount
 * - Persists selection to localStorage (MSP users only)
 * - API-side still validates every request — localStorage is convenience only
 * - Client users: context returns their own tenant, no switcher rendered
 * 
 * Usage:
 *   const { selectedTenantId, tenants, isMSP, setSelectedTenantId } = useTenantSwitcher();
 *   
 *   // In API calls:
 *   fetch(`/api/overview?tenantId=${selectedTenantId}&category=${category}`)
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const TenantSwitcherContext = createContext({
  isMSP: false,
  tenants: [],
  selectedTenantId: null,       // null = not loaded yet
  selectedTenantName: '',
  isAllTenants: false,
  setSelectedTenantId: () => {},
  loading: true,
});

const STORAGE_KEY = 'vemio_selected_tenant';

export function TenantSwitcherProvider({ children }) {
  const { data: session, status } = useSession();
  const [tenants, setTenants] = useState([]);
  const [isMSP, setIsMSP] = useState(false);
  const [selectedTenantId, setSelectedTenantIdState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load tenant list once session is available
  useEffect(() => {
    if (status !== 'authenticated') return;

    async function loadTenants() {
      try {
        const res = await fetch('/api/tenants');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setIsMSP(data.isMSP);
        setTenants(data.tenants);

        if (data.isMSP) {
          // Restore from localStorage, validate it's still accessible
          const stored = localStorage.getItem(STORAGE_KEY);
          const validIds = ['all', ...data.tenants.map(t => t.id)];

          if (stored && validIds.includes(stored)) {
            setSelectedTenantIdState(stored);
          } else {
            // Default to "All Tenants" for MSP users
            setSelectedTenantIdState('all');
            localStorage.setItem(STORAGE_KEY, 'all');
          }
        } else {
          // Client user — locked to their tenant
          setSelectedTenantIdState(data.currentTenantId);
        }
      } catch (err) {
        console.error('[VEMIO] Failed to load tenants:', err);
        // Fallback: use session tenant
        if (session?.user?.tenantId) {
          setSelectedTenantIdState(session.user.tenantId);
        }
      } finally {
        setLoading(false);
      }
    }

    loadTenants();
  }, [status, session]);

  const setSelectedTenantId = useCallback((tenantId) => {
    setSelectedTenantIdState(tenantId);
    if (isMSP) {
      localStorage.setItem(STORAGE_KEY, tenantId);
    }
  }, [isMSP]);

  // Derive display name
  const isAllTenants = selectedTenantId === 'all';
  const selectedTenantName = isAllTenants
    ? 'All Tenants'
    : tenants.find(t => t.id === selectedTenantId)?.name || '';

  return (
    <TenantSwitcherContext.Provider
      value={{
        isMSP,
        tenants,
        selectedTenantId,
        selectedTenantName,
        isAllTenants,
        setSelectedTenantId,
        loading,
      }}
    >
      {children}
    </TenantSwitcherContext.Provider>
  );
}

export function useTenantSwitcher() {
  return useContext(TenantSwitcherContext);
}
