import 'server-only';
import { db } from './db';
import { parseCover, type CoverText } from './cover';

export const COVER_KEY = 'cover_text';

export async function getCover(): Promise<CoverText> {
  const { data } = await db().from('settings').select('value').eq('key', COVER_KEY).maybeSingle();
  return parseCover(data?.value as string | undefined);
}
