import './globals.css';

const SITE_URL = 'https://vemio.vinayenterprises.co.in';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VEMIO — Network Intelligence Dashboard',
    template: '%s | VEMIO',
  },
  description:
    'VEMIO™ is a managed network intelligence platform by Vinay Enterprises. Real-time infrastructure monitoring, Business Continuity Scoring, and automated alerting for enterprise networks.',
  keywords: [
    'network monitoring',
    'managed services',
    'network intelligence',
    'infrastructure monitoring',
    'VEMIO',
    'Vinay Enterprises',
    'business continuity',
    'IT infrastructure',
    'NOC dashboard',
  ],
  authors: [{ name: 'Vinay Enterprises', url: 'https://vinayenterprises.co.in' }],
  creator: 'Vinay Enterprises',
  publisher: 'Vinay Enterprises',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: SITE_URL,
    siteName: 'VEMIO™',
    title: 'VEMIO™ | Managed Network Intelligence Platform',
    description:
      'Real-time infrastructure monitoring, Business Continuity Scoring, and automated alerting for enterprise networks. Powered by Vinay Enterprises.',
    images: [
      {
        url: `${SITE_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: 'VEMIO™ | Managed Network Intelligence Platform',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VEMIO™ | Managed Network Intelligence Platform',
    description:
      'Real-time infrastructure monitoring and Business Continuity Scoring for enterprise networks.',
    images: [`${SITE_URL}/api/og`],
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-vemio-bg text-vemio-text antialiased">
        {children}
      </body>
    </html>
  );
}