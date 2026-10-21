import Gate from '@/components/reader/Gate';
import Reader from '@/components/reader/Reader';
import { getPublishedEntries } from '@/lib/entries';
import { getCover } from '@/lib/cover-store';
import { getReaderSession, lastNameForVisitor, touchSession } from '@/lib/reader-session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getReaderSession();
  if (!session) return <Gate suggestedName={await lastNameForVisitor()} />;
  if (!session.name) return <Gate hasSession suggestedName={await lastNameForVisitor()} />;

  // İçerik yalnızca geçerli bir oturum varken sunucudan gelir; herkese açık bir içerik adresi yoktur.
  const [entries, cover] = await Promise.all([getPublishedEntries(), getCover(), touchSession(session.id)]);
  return <Reader entries={entries} name={session.name} cover={cover} />;
}
