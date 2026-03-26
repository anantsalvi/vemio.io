'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';

/**
 * VEMIO™ — AlertNotificationToggle
 *
 * A button that enables/disables browser notifications for critical alerts.
 * Shows permission request flow if not yet granted.
 *
 * Usage: <AlertNotificationToggle />
 */
export default function AlertNotificationToggle() {
  const { permission, requestPermission, enabled, setEnabled, supported } = useAlertNotifications();

  if (!supported) return null;

  const handleClick = async () => {
    if (permission === 'default') {
      const result = await requestPermission();
      if (result === 'granted') setEnabled(true);
    } else if (permission === 'granted') {
      setEnabled(!enabled);
    }
    // If denied, clicking does nothing — browser blocks it
  };

  const isDenied = permission === 'denied';
  const Icon = enabled ? BellRing : isDenied ? BellOff : Bell;

  return (
    <button
      onClick={handleClick}
      disabled={isDenied}
      className="alert-notif-btn"
      title={
        isDenied ? 'Notifications blocked — enable in browser settings' :
        enabled ? 'Browser alerts enabled — click to disable' :
        'Enable browser alerts for critical events'
      }
    >
      <Icon className="w-4 h-4" />

      <style>{`
        .alert-notif-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface);
          color: ${enabled ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-dim)'};
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }

        .alert-notif-btn:hover:not(:disabled) {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text);
          border-color: var(--color-vemio-text-dim);
        }

        .alert-notif-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </button>
  );
}