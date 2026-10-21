import Link from 'next/link';
import { db } from '@/lib/db';
import { shortDT } from '@/lib/format';
import { Empty } from '@/components/admin/Charts';
import { deleteNoteAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function Notlar() {
  const sb = db();
  const { data } = await sb.from('reader_notes')
    .select('id, session_id, name, entry_id, entry_title, body, created_at, read_at')
    .order('created_at', { ascending: false }).limit(300);
  const notes = data ?? [];
  const unread = notes.filter((n) => !n.read_at).length;
  // Sayfa açılınca hepsi okunmuş sayılır; bu görünümde yeniler yine işaretli kalır.
  if (unread) await sb.from('reader_notes').update({ read_at: new Date().toISOString() }).is('read_at', null);

  return (
    <div>
      <div className="ph">
        <div><h1>Notlar</h1><p className="sub">Okurların sana bıraktığı notlar. Yalnızca sen görürsün.{unread ? ` · ${unread} yeni` : ''}</p></div>
      </div>
      {notes.length === 0 ? (
        <section className="card"><Empty title="Henüz not yok." text="Okurlar sağ üstteki kalem simgesinden ya da yazının sonundaki “bir not bırak”tan sana yazabilir." /></section>
      ) : (
        <div className="notelist">
          {notes.map((n) => (
            <article key={n.id} className={'card note' + (n.read_at ? '' : ' new')}>
              <header className="nh">
                <div>
                  <b>{n.name ?? 'isimsiz'}</b>
                  {!n.read_at && <span className="pill bad" style={{ marginLeft: 8 }}>yeni</span>}
                  <div className="nm mono">{shortDT(n.created_at)}{n.entry_title ? <> · <span className="nent">“{n.entry_title}” hakkında</span></> : null}</div>
                </div>
                <div className="acts">
                  {n.session_id && <Link className="btn sm" href={`/yonetim/ziyaretciler/${n.session_id}`}>Oturum</Link>}
                  <form action={deleteNoteAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="btn sm" type="submit">Sil</button>
                  </form>
                </div>
              </header>
              <p className="nbody">{n.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
