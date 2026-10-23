import type { BaseEntry } from './types';

/** 本地存储：IndexedDB，两个仓库 —— meta（kdf/verifier/settings）和 entries */
const DB_NAME = 'passvault';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('无法打开本地数据库'));
    });
  }
  return dbPromise;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('数据库操作失败'));
  });
}

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const d = await openDb();
  return wrap(d.transaction('meta', 'readonly').objectStore('meta').get(key) as IDBRequest<T | undefined>);
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  const d = await openDb();
  await wrap(d.transaction('meta', 'readwrite').objectStore('meta').put(value, key));
}

export async function entriesAll(): Promise<BaseEntry[]> {
  const d = await openDb();
  return wrap(d.transaction('entries', 'readonly').objectStore('entries').getAll() as IDBRequest<BaseEntry[]>);
}

export async function entryPut(entry: BaseEntry): Promise<void> {
  const d = await openDb();
  await wrap(d.transaction('entries', 'readwrite').objectStore('entries').put(entry));
}

export async function entryDelete(id: string): Promise<void> {
  const d = await openDb();
  await wrap(d.transaction('entries', 'readwrite').objectStore('entries').delete(id));
}

/** 清空全部数据（设置里需要输入“删除”二次确认） */
export async function wipeAll(): Promise<void> {
  const d = await openDb();
  await wrap(d.transaction('entries', 'readwrite').objectStore('entries').clear());
  await wrap(d.transaction('meta', 'readwrite').objectStore('meta').clear());
}
