export type EntryType = 'login' | 'apikey' | 'note';

/** 落盘的条目：标题保持明文以便搜索，其余敏感字段全部加密存在 ct 里 */
export interface BaseEntry {
  id: string;
  type: EntryType;
  title: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  iv: string;
  ct: string;
}

export interface LoginPayload {
  url?: string;
  username?: string;
  password?: string;
  totpSecret?: string;
  note?: string;
}

export interface ApiKeyPayload {
  provider?: string;
  key?: string;
  secret?: string;
  expiresAt?: string;
  note?: string;
}

export interface NotePayload {
  content?: string;
  note?: string;
}

/** 三类条目的字段并集，按类型只用到其中一部分 */
export type EntryPayload = LoginPayload & ApiKeyPayload & NotePayload;

export interface DecryptedEntry extends BaseEntry {
  payload: EntryPayload;
}

export interface KdfMeta {
  salt: string;
  iterations: number;
}

/** 主密码校验器：独立派生的密钥加密固定明文，用来判断主密码是否正确 */
export interface Verifier {
  salt: string;
  iterations: number;
  iv: string;
  ct: string;
}

export interface Settings {
  /** 空闲多少分钟后自动锁定，0 表示不自动锁定 */
  idleLockMin: number;
}

/** 导出备份文件（整包用独立口令加密） */
export interface EncryptedBlob {
  format: 'passvault-export';
  version: 1;
  kdf: 'PBKDF2-SHA256';
  salt: string;
  iterations: number;
  iv: string;
  ct: string;
}

export interface ExportEntry {
  id: string;
  type: EntryType;
  title: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  payload: EntryPayload;
}
