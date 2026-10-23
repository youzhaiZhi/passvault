import { useState } from 'react';
import type { FormEvent } from 'react';

export default function Unlock({ onUnlock }: { onUnlock: (password: string) => Promise<boolean> }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setError('');
    const ok = await onUnlock(pw);
    if (!ok) {
      setError('主密码不正确');
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card setup-card" onSubmit={submit}>
        <div className="app-logo">🔐</div>
        <h1>密码盒已锁定</h1>
        <p className="muted center">输入主密码解锁（密钥派生约需 1 秒）</p>
        <label>
          主密码
          <input
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError('');
            }}
            autoFocus
          />
        </label>
        {error && <div className="error shake">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? '正在解锁…' : '解锁'}
        </button>
      </form>
    </div>
  );
}
