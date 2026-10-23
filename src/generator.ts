/** 密码生成器：crypto.getRandomValues + 拒绝采样（避免取模偏差） */

export interface GenOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  noAmbiguous: boolean;
}

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}<>?,.',
} as const;

const AMBIGUOUS = new Set(['O', 'I', 'l', '0', '1']);

function randInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export function generatePassword(opts: GenOptions): string {
  const defs = [
    { on: opts.upper, chars: SETS.upper },
    { on: opts.lower, chars: SETS.lower },
    { on: opts.digits, chars: SETS.digits },
    { on: opts.symbols, chars: SETS.symbols },
  ];
  const pools: string[] = [];
  for (const d of defs) {
    if (!d.on) continue;
    const filtered = opts.noAmbiguous
      ? d.chars.split('').filter((c) => !AMBIGUOUS.has(c)).join('')
      : d.chars;
    if (filtered) pools.push(filtered);
  }
  if (pools.length === 0) throw new Error('至少选择一种字符集');

  const pick = (s: string) => s[randInt(s.length)];
  const all = pools.join('');
  const length = Math.max(opts.length, pools.length);
  const chars: string[] = pools.map((p) => pick(p)); // 每种字符集至少出现一次
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function defaultOptions(): GenOptions {
  return { length: 16, upper: true, lower: true, digits: true, symbols: true, noAmbiguous: true };
}
