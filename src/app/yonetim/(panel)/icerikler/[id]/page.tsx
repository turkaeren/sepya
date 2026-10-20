import Link from 'next/link';
import { notFound } from 'next/navigation';
import EntryEditor from '@/components/admin/EntryEditor';
import { getEntry } from '@/lib/entries';
import { dotsDT } from '@/lib/format';
import type { Category } from '@/lib/pagination';
import { deleteEntryAction, unpublishEntryAction } from '../../../actions';

export const dynamic = 'force-dynamic';

const FLASH: Record<string, string> = {
  yayinlandi: 'Yayınlandı. Okur tarafı ve arşiv güncellendi.',
  taslak: 'Taslak kaydedildi. Okurlar görmüyor.',
  kaydedildi: 'Kaydedildi.',
  kaldirildi: 'Yayından kaldırıldı.',
  silinmedi: 'Silmek için kutuya “sil” yaz.'
};

export default async function Duzenle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ durum?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const e = await getEntry(id);
  if (!e) notFound();
  const flash = sp.durum ? FLASH[sp.durum] : null;

  return (
    <>
      {flash && <div className={sp.durum === 'silinmedi' ? 'alertbar' : 'okbar'} role="status">{flash}</div>}
      <EntryEditor
        key={e.updated_at}
        heading="Düzenle"
        sub={`${e.published ? 'Yayında' : 'Taslak'} · oluşturuldu ${dotsDT(e.created_at)} · güncellendi ${dotsDT(e.updated_at)}`}
        initial={{ id: e.id, title: e.title, category: e.category as Category, entry_date: e.entry_date, content: e.content, published: e.published, sort_order: e.sort_order }}
      >
        <div style={{ borderTop: '1px solid #E3DED3', paddingTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span className="hint" style={{ flex: '1 1 220px' }}>Değişiklikler kaydedildiği anda okur tarafına yansır.</span>
          <Link className="btn sm" href={`/yonetim/icerikler/${e.id}/istatistik`}>İstatistikler</Link>
        </div>
      </EntryEditor>

      <section className="card mt" aria-label="Tehlikeli işlemler">
        <div className="ct"><h2>Yayından kaldır ya da sil</h2></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {e.published && (
            <form action={unpublishEntryAction}><input type="hidden" name="id" value={e.id} /><button className="btn sm" type="submit">Yayından kaldır</button></form>
          )}
          <form action={deleteEntryAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="hidden" name="id" value={e.id} />
            <label className="hint" htmlFor="confirm">Kalıcı silmek için “sil” yaz:</label>
            <input id="confirm" name="confirm" className="inp" style={{ width: 90, minHeight: 32 }} autoComplete="off" />
            <button className="btn sm dan" type="submit">Sil</button>
          </form>
        </div>
      </section>
    </>
  );
}
