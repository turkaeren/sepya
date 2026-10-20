import EntryEditor from '@/components/admin/EntryEditor';
import { istDay } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function Yeni() {
  return (
    <EntryEditor
      heading="Yeni içerik"
      sub="Taslak · henüz okurlara görünmüyor"
      initial={{ title: '', category: 'siir', entry_date: istDay(new Date()), content: '', published: false, sort_order: 0 }}
    />
  );
}
