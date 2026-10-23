import { useState } from 'react';
import type { FormEvent } from 'react';
import { encryptJson } from '../crypto';
import { entryPut } from '../db';
import { getKey, uuid } from '../session';
import { defaultOptions, generatePassword } from '../generator';
import { TYPE_META } from '../uiMeta';
import type { DecryptedEntry, EntryPayload, EntryType } from '../types';

interface Props {
  type?: EntryType;
  entry?: DecryptedEntry;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function EntryForm({ type: initialType, entry, onClose, onSaved }: Props) {
  const [entryType, setEntryType] = useState<EntryType>(entry?.type ?? initialType ?? 'login');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [favorite, setFavorite] = useState(entry?.favorite ?? false);
  const [p, setP] = useState<EntryPayload>(entry?.payload ?? {});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const upd = (patch: Partial<EntryPayload>) => setP((cur) => ({ ...cur, ...patch }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }
    if (entryType === 'apikey' && !p.key?.trim()) {
      setError('API Key 不能为空');
      return;
    }
    if (entryType === 'note' && !p.content?.trim()) {
      setError('内容不能为空');
      return;
    }
    const key = getKey();
    if (!key) {
      setError('会话已锁定，请重新解锁后再保存');
      return;
    }
    setBusy(true);
    try {
      const now = Date.now();
      const { iv, ct } = await encryptJson(key, p);
      await entryPut({
        id: entry?.id ?? uuid(),
        type: entryType,
        title: title.trim(),
        favorite,
        createdAt: entry?.createdAt ?? now,
        updatedAt: now,
        iv,
        ct,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function genPassword() {
    upd({ password: generatePassword(defaultOptions()) });
  }

  function field(
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    opts: { type?: string; placeholder?: string; mono?: boolean } = {},
  ) {
    return (
      <label>
        {label}
        <input
          type={opts.type ?? 'text'}
          className={opts.mono ? 'mono' : ''}
          value={value ?? ''}
          placeholder={opts.placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      </label>
    );
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="card modal" onSubmit={save}>
        <div className="modal-head">
          <h2>{entry ? '编辑条目' : '新增条目'}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {!entry && (
          <div className="type-picker">
            {(['login', 'apikey', 'note'] as EntryType[]).map((t) => (
              <button
                type="button"
                key={t}
                className={`chip ${entryType === t ? 'active' : ''}`}
                onClick={() => setEntryType(t)}
              >
                {TYPE_META[t].icon} {TYPE_META[t].label}
              </button>
            ))}
          </div>
        )}

        {field('标题', title, setTitle, { placeholder: '例如：GitHub / OpenAI API' })}

        {entryType === 'login' && (
          <>
            {field('网址', p.url, (v) => upd({ url: v }), { placeholder: 'https://…' })}
            {field('用户名 / 邮箱', p.username, (v) => upd({ username: v }))}
            <label>
              密码
              <div className="row">
                <input
                  type="text"
                  className="mono"
                  value={p.password ?? ''}
                  onChange={(e) => upd({ password: e.target.value })}
                  autoComplete="off"
                />
                <button type="button" className="btn" onClick={genPassword}>
                  生成
                </button>
              </div>
            </label>
            {field('TOTP 密钥（可选）', p.totpSecret, (v) => upd({ totpSecret: v }), { mono: true })}
          </>
        )}
        {entryType === 'apikey' && (
          <>
            {field('服务商', p.provider, (v) => upd({ provider: v }), { placeholder: 'OpenAI / Anthropic / …' })}
            <label>
              API Key
              <textarea
                className="mono"
                rows={2}
                value={p.key ?? ''}
                onChange={(e) => upd({ key: e.target.value })}
                autoComplete="off"
              />
            </label>
            {field('Secret（可选）', p.secret, (v) => upd({ secret: v }), { mono: true })}
            {field('有效期（可选）', p.expiresAt, (v) => upd({ expiresAt: v }), { type: 'date' })}
          </>
        )}
        {entryType === 'note' && (
          <label>
            内容
            <textarea rows={5} value={p.content ?? ''} onChange={(e) => upd({ content: e.target.value })} />
          </label>
        )}
        {field('备注（可选）', p.note, (v) => upd({ note: v }))}

        <label className="check">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          收藏
        </label>

        {error && <div className="error">{error}</div>}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? '加密保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
