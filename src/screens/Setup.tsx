import { useState } from 'react';
import type { FormEvent } from 'react';

const MIN_LEN = 8;

function strength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= MIN_LEN) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ['太弱', '弱', '弱', '一般', '强', '很强'];
  return { score, label: labels[score] };
}

export default function Setup({ onDone }: { onDone: (password: string) => Promise<void> }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = strength(pw);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (pw.length < MIN_LEN) {
      setError(`主密码至少 ${MIN_LEN} 位`);
      return;
    }
    if (pw !== pw2) {
      setError('两次输入不一致');
      return;
    }
    if (!ack) {
      setError('请先勾选下方确认项');
      return;
    }
    setBusy(true);
    try {
      await onDone(pw);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card setup-card" onSubmit={submit}>
        <div className="app-logo">🔐</div>
        <h1>创建你的密码盒</h1>
        <p className="muted center">
          所有数据在本机加密后存储，不经过任何服务器。
          <br />
          加密密钥由主密码派生，<b>主密码不会被保存、无法找回</b>。
        </p>
        <label>
          主密码
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            autoComplete="new-password"
          />
        </label>
        {pw && (
          <div className={`strength s${s.score}`}>
            <div className="bars">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < s.score ? 'on' : ''} />)}</div>
            <span>{s.label}</span>
          </div>
        )}
        <label>
          确认主密码
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="check">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          我已了解：忘记主密码将导致数据永远无法解开
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? '正在生成密钥…' : '创建密码盒'}
        </button>
      </form>
    </div>
  );
}
