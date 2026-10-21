// İsim kontrolü: hem tarayıcıda (anında geri bildirim) hem sunucuda (asıl karar) çalışır.
// Amaç kusursuz doğrulama değil; "asdadd", "qweqwe", "aaaa", "test" gibi uydurmaları elemek.

const LETTERS = /^[a-zA-ZçğıöşüÇĞİÖŞÜâîûÂÎÛéèëáàäóòíìúùñÉÈËÁÀÄÓÒÍÌÚÙÑ'’ -]+$/;
const VOWELS = 'aeıioöuüâîûéèëáàäóòíìúù';

// Klavyede yan yana duran harf üçlüleri (ileri ve geri). İsimlerde sık geçen "ert", "rew" gibi üçlüler bilerek yok.
const ROWS = ['asdfghjklşi', 'zxcvbnmöç'];
const TOP = ['qwe', 'wer', 'tyu', 'yuı', 'uıo', 'ıop', 'opğ', 'pğü', 'ewq'];
function keyboardRuns(w: string) {
  for (const row of ROWS) {
    for (let i = 0; i + 3 <= row.length; i++) {
      const tri = row.slice(i, i + 3);
      if (w.includes(tri) || w.includes([...tri].reverse().join(''))) return true;
    }
  }
  return TOP.some((t) => w.includes(t));
}

const BLOCK = new Set([
  'test', 'deneme', 'isim', 'adım', 'adim', 'admin', 'root', 'null', 'undefined', 'anonim', 'anonymous',
  'kullanıcı', 'kullanici', 'user', 'abc', 'xyz', 'qwerty', 'asdf', 'yok', 'kimse', 'bilmem', 'sana', 'ne'
]);

const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');
const trUpper = (s: string) => s.toLocaleUpperCase('tr-TR');

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

export function checkName(raw: unknown): NameCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'Adını yaz.' };
  const n = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!n) return { ok: false, reason: 'Adını yaz.' };
  if (n.length < 2) return { ok: false, reason: 'Biraz kısa.' };
  if (n.length > 30) return { ok: false, reason: 'Sadece adın yeter.' };
  if (!LETTERS.test(n)) return { ok: false, reason: 'Sadece harf.' };

  const words = n.split(/[ -]/).filter(Boolean);
  if (words.length > 3) return { ok: false, reason: 'Sadece adın yeter.' };

  const gibberish = { ok: false as const, reason: 'Bu bir isim gibi durmuyor.' };
  if (BLOCK.has(trLower(n.replace(/['’]/g, '')))) return gibberish;

  for (const word of words) {
    const w = trLower(word.replace(/['’]/g, ''));
    if (w.length < 2) return gibberish;
    if (BLOCK.has(w)) return gibberish;
    const vowels = [...w].filter((c) => VOWELS.includes(c)).length;
    if (vowels === 0) return gibberish;
    if (w.length >= 5 && vowels / w.length < 0.2) return gibberish;
    if (/(.)\1\1/.test(w)) return gibberish;                                  // aaa
    if (new RegExp(`[^${VOWELS}]{5,}`).test(w)) return gibberish;             // beş sessiz yan yana
    if (new RegExp(`[${VOWELS}]{4,}`).test(w)) return gibberish;              // dört sesli yan yana
    if (keyboardRuns(w)) return gibberish;                                    // asd, sdf, zxc…
    if (w.length >= 4 && /^(.{1,3})\1+.{0,2}$/.test(w)) return gibberish;   // adad, kekeke
  }

  // Büyük harf düzeni: "eREN yılmaz" → "Eren Yılmaz"
  const pretty = n.split(' ').map((part) =>
    part.split('-').map((p) => (p ? trUpper(p[0]) + trLower(p.slice(1)) : p)).join('-')
  ).join(' ');
  return { ok: true, name: pretty };
}
