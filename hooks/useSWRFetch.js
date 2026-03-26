'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * VEMIO™ — useSWRFetch
 *
 * A lightweight stale-while-revalidate fetch hook.
 * - Returns cached data instantly on re-mount
 * - Revalidates in the background
 * - Optional polling interval
 * - Shared in-memory cache across components
 *
 * Usage:
 *   const { data, loading, error, refresh } = useSWRFetch('/api/overview', {
 *     refreshInterval: 60000,  // poll every 60s
 *     dedupingInterval: 5000,  // don't re-fetch within 5s
 *   });
 */

// Shared in-memory cache: key → { data, timestamp }
const cache = new Map();

// Track in-flight requests to avoid duplicate fetches
const inflight = new Map();

export function useSWRFetch(url, options = {}) {
  const {
    refreshInterval = 0,     // 0 = no polling
    dedupingInterval = 5000, // don't re-fetch if last fetch was < 5s ago
    revalidateOnMount = true,
    fallbackData = null,
  } = options;

  const cached = cache.get(url);
  const [data, setData] = useState(cached?.data ?? fallbackData);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (isBackground = false) => {
    // Deduping: skip if fetched recently
    const entry = cache.get(url);
    if (entry && Date.now() - entry.timestamp < dedupingInterval) {
      if (mountedRef.current && entry.data) {
        setData(entry.data);
        setLoading(false);
      }
      return;
    }

    // Dedup in-flight: reuse existing promise
    if (inflight.has(url)) {
      try {
        const result = await inflight.get(url);
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
        }
      } catch {}
      return;
    }

    if (!isBackground) setLoading(prev => !cache.has(url) ? true : prev);

    const promise = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cache.set(url, { data: json, timestamp: Date.now() });
      return json;
    });

    inflight.set(url, promise);

    try {
      const json = await promise;
      if (mountedRef.current) {
        setData(json);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    } finally {
      inflight.delete(url);
    }
  }, [url, dedupingInterval]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (cached?.data) {
      // Show stale data immediately, revalidate in background
      setData(cached.data);
      setLoading(false);
      if (revalidateOnMount) fetchData(true);
    } else {
      fetchData(false);
    }

    return () => { mountedRef.current = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling
  useEffect(() => {
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => fetchData(true), refreshInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshInterval, fetchData]);

  const refresh = useCallback(() => {
    // Force refresh: clear cache entry and fetch fresh
    cache.delete(url);
    return fetchData(false);
  }, [url, fetchData]);

  return { data, loading, error, refresh };
}

/**
 * Invalidate a specific cache entry.
 * Useful when you know data has changed (e.g. after a mutation).
 */
export function invalidateCache(url) {
  cache.delete(url);
}

/**
 * Clear entire SWR cache.
 */
export function clearCache() {
  cache.clear();
}