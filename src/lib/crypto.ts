import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/** 256 bit rastgele oturum anahtarı */
export const randomToken = () => randomBytes(32).toString('base64url');

/** Veritabanında yalnızca anahtarın özeti tutulur; çalınan bir yedekten oturum ele geçirilemez. */
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(sha256(a));
  const bb = Buffer.from(sha256(b));
  return timingSafeEqual(ab, bb);
}

// OWASP önerisi: argon2id, 19 MiB bellek, 2 tur, 1 paralellik
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashSecret = (plain: string) => hash(plain, ARGON);

export async function verifySecret(hashed: string, plain: string) {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
