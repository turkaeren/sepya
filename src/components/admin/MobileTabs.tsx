'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const I = {
  home: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
  pen: <><path d="M16.5 3.5l4 4L8 20H4v-4z" /><path d="M14 6l4 4" /></>,
  note: <><path d="M4 4h16v12H8l-4 4z" /><path d="M8 9h8M8 12.5h5" /></>,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>
};

const TABS: { href: string; label: string; icon: keyof typeof I; match: (p: string) => boolean }[] = [
  { href: '/yonetim', label: 'Genel', icon: 'home', match: (p) => p === '/yonetim' },
  { href: '/yonetim/icerikler', label: 'İçerikler', icon: 'list', match: (p) => p.startsWith('/yonetim/icerikler') && p !== '/yonetim/icerikler/yeni' },
  { href: '/yonetim/icerikler/yeni', label: 'Yaz', icon: 'pen', match: (p) => p === '/yonetim/icerikler/yeni' },
  { href: '/yonetim/notlar', label: 'Notlar', icon: 'note', match: (p) => p.startsWith('/yonetim/notlar') },
  { href: '/yonetim/daha', label: 'Daha', icon: 'more', match: (p) => ['/yonetim/daha', '/yonetim/analitik', '/yonetim/ziyaretciler', '/yonetim/basarisiz', '/yonetim/kapak', '/yonetim/guvenlik'].some((x) => p.startsWith(x)) }
];

export default function MobileTabs({ noteBadge, failBadge }: { noteBadge: number; failBadge: number }) {
  const path = usePathname();
  return (
    <nav className="mtabs" aria-label="Uygulama sekmeleri">
      {TABS.map((t) => {
        const on = t.match(path);
        const badge = t.icon === 'note' ? noteBadge : t.icon === 'more' ? failBadge : 0;
        return (
          <Link key={t.href} href={t.href} className={'mt' + (on ? ' on' : '') + (t.icon === 'pen' ? ' write' : '')} aria-current={on ? 'page' : undefined}>
            <span className="mi">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[t.icon]}</svg>
              {badge > 0 && <span className={'mb' + (t.icon === 'more' ? ' red' : '')}>{badge > 99 ? '99+' : badge}</span>}
            </span>
            <span className="ml">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
