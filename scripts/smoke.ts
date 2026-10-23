/**
 * 加密层冒烟测试：node --experimental-strip-types scripts/smoke.ts
 * Node 22 自带 WebCrypto（与浏览器同一标准实现），可验证纯逻辑部分。
 */
import assert from 'node:assert/strict';
import {
  b64,
  checkPassword,
  decryptJson,
  deriveVaultKey,
  encryptJson,
  makeVerifier,
  openWithPassphrase,
  randomBytes,
  sealWithPassphrase,
} from '../src/crypto.ts';
import { defaultOptions, generatePassword } from '../src/generator.ts';

// 1. 派生 + 加解密往返（测试用低迭代数，实际应用为 600k）
const kdf = { salt: b64(randomBytes(16)), iterations: 100_000 };
const key = await deriveVaultKey('correct-horse', kdf);
const data = { hello: '世界', n: 42, arr: [1, 2, 3] };
const { iv, ct } = await encryptJson(key, data);
assert.deepEqual(await decryptJson(key, iv, ct), data);
console.log('✓ 加解密往返一致，密文 ct 前 32 字符:', ct.slice(0, 32));

// 2. 错误密码派生的密钥解不开密文（GCM 校验失败）
const wrongKey = await deriveVaultKey('wrong-password', kdf);
await assert.rejects(decryptJson(wrongKey, iv, ct));
console.log('✓ 错误密钥解密被拒绝');

// 3. 主密码校验器
const verifier = await makeVerifier('correct-horse');
assert.equal(await checkPassword('correct-horse', verifier), true);
assert.equal(await checkPassword('wrong-password', verifier), false);
console.log('✓ 主密码校验器：正确密码通过、错误密码拒绝');

// 4. 导出/导入整包加密封存
const sealed = await sealWithPassphrase('backup-pass', { entries: [data] });
assert.equal(sealed.format, 'passvault-export');
const opened = await openWithPassphrase(sealed, 'backup-pass');
assert.deepEqual(opened, { entries: [data] });
await assert.rejects(openWithPassphrase(sealed, 'wrong-pass'));
console.log('✓ 备份导出/导入：口令正确可解、口令错误拒绝');

// 5. 密码生成器
const pw = generatePassword(defaultOptions());
assert.equal(pw.length, 16);
assert.match(pw, /[A-Z]/);
assert.match(pw, /[a-z]/);
assert.match(pw, /\d/);
assert.match(pw, /[^a-zA-Z0-9]/);
assert.ok(!/[OIl01]/.test(pw), '排除易混淆字符');
const unique = new Set(Array.from({ length: 50 }, () => generatePassword(defaultOptions())));
assert.equal(unique.size, 50);
console.log('✓ 密码生成器：', pw);

console.log('\n全部加密层测试通过 ✅');
