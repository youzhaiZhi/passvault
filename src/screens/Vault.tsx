import { useMemo, useState } from 'react';
import EntryForm from '../components/EntryForm';
import EntryDetail from '../components/EntryDetail';
import SettingsModal from '../components/Settings';
import { copyText, scheduleClipboardClear } from '../session';
import { TYPE_META } from '../uiMeta';
import type { DecryptedEntry, EntryType } from '../types';

type Tab = 'all' | 'fav' | EntryType;

type Modal =
  | { kind: 'create'; type: EntryType }
  | { kind: 'edit'; entry: DecryptedEntry }
  | { kind: 'detail'; entry: DecryptedEntry }
  | { kind: 'settings' };

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'login', label: '登录' },
  { key: 'apikey', label: 'API Key' },
  { key: 'note', label: '笔记' },
  { key: 'fav', label: '收藏' },
];

function subtitle(e: DecryptedEntry): string {
  if (e.type === 'login') return e.payload.username || e.payload.url || '';
  if (e.type === 'apikey') {
    return [e.payload.provider, e.payload.expiresAt ? `到期 ${e.payload.expiresAt}` : '']
      .filter(Boolean)
      .join(' · ');
  }
  return (e.payload.content ?? '').replace(/\s+/g, ' ').slice(0, 40);
}

function mainSecret(e: DecryptedEntry): string {
  if (e.type === 'login') return e.payload.password ?? '';
  if (e.type === 'apikey') return e.payload.key ?? '';
  return '';
}

interface Props {
  items: DecryptedEntry[];
  reload: () => Promise<void>;
  onLock: () => void;
  showToast: (msg: string) => void;
  idleMin: number;
  onIdleChange: (min: number) => Promise<void>;
  onWipe: () => Promise<void>;
}

export default function Vault(props: Props) {
  const { items, reload, onLock, showToast } = props;
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [modal, setModal] = useState<Modal | null>(null);

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((e) => {
      if (tab === 'fav' && !e.favorite) return false;
      if (tab !== 'all' && tab !== 'fav' && e.type !== tab) return false;
      if (!kw) return true;
      const p = e.payload;
      const hay = [e.title, p.url, p.username, p.provider, p.note, e.type === 'note' ? p.content : '']
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [items, q, tab]);

  async function quickCopy(e: DecryptedEntry) {
    const secret = mainSecret(e);
    if (!secret) return;
    const ok = await copyText(secret);
    if (ok) {
      scheduleClipboardClear(30);
      showToast('已复制，30 秒后自动清空剪贴板');
    } else {
      showToast('复制失败，请打开条目手动复制');
    }
  }

  const closeAndReload = async () => {
    setModal(null);
    await reload();
  };

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">🔐 密码盒</div>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => setModal({ kind: 'settings' })}>
            设置
          </button>
          <button className="btn ghost" onClick={onLock}>
            锁定
          </button>
        </div>
      </header>

      <div className="toolbar">
        <input
          className="search"
          placeholder="搜索标题 / 用户名 / 服务商…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn primary" onClick={() => setModal({ kind: 'create', type: 'login' })}>
          ＋ 新增
        </button>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            <span className="count">
              {t.key === 'all'
                ? items.length
                : t.key === 'fav'
                  ? items.filter((i) => i.favorite).length
                  : items.filter((i) => i.type === t.key).length}
            </span>
          </button>
        ))}
      </nav>

      <main className="list">
        {shown.length === 0 && (
          <div className="empty">
            {items.length === 0 ? (
              <>
                <div className="empty-icon">🔐</div>
                <p>还没有任何条目</p>
                <button className="btn primary" onClick={() => setModal({ kind: 'create', type: 'login' })}>
                  添加第一条密码
                </button>
              </>
            ) : (
              <p>没有匹配的结果</p>
            )}
          </div>
        )}
        {shown.map((e) => (
          <div key={e.id} className="item" onClick={() => setModal({ kind: 'detail', entry: e })}>
            <span className={`badge ${TYPE_META[e.type].cls}`}>{TYPE_META[e.type].icon}</span>
            <div className="item-body">
              <div className="item-title">
                {e.favorite && <span className="star">★</span>}
                {e.title}
              </div>
              <div className="item-sub">{subtitle(e)}</div>
            </div>
            {mainSecret(e) && (
              <button
                className="btn ghost copy-btn"
                title="复制密码 / Key"
                onClick={(ev) => {
                  ev.stopPropagation();
                  void quickCopy(e);
                }}
              >
                ⧉
              </button>
            )}
          </div>
        ))}
      </main>

      {modal?.kind === 'create' && <EntryForm type={modal.type} onClose={() => setModal(null)} onSaved={closeAndReload} />}
      {modal?.kind === 'edit' && <EntryForm entry={modal.entry} onClose={() => setModal(null)} onSaved={closeAndReload} />}
      {modal?.kind === 'detail' && (
        <EntryDetail
          entry={modal.entry}
          showToast={showToast}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ kind: 'edit', entry: modal.entry })}
          onDeleted={closeAndReload}
          onUpdated={reload}
        />
      )}
      {modal?.kind === 'settings' && (
        <SettingsModal
          items={items}
          reload={reload}
          showToast={showToast}
          idleMin={props.idleMin}
          onIdleChange={props.onIdleChange}
          onWipe={props.onWipe}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
