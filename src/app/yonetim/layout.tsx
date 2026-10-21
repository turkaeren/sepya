import type { Metadata, Viewport } from 'next';
import { SwRegister } from '@/components/admin/AppShell';

export const metadata: Metadata = {
  title: 'SEPYA · yönetim',
  manifest: '/app/yonetim.webmanifest',
  applicationName: 'SEPYA',
  appleWebApp: { capable: true, title: 'SEPYA', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/app/fav-32.png', sizes: '32x32' }, { url: '/app/icon-192.png', sizes: '192x192' }], apple: '/app/apple-180.png' },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = { themeColor: '#F6F4EF', viewportFit: 'cover' };

export default function YonetimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<SwRegister /></>;
}
