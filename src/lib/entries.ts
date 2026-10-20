import 'server-only';
import { db } from './db';
import type { Category, EntryLite } from './pagination';

export interface EntryRow extends EntryLite {
  published: boolean;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getPublishedEntries(): Promise<EntryLite[]> {
  const { data, error } = await db()
    .from('entries')
    .select('id, title, content, category, entry_date, sort_order')
    .eq('published', true)
    .order('entry_date', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EntryLite[];
}

export async function getAllEntries(): Promise<EntryRow[]> {
  const { data, error } = await db()
    .from('entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EntryRow[];
}

export async function getEntry(id: string): Promise<EntryRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('entries').select('*').eq('id', id).maybeSingle();
  return (data as EntryRow) ?? null;
}

export const CATEGORY_NAMES: Record<Category, string> = { siir: 'Şiir', not: 'Not', defter: 'Defter' };
