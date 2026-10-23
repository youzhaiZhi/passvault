import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  KDF_ITERATIONS,
  b64,
  checkPassword,
  decryptJson,
  deriveVaultKey,
  encryptJson,
  makeVerifier,
  openWithPassphrase,
  randomBytes,
  sealWithPassphrase,
} from '../crypto';
import { entriesAll, entryPut, metaGet, metaSet } from '../db';
import { getKey, setKey, uuid } from '../session';
import type { DecryptedEntry, EncryptedBlob, EntryPayload, ExportEntry, KdfMeta, Verifier } from '../types';

interface Props {
  items: DecryptedEntry[];
  reload: () => Promise<void>;
  showToast: (msg: string) => void;
  idleMin: number;
  onIdleChange: (min: number) => Promise<void>;
  onWipe: () => Promise<void>;
  onClose: () => void;
}

export default function SettingsModal(props: Props) {
  const { items, showToast } = props;
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [expPw, setExpPw] = useState('');
  const [expPw2, setExpPw2] = useState('');
  const [impPw, setImpPw] = useState('');
  const [impFile, setImpFile] = useState<File | null>(null);
  const [wipeText, setWipeText] = useState('');
  const [busy, setBusy] = useState(false);

  async function changeMaster() {
    if (newPw.length < 8) {
      showToast('新主密码至少 8 位');
      return;
    }
    if (newPw !== newPw2) {
      showToast('两次输入的新密码不一致');
      return;
    }
    const key = getKey();
    if (!key) return;
    setBusy(true);
    try {
      const verifier = await metaGet<Verifier>('verifier');
      if (!verifier || !(await checkPassword(oldPw, verifier))) {
        showToast('旧主密码不正确');
        return;
      }
      const rows = await entriesAll();
      const newKdf: KdfMeta = { salt: b64(randomBytes(16)), iterations: KDF_ITERATIONS };
      const newKey = await deriveVaultKey(newPw, newKdf);
      for (const row of rows) {
        const payload = await decryptJson<EntryPayload>(key, row.iv, row.ct);
        const sealed = await encryptJson(newKey, payload);
        await entryPut({ ...row, iv: sealed.iv, ct: sealed.ct });
      }
      await metaSet('kdf', newKdf);
      await metaSet('verifier', await makeVerifier(newPw));
      setKey(newKey);
      await props.reload();
      setOldPw('');
      setNewPw('');
      setNewPw2('');
      showToast('主密码已修改，全部数据已重新加密');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '修改失败');
    } finally {
      setBusy(false);
    }
  }

  async function doExport() {
    if (expPw.length < 8) {
      showToast('备份口令至少 8 位');
      return;
    }
    if (expPw !== expPw2) {
      showToast('两次口令不一致');
      return;
    }
    setBusy(true);
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        entries: items.map((e) => ({ ...e, payload: e.payload })) as ExportEntry[],
      };
      const sealed = await sealWithPassphrase(expPw, data);
      const url = URL.createObjectURL(new Blob([JSON.stringify(sealed, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `passvault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出加密备份文件');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    const key = getKey();
    if (!key || !impFile) {
      showToast('请先选择备份文件');
      return;
    }
    if (!impPw) {
      showToast('请输入备份口令');
      return;
    }
    setBusy(true);
    try {
      const blob = JSON.parse(await impFile.text()) as EncryptedBlob;
      const data = await openWithPassphrase<{ entries?: ExportEntry[] }>(blob, impPw);
      const existing = new Set((await entriesAll()).map((e) => e.id));
      let imported = 0;
      for (const e of data.entries ?? []) {
        const id = existing.has(e.id) ? uuid() : e.id;
        const sealed = await encryptJson(key, e.payload);
        await entryPut({
          id,
          type: e.type,
          title: e.title,
          favorite: !!e.favorite,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          iv: sealed.iv,
          ct: sealed.ct,
        });
        existing.add(id);
        imported++;
      }
      await props.reload();
      setImpFile(null);
      setImpPw('');
      showToast(`已导入 ${imported} 条`);
    } catch {
      showToast('导入失败：口令错误或文件格式不对');
    } finally {
      setBusy(false);
    }
  }

  async function doWipe() {
    if (wipeText !== '删除') {
      showToast('请输入“删除”以确认');
      return;
    }
    setBusy(true);
    try {
      await props.onWipe();
    } finally {
      setBusy(false);
    }
  }

  const section = (title: string, body: ReactNode) => (
    <div className="settings-section">
      <h3>{title}</h3>
      {body}
    </div>
  );

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="card modal">
        <div className="modal-head">
          <h2>设置</h2>
          <button className="btn ghost" onClick={props.onClose}>
            ✕
          </button>
        </div>

        {section(
          '自动锁定',
          <label>
            空闲多少分钟后自动锁定
            <select value={props.idleMin} onChange={(e) => void props.onIdleChange(Number(e.target.value))}>
              <option value={1}>1 分钟</option>
              <option value={5}>5 分钟</option>
              <option value={15}>15 分钟</option>
              <option value={0}>不自动锁定（不推荐）</option>
            </select>
          </label>,
        )}

        {section(
          '修改主密码',
          <div className="stack">
            <input
              type="password"
              placeholder="旧主密码"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              autoComplete="off"
            />
            <input
              type="password"
              placeholder="新主密码（至少 8 位）"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="确认新主密码"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              autoComplete="new-password"
            />
            <button className="btn" disabled={busy} onClick={changeMaster}>
              修改主密码（将重新加密全部数据）
            </button>
          </div>,
        )}

        {section(
          '导出加密备份',
          <div className="stack">
            <p className="muted small-text">
              备份文件用独立口令加密，建议口令与主密码不同。浏览器本地数据可能被清理，请定期导出并妥善保存。
            </p>
            <input
              type="password"
              placeholder="备份口令（至少 8 位）"
              value={expPw}
              onChange={(e) => setExpPw(e.target.value)}
              autoComplete="off"
            />
            <input
              type="password"
              placeholder="确认备份口令"
              value={expPw2}
              onChange={(e) => setExpPw2(e.target.value)}
              autoComplete="off"
            />
            <button className="btn" disabled={busy || items.length === 0} onClick={doExport}>
              导出全部（{items.length} 条）
            </button>
          </div>,
        )}

        {section(
          '导入备份',
          <div className="stack">
            <input type="file" accept=".json,application/json" onChange={(e) => setImpFile(e.target.files?.[0] ?? null)} />
            <input
              type="password"
              placeholder="备份口令"
              value={impPw}
              onChange={(e) => setImpPw(e.target.value)}
              autoComplete="off"
            />
            <button className="btn" disabled={busy || !impFile} onClick={doImport}>
              导入
            </button>
          </div>,
        )}

        {section(
          '危险区',
          <div className="stack">
            <p className="muted small-text">清空本机全部数据（不影响已导出的备份文件）。输入“删除”后点击按钮。</p>
            <input
              placeholder="输入“删除”确认"
              value={wipeText}
              onChange={(e) => setWipeText(e.target.value)}
              autoComplete="off"
            />
            <button className="btn danger" disabled={busy} onClick={doWipe}>
              清空全部数据
            </button>
          </div>,
        )}

        <p className="muted small-text">
          密码盒 v0.1 · 本地加密存储（PBKDF2 600k + AES-256-GCM）· 数据不经过任何服务器
        </p>
      </div>
    </div>
  );
}
