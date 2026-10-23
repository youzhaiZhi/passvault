import type { EntryType } from './types';

export const TYPE_META: Record<EntryType, { label: string; icon: string; cls: string }> = {
  login: { label: '登录', icon: '🌐', cls: 't-login' },
  apikey: { label: 'API Key', icon: '🔑', cls: 't-apikey' },
  note: { label: '笔记', icon: '📝', cls: 't-note' },
};
