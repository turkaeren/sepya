'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: [string, string][] = [
  ['/yonetim', 'Genel'],
  ['/yonetim/analitik', 'Analitik'],
  ['/yonetim/ziyaretciler', 'Ziyaretçiler'],
  ['/yonetim/notlar', 'Notlar'],
  ['/yonetim/icerikler', 'İçerikler'],
  ['/yonetim/basarisiz', 'Başarısız denemeler'],
  ['/yonetim/guvenlik', 'Güvenlik']
];

export default function Nav({ failBadge, noteBadge = 0 }: { failBadge: number; noteBadge?: number }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Yönetim bölümleri">
      {ITEMS.map(([href, label]) => {
        const on = href === '/yonetim' ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={'nb' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined}>
            {label}
            {href === '/yonetim/basarisiz' && failBadge > 0 && <span className="badge">{failBadge}</span>}
            {href === '/yonetim/notlar' && noteBadge > 0 && <span className="badge ink">{noteBadge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
