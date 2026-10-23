import { useState } from 'react';
import { entryDelete, entryPut } from '../db';
import { copyText, scheduleClipboardClear } from '../session';
import { TYPE_META } from '../uiMeta';
import type { DecryptedEntry } from '../types';

interface Props {
  entry: DecryptedEntry;
  showToast: (msg: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void | Promise<void>;
  onUpdated: () => void | Promise<void>;
}

function Field({
  label,
  value,
  secret = false,
  showToast,
}: {
  label: string;
  value?: string;
  secret?: boolean;
  showToast: (m: string) => void;
}) {
  const [shown, setShown] = useState(false);
  if (!value) return null;
  const display = secret && !shown ? '•'.repeat(Math.min(value.length, 24)) : value;
  return (
    <div className="detail-field">
      <div className="detail-label">{label}</div>
      <div className="detail-value mono">{display}</div>
      <div className="detail-actions">
        {secret && (
          <button className="btn ghost small" onClick={() => setShown(!shown)}>
            {shown ? '隐藏' : '显示'}
          </button>
        )}
        <button
          className="btn ghost small"
          onClick={async () => {
            const ok = await copyText(value);
            if (ok) {
              scheduleClipboardClear(30);
              showToast('已复制，30 秒后自动清空剪贴板');
            } else {
              showToast('复制失败');
            }
          }}
        >
          复制
        </button>
      </div>
    </div>
  );
}

export default function EntryDetail({ entry, showToast, onClose, onEdit, onDeleted, onUpdated }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [fav, setFav] = useState(entry.favorite);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite() {
    const next = !fav;
    setFav(next);
    const { payload: _p, ...base } = entry;
    setBusy(true);
    try {
      await entryPut({ ...base, favorite: next });
      await onUpdated();
    } catch {
      setFav(!next);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      await entryDelete(entry.id);
      await onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card modal">
        <div className="modal-head">
          <h2>
            <span className={`badge ${TYPE_META[entry.type].cls}`}>{TYPE_META[entry.type].icon}</span>
            {entry.title}
          </h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="muted small-text">
          {TYPE_META[entry.type].label} · 更新于 {new Date(entry.updatedAt).toLocaleString('zh-CN')}
        </div>

        {entry.type === 'login' && (
          <>
            <Field label="网址" value={entry.payload.url} showToast={showToast} />
            <Field label="用户名" value={entry.payload.username} showToast={showToast} />
            <Field label="密码" value={entry.payload.password} secret showToast={showToast} />
            <Field label="TOTP 密钥" value={entry.payload.totpSecret} secret showToast={showToast} />
          </>
        )}
        {entry.type === 'apikey' && (
          <>
            <Field label="服务商" value={entry.payload.provider} showToast={showToast} />
            <Field label="API Key" value={entry.payload.key} secret showToast={showToast} />
            <Field label="Secret" value={entry.payload.secret} secret showToast={showToast} />
            {entry.payload.expiresAt && (
              <div className="detail-field">
                <div className="detail-label">有效期</div>
                <div className="detail-value">{entry.payload.expiresAt}</div>
              </div>
            )}
          </>
        )}
        {entry.type === 'note' && <Field label="内容" value={entry.payload.content} showToast={showToast} />}
        <Field label="备注" value={entry.payload.note} showToast={showToast} />

        <div className="modal-foot">
          {confirming ? (
            <>
              <span className="error">确认删除？该操作不可恢复</span>
              <button className="btn danger" onClick={doDelete} disabled={busy}>
                确认删除
              </button>
              <button className="btn" onClick={() => setConfirming(false)}>
                取消
              </button>
            </>
          ) : (
            <>
              <button className="btn danger" onClick={() => setConfirming(true)}>
                删除
              </button>
              <button className="btn ghost" onClick={toggleFavorite} disabled={busy}>
                {fav ? '★ 已收藏' : '☆ 收藏'}
              </button>
              <button className="btn primary" onClick={onEdit}>
                编辑
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
