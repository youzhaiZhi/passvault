/**
 * 加密层：全部基于浏览器原生 WebCrypto。
 * - 主密码 -> PBKDF2-HMAC-SHA256（600k 次迭代）-> AES-256-GCM 密钥
 * - 每条数据独立随机 12 字节 IV
 * - 主密码校验器用另一份盐单独派生，不暴露保险库密钥
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** OWASP 2023 对 PBKDF2-HMAC-SHA256 的建议最低迭代次数 */
export const KDF_ITERATIONS = 600_000;

const VERIFY_PLAINTEXT = 'passvault/verify/v1';

export function b64(input: Uint8Array): string {
  let s = '';
  for (let i = 0; i < input.length; i++) s += String.fromCharCode(input[i]);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 用主密码 + kdf 参数派生保险库密钥 */
export function deriveVaultKey(password: string, kdf: { salt: string; iterations: number }): Promise<CryptoKey> {
  return deriveAesKey(password, unb64(kdf.salt), kdf.iterations);
}

export async function encryptJson(key: CryptoKey, data: unknown): Promise<{ iv: string; ct: string }> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode(JSON.stringify(data)),
  );
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export async function decryptJson<T = unknown>(key: CryptoKey, iv: string, ct: string): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) as unknown as BufferSource },
    key,
    unb64(ct) as unknown as BufferSource,
  );
  return JSON.parse(decoder.decode(plain)) as T;
}

export async function makeVerifier(password: string, iterations = 200_000): Promise<VerifierShape> {
  const salt = randomBytes(16);
  const key = await deriveAesKey(password, salt, iterations);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode(VERIFY_PLAINTEXT),
  );
  return { salt: b64(salt), iterations, iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

interface VerifierShape {
  salt: string;
  iterations: number;
  iv: string;
  ct: string;
}

export async function checkPassword(password: string, verifier: VerifierShape): Promise<boolean> {
  try {
    const key = await deriveAesKey(password, unb64(verifier.salt), verifier.iterations);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(verifier.iv) as unknown as BufferSource },
      key,
      unb64(verifier.ct) as unknown as BufferSource,
    );
    return decoder.decode(plain) === VERIFY_PLAINTEXT;
  } catch {
    return false;
  }
}

/** 用独立口令整包加密封存（导出备份用） */
export async function sealWithPassphrase(passphrase: string, data: unknown): Promise<EncryptedBlobShape> {
  const salt = randomBytes(16);
  const key = await deriveAesKey(passphrase, salt, KDF_ITERATIONS);
  const { iv, ct } = await encryptJson(key, data);
  return {
    format: 'passvault-export',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    salt: b64(salt),
    iterations: KDF_ITERATIONS,
    iv,
    ct,
  };
}

interface EncryptedBlobShape {
  format: 'passvault-export';
  version: number;
  kdf: string;
  salt: string;
  iterations: number;
  iv: string;
  ct: string;
}

export async function openWithPassphrase<T>(blob: EncryptedBlobShape, passphrase: string): Promise<T> {
  if (blob.kdf !== 'PBKDF2-SHA256') throw new Error('不支持的备份格式');
  const key = await deriveAesKey(passphrase, unb64(blob.salt), blob.iterations);
  return decryptJson<T>(key, blob.iv, blob.ct);
}
