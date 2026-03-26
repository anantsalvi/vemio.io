import './globals.css';

export const metadata = {
  title: {
    default: 'VEMIO™ | Network Intelligence Dashboard',
    template: '%s | VEMIO™',
  },
  description: 'Managed network intelligence platform by Vinay Enterprises',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-vemio-bg text-vemio-text antialiased">
        {children}
      </body>
    </html>
  );
}