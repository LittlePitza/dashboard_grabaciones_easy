import type { Metadata, Viewport } from 'next';

import './globals.css';
import { AppShell } from '@/components/layout/AppShell';



export const metadata: Metadata = {
  title: 'Grabación Obras',
  description: 'Seguimiento de grabaciones y locaciones',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Grabación Obras' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f0f1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      </head>
      <body style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
