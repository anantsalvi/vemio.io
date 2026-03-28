/**
 * VEMIO™ — Login page metadata
 * This ensures the login URL has its own specific OG tags
 * when shared on WhatsApp, LinkedIn, etc.
 */

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to VEMIO™ | your managed network intelligence dashboard. Real-time monitoring, alerts, and Business Continuity Scoring.',
  openGraph: {
    title: 'Sign In to VEMIO™',
    description: 'Managed Network Intelligence Platform | Real-time monitoring, automated alerts, and Business Continuity Scoring for enterprise networks.',
    images: [
      {
        url: 'https://vemio.vinayenterprises.co.in/api/og?title=VEMIO%E2%84%A2&subtitle=Sign%20in%20to%20your%20network%20intelligence%20dashboard',
        width: 1200,
        height: 630,
        alt: 'VEMIO™ Sign In',
      },
    ],
  },
};

export default function LoginLayout({ children }) {
  return children;
}