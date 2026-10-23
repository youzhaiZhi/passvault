/** 会话内持有的保险库密钥：只存在内存里，锁定或关闭页面即消失 */
let vaultKey: CryptoKey | null = null;

export function setKey(key: CryptoKey): void {
  vaultKey = key;
}

export function getKey(): CryptoKey | null {
  return vaultKey;
}

export function clearKey(): void {
  vaultKey = null;
}

export function uuid(): string {
  return crypto.randomUUID();
}

let clipboardTimer: number | undefined;

/** 复制成功后调用：30 秒后自动清空剪贴板 */
export function scheduleClipboardClear(seconds = 30): void {
  window.clearTimeout(clipboardTimer);
  clipboardTimer = window.setTimeout(() => {
    navigator.clipboard.writeText('').catch(() => {
      /* 页面在后台时可能无权写剪贴板，尽力而为 */
    });
  }, seconds * 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
