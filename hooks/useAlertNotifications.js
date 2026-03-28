'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * VEMIO™ — useAlertNotifications
 *
 * Polls for new alerts and triggers browser notifications for critical/high severity.
 * Requires user permission via the Notification API.
 *
 * Usage:
 *   const { permission, requestPermission, enabled, setEnabled } = useAlertNotifications();
 *
 * Add to Overview or a layout-level component so it runs while the dashboard is open.
 */

const POLL_INTERVAL = 30000; // 30 seconds
const NOTIFICATION_SOUND_URL = '/sounds/alert.mp3'; // Optional — place an mp3 in public/sounds/

export function useAlertNotifications() {
  const [permission, setPermission] = useState('default');
  const [enabled, setEnabled] = useState(false);
  const lastAlertIdRef = useRef(null);
  const audioRef = useRef(null);

  // Check permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      // Restore enabled state from localStorage
      const stored = localStorage.getItem('vemio-alert-notifications');
      if (stored === 'true' && Notification.permission === 'granted') {
        setEnabled(true);
      }
    }
  }, []);

  // Persist enabled state
  useEffect(() => {
    localStorage.setItem('vemio-alert-notifications', enabled ? 'true' : 'false');
  }, [enabled]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') setEnabled(true);
    return result;
  }, []);

  // Poll for new alerts
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    async function checkAlerts() {
      try {
        const res = await fetch('/api/alerts?state=active&severity=critical,high&limit=1');
        if (!res.ok) return;
        const data = await res.json();
        const latest = data?.alerts?.[0];

        if (latest && latest.id !== lastAlertIdRef.current) {
          lastAlertIdRef.current = latest.id;

          // Show browser notification
          const notification = new Notification(`VEMIO ${latest.severity.toUpperCase()} Alert`, {
            body: latest.title,
            icon: isDark ? '/favicon-dark.ico' : '/favicon-light.ico',
            tag: `vemio-alert-${latest.id}`,
            requireInteraction: latest.severity === 'critical',
          });

          notification.onclick = () => {
            window.focus();
            window.location.href = '/alerts';
            notification.close();
          };

          // Play alert sound
          playAlertSound(latest.severity);
        }
      } catch (err) {
        // Silent fail — don't break the dashboard
      }
    }

    // Check immediately
    checkAlerts();

    // Then poll
    const interval = setInterval(checkAlerts, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, permission]);

  function playAlertSound(severity) {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = severity === 'critical' ? 0.8 : 0.4;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay blocked — user hasn't interacted yet
      });
    } catch {
      // No audio available
    }
  }

  return {
    permission,
    requestPermission,
    enabled,
    setEnabled,
    supported: typeof window !== 'undefined' && 'Notification' in window,
  };
}