import Gate from '@/components/reader/Gate';
import Reader from '@/components/reader/Reader';
import { getPublishedEntries } from '@/lib/entries';
import { getReaderSession, lastNameForVisitor, touchSession } from '@/lib/reader-session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getReaderSession();
  if (!session) return <Gate initialStage="pin" />;
  if (!session.name) return <Gate initialStage="name" suggestedName={await lastNameForVisitor()} />;

  // İçerik yalnızca geçerli bir oturum varken sunucudan gelir; herkese açık bir içerik adresi yoktur.
  const [entries] = await Promise.all([getPublishedEntries(), touchSession(session.id)]);
  return <Reader entries={entries} name={session.name} />;
}
