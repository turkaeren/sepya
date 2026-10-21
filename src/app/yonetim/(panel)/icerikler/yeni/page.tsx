import EntryEditor from '@/components/admin/EntryEditor';
import { istDay } from '@/lib/format';
import { db } from '@/lib/db';
import type { InitialsStyle } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export default async function Yeni() {
  // Son kullanılan baş harf ve yazı tipi yeni yazıda hazır gelsin
  const { data: last } = await db().from('entries').select('initials, initials_style').not('initials', 'is', null)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  return (
    <EntryEditor
      heading="Yeni içerik"
      sub="Taslak · henüz okurlara görünmüyor"
      initial={{
        title: '', category: 'siir', entry_date: istDay(new Date()), content: '', published: false, sort_order: 0,
        initials: (last?.initials as string | null) ?? '', initials_style: ((last?.initials_style as InitialsStyle | null) ?? 'el')
      }}
    />
  );
}
