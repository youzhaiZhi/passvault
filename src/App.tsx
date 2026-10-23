import { useCallback, useEffect, useState } from 'react';
import Setup from './screens/Setup';
import Unlock from './screens/Unlock';
import Vault from './screens/Vault';
import { clearKey, getKey, setKey } from './session';
import {
  KDF_ITERATIONS,
  b64,
  checkPassword,
  decryptJson,
  deriveVaultKey,
  makeVerifier,
  randomBytes,
} from './crypto';
import { entriesAll, metaGet, metaSet, wipeAll } from './db';
import type { DecryptedEntry, EntryPayload, KdfMeta, Settings, Verifier } from './types';

type Phase = 'loading' | 'setup' | 'locked' | 'unlocked';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<DecryptedEntry[]>([]);
  const [idleMin, setIdleMin] = useState(5);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  }, []);

  useEffect(() => {
    (async () => {
      const kdf = await metaGet<KdfMeta>('kdf');
      if (!kdf) {
        setPhase('setup');
        return;
      }
      const settings = await metaGet<Settings>('settings');
      if (settings) setIdleMin(settings.idleLockMin);
      setPhase('locked');
    })().catch(() => setPhase('setup'));
  }, []);

  const lock = useCallback(() => {
    clearKey();
    setItems([]);
    setPhase('locked');
  }, []);

  // 空闲自动锁定：密钥从内存清除，需要重新输入主密码
  useEffect(() => {
    if (phase !== 'unlocked' || idleMin <= 0) return;
    const timeoutMs = idleMin * 60_000;
    let timer = window.setTimeout(lock, timeoutMs);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, timeoutMs);
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [phase, idleMin, lock]);

  const loadItems = useCallback(async () => {
    const key = getKey();
    if (!key) return;
    const rows = await entriesAll();
    const list: DecryptedEntry[] = [];
    for (const row of rows) {
      try {
        list.push({ ...row, payload: await decryptJson<EntryPayload>(key, row.iv, row.ct) });
      } catch {
        // 单条数据损坏不阻塞整体加载
      }
    }
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    setItems(list);
  }, []);

  const handleSetupDone = useCallback(async (password: string) => {
    const kdf: KdfMeta = { salt: b64(randomBytes(16)), iterations: KDF_ITERATIONS };
    await metaSet('kdf', kdf);
    await metaSet('verifier', await makeVerifier(password));
    await metaSet('settings', { idleLockMin: 5 } satisfies Settings);
    setKey(await deriveVaultKey(password, kdf));
    setItems([]);
    setPhase('unlocked');
  }, []);

  const handleUnlock = useCallback(
    async (password: string): Promise<boolean> => {
      const kdf = await metaGet<KdfMeta>('kdf');
      const verifier = await metaGet<Verifier>('verifier');
      if (!kdf || !verifier) return false;
      if (!(await checkPassword(password, verifier))) return false;
      setKey(await deriveVaultKey(password, kdf));
      await loadItems();
      setPhase('unlocked');
      return true;
    },
    [loadItems],
  );

  const handleWipe = useCallback(async () => {
    await wipeAll();
    clearKey();
    setItems([]);
    setPhase('setup');
  }, []);

  const changeIdle = useCallback(async (min: number) => {
    setIdleMin(min);
    await metaSet('settings', { idleLockMin: min } satisfies Settings);
  }, []);

  if (phase === 'loading') {
    return (
      <div className="center-screen">
        <div className="app-logo">🔐</div>
      </div>
    );
  }
  if (phase === 'setup') {
    return <Setup onDone={handleSetupDone} />;
  }
  if (phase === 'locked') {
    return <Unlock onUnlock={handleUnlock} />;
  }
  return (
    <>
      <Vault
        items={items}
        reload={loadItems}
        onLock={lock}
        showToast={showToast}
        idleMin={idleMin}
        onIdleChange={changeIdle}
        onWipe={handleWipe}
      />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
