/**
 * VEMIO™ — Dynamic Open Graph Image
 * GET /api/og
 *
 * Generates a 1200×630 OG image using Next.js ImageResponse.
 * Used for link previews on WhatsApp, LinkedIn, Slack, etc.
 *
 * Query params (optional):
 *   ?title=Custom Title
 *   ?subtitle=Custom Subtitle
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'VEMIO™';
  const subtitle = searchParams.get('subtitle') || 'Managed Network Intelligence Platform';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0B0F1A',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            opacity: 0.06,
            backgroundImage: 'radial-gradient(circle at 50% 50%, #f59e0b 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '700px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Top border accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, transparent 10%, #f59e0b 30%, #d97706 50%, #f59e0b 70%, transparent 90%)',
          }}
        />

        {/* Network nodes decoration — left side */}
        <div
          style={{
            position: 'absolute',
            left: '60px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            opacity: 0.15,
          }}
        >
          {[28, 20, 16, 20, 28].map((size, i) => (
            <div
              key={i}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                border: '2px solid #22c55e',
                marginLeft: i % 2 === 0 ? '0px' : '20px',
              }}
            />
          ))}
        </div>

        {/* Network nodes decoration — right side */}
        <div
          style={{
            position: 'absolute',
            right: '60px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            opacity: 0.15,
          }}
        >
          {[20, 28, 16, 28, 20].map((size, i) => (
            <div
              key={i}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                border: '2px solid #14b8a6',
                marginRight: i % 2 === 0 ? '0px' : '20px',
              }}
            />
          ))}
        </div>

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* VEMIO Ribbon Logo — SVG inline */}
          <svg
            width="80"
            height="80"
            viewBox="0 0 100 100"
            fill="none"
          >
            {/* Stylized double-helix / infinity ribbon */}
            <path
              d="M25 35 C25 20, 50 20, 50 35 C50 50, 75 50, 75 35 C75 20, 50 20, 50 35 C50 50, 25 50, 25 35Z"
              stroke="#f59e0b"
              strokeWidth="4"
              fill="none"
              opacity="0.9"
            />
            <path
              d="M25 55 C25 40, 50 40, 50 55 C50 70, 75 70, 75 55 C75 40, 50 40, 50 55 C50 70, 25 70, 25 55Z"
              stroke="#d97706"
              strokeWidth="4"
              fill="none"
              opacity="0.7"
            />
          </svg>

          {/* Brand name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontSize: '56px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: '#f59e0b',
              }}
            >
              {title === 'VEMIO™' ? 'VEMIO' : title}
            </span>
            {title === 'VEMIO™' && (
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 500,
                  color: '#64748b',
                }}
              >
                ™
              </span>
            )}
          </div>

          {/* Subtitle */}
          <span
            style={{
              fontSize: '20px',
              fontWeight: 400,
              color: '#94a3b8',
              letterSpacing: '0.04em',
            }}
          >
            {subtitle}
          </span>

          {/* Divider */}
          <div
            style={{
              width: '80px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
              marginTop: '8px',
            }}
          />
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              color: '#475569',
              letterSpacing: '0.04em',
            }}
          >
            Powered by Vinay Enterprises · Est. 1993
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}