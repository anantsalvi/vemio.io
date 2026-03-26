'use client';

/**
 * VEMIO™ Logo Mark
 *
 * A network-intelligence inspired mark: a stylized "V" formed by
 * converging signal paths with a central node, suggesting visibility
 * and connectivity monitoring.
 *
 * Usage:
 *   <VemioLogo size={24} color="var(--color-vemio-amber)" />
 *   <VemioLogo size={32} /> // defaults to amber
 */

export default function VemioLogo({ size = 24, color = 'var(--color-vemio-amber)', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="VEMIO"
    >
      {/* Outer ring — monitoring/visibility */}
      <circle
        cx="16"
        cy="16"
        r="14"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />

      {/* V-shaped signal paths */}
      <path
        d="M8 9L16 24L24 9"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central node — the intelligence point */}
      <circle
        cx="16"
        cy="16"
        r="2.5"
        fill={color}
      />

      {/* Signal pulses on the V arms */}
      <circle cx="11" cy="14" r="1.2" fill={color} fillOpacity="0.5" />
      <circle cx="21" cy="14" r="1.2" fill={color} fillOpacity="0.5" />

      {/* Top beacon dots */}
      <circle cx="8" cy="9" r="1.5" fill={color} fillOpacity="0.7" />
      <circle cx="24" cy="9" r="1.5" fill={color} fillOpacity="0.7" />
    </svg>
  );
}