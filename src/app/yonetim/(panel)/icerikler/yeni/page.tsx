import EntryEditor from '@/components/admin/EntryEditor';
import { db } from '@/lib/db';
import { istDay } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Yeni() {
  // Son kullanılan imza, yeni yazıda hazır gelir.
  const { data } = await db().from('entries').select('signature').not('signature', 'is', null).order('created_at', { ascending: false }).limit(1);
  const signature = (data?.[0]?.signature as string | null | undefined) ?? '';
  return (
    <EntryEditor
      heading="Yeni içerik"
      sub="Taslak · henüz okurlara görünmüyor"
      initial={{ title: '', category: 'siir', entry_date: istDay(new Date()), content: '', published: false, sort_order: 0, signature }}
    />
  );
}
