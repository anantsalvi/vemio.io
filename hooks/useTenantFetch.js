/**
 * VEMIO™ — Tenant-Aware Fetch Hook
 * 
 * Wraps useSWRFetch to automatically append the selected tenant ID
 * from TenantSwitcherContext to API URLs.
 * 
 * Usage:
 *   const { data, loading, error } = useTenantFetch('/api/overview', { refreshInterval: 60000 });
 *   // → fetches /api/overview?tenantId=xxx&... automatically
 * 
 * For MSP users in "All Tenants" mode, appends tenantId=all.
 * For client users, appends their own tenant ID (server validates anyway).
 */

'use client';

import { useMemo } from 'react';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';

export function useTenantFetch(baseUrl, options = {}) {
  const { selectedTenantId, loading: tenantLoading } = useTenantSwitcher();

  // Build URL with tenantId param injected
  const url = useMemo(() => {
    if (!selectedTenantId) return null; // Don't fetch until tenant is resolved
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}tenantId=${selectedTenantId}`;
  }, [baseUrl, selectedTenantId]);

  const result = useSWRFetch(url, {
    ...options,
    // Don't fetch if tenant context isn't ready yet
    isPaused: () => !selectedTenantId || tenantLoading,
  });

  return {
    ...result,
    // Merge tenant loading state into the loading indicator
    loading: tenantLoading || result.loading,
  };
}
