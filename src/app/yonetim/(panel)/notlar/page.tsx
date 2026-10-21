import Link from 'next/link';
import { db } from '@/lib/db';
import { dotsDT } from '@/lib/format';
import { Empty } from '@/components/admin/Charts';
import { deleteNoteAction, markAllNotesReadAction, markNoteReadAction } from '../../actions';

export const dynamic = 'force-dynamic';

interface Note { id: string; entry_id: string | null; entry_title: string; reader_name: string; body: string; created_at: string; read_at: string | null }

export default async function Notlar({ searchParams }: { searchParams: Promise<{ goster?: string }> }) {
  const sp = await searchParams;
  const onlyNew = sp.goster === 'yeni';
  let q = db().from('reader_notes').select('id, entry_id, entry_title, reader_name, body, created_at, read_at').order('created_at', { ascending: false }).limit(200);
  if (onlyNew) q = q.is('read_at', null);
  const [{ data }, { count: unread }, { count: total }] = await Promise.all([
    q,
    db().from('reader_notes').select('id', { count: 'exact', head: true }).is('read_at', null),
    db().from('reader_notes').select('id', { count: 'exact', head: true })
  ]);
  const notes = (data ?? []) as Note[];

  return (
    <div>
      <div className="ph">
        <div><h1>Okur notları</h1><p className="sub">Okurların yazıların sonunda bıraktığı notlar. En yeni önce.</p></div>
        <div className="acts">
          {(unread ?? 0) > 0 && (
            <form action={markAllNotesReadAction}><button className="btn" type="submit">Hepsini okundu yap</button></form>
          )}
        </div>
      </div>

      <div className="tabs" role="group" aria-label="Filtre" style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
        <Link href="/yonetim/notlar" className={'tab' + (!onlyNew ? ' on' : '')}>Tümü · {total ?? 0}</Link>
        <Link href="/yonetim/notlar?goster=yeni" className={'tab' + (onlyNew ? ' on' : '')}>Okunmamış · {unread ?? 0}</Link>
      </div>

      {notes.length === 0 ? (
        <section className="card">
          <Empty
            title={onlyNew ? 'Okunmamış not yok.' : 'Henüz not bırakan olmadı.'}
            text="Okurlar bir yazının sonundaki “bu yazıya bir not bırak” bağlantısından yazınca notlar burada görünür."
          />
        </section>
      ) : (
        <div className="notes">
          {notes.map((n) => (
            <article key={n.id} className={'note' + (n.read_at ? '' : ' new')}>
              <header className="nh">
                <span className="nwho"><b>{n.reader_name || 'İsimsiz'}</b>{!n.read_at && <span className="pill bad">Yeni</span>}</span>
                <time className="mono mu" dateTime={n.created_at}>{dotsDT(n.created_at)}</time>
              </header>
              <p className="nbody">{n.body}</p>
              <footer className="nf">
                <span className="nent">
                  {n.entry_id
                    ? <Link href={`/yonetim/icerikler/${n.entry_id}`}>{n.entry_title || 'Başlıksız'}</Link>
                    : <span className="mu">{n.entry_title || 'Başlıksız'} (silinmiş)</span>}
                </span>
                <span className="nact">
                  {!n.read_at && (
                    <form action={markNoteReadAction}><input type="hidden" name="id" value={n.id} /><button className="btn sm" type="submit">Okundu</button></form>
                  )}
                  <form action={deleteNoteAction}><input type="hidden" name="id" value={n.id} /><button className="btn sm dan" type="submit">Sil</button></form>
                </span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
