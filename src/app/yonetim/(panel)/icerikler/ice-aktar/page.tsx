import Link from 'next/link';
import { db } from '@/lib/db';
import ImportForm from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function IceAktar() {
  const { count } = await db().from('entries').select('id', { count: 'exact', head: true });
  return (
    <div>
      <Link className="back" href="/yonetim/icerikler">← İçerikler</Link>
      <div className="ph">
        <div>
          <h1>WordPress’ten al</h1>
          <p className="sub">Başlıklar, tarihler ve metinler aynen gelir. Görseller alınmaz. Şiirlerin satır düzeni korunur.</p>
        </div>
      </div>
      <ImportForm existing={count ?? 0} />
    </div>
  );
}
