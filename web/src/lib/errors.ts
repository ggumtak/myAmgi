import { AnkiError, HostUnreachableError } from '../anki/rpc';
import { host, HostError, hostInfoStore } from '../host';

export interface ErrorDescription {
  message: string;
  detail: string;
}

/** A Korean, user-facing message plus technical detail for the log. */
export function describeError(err: unknown): ErrorDescription {
  if (err instanceof AnkiError) {
    return { message: err.backendMessage || '엔진에서 오류가 발생했습니다', detail: `${err.method} (${err.status})\n${err.stack ?? ''}` };
  }
  if (err instanceof HostUnreachableError) {
    return { message: err.message, detail: String((err as { cause?: unknown }).cause ?? '') };
  }
  if (err instanceof HostError) {
    return { message: err.message, detail: `${err.fn} (${err.status})\n${err.detail ?? ''}` };
  }
  if (err instanceof Error) {
    return { message: '예상하지 못한 오류가 발생했습니다', detail: `${err.name}: ${err.message}\n${err.stack ?? ''}` };
  }
  return { message: '예상하지 못한 오류가 발생했습니다', detail: String(err) };
}

/** Copies text; tries the Clipboard API, then the host, then execCommand. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // fall through
  }
  try {
    await host.platform.clipboardWrite(text);
    return;
  } catch {
    // fall through
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/** Builds the "오류 로그" text: the error, app/device info, and the host log. */
export async function buildErrorLog(err?: unknown): Promise<string> {
  const parts: string[] = [`myAmgi 오류 로그 ${new Date().toISOString()}`];
  if (err !== undefined) {
    const d = describeError(err);
    parts.push(`오류: ${d.message}`, d.detail);
  }
  parts.push(`화면: ${window.location.hash}`, `브라우저: ${navigator.userAgent}`);
  const info = hostInfoStore.get();
  if (info) parts.push(`앱: ${JSON.stringify(info)}`);
  try {
    const log = await host.logGet();
    parts.push('--- 호스트 로그 ---', log.text);
    if (log.errors?.length) parts.push('--- 최근 오류 ---', ...log.errors);
  } catch (e) {
    parts.push(`(호스트 로그를 가져오지 못했습니다: ${String(e)})`);
  }
  return parts.join('\n');
}

export async function copyErrorLog(err?: unknown): Promise<void> {
  await copyText(await buildErrorLog(err));
}
