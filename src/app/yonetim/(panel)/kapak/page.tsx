import { getCover } from '@/lib/cover-store';
import CoverForm from './CoverForm';

export const dynamic = 'force-dynamic';

export default async function Kapak() {
  const cover = await getCover();
  return (
    <div>
      <div className="ph">
        <div><h1>Kapak</h1><p className="sub">Okurun içeri girince gördüğü ilk sayfa. Boş bıraktığın satır görünmez.</p></div>
      </div>
      <CoverForm initial={cover} />
    </div>
  );
}
