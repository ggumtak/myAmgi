import { getClientErrorLog } from './clientErrors';
import { host } from './host';

/**
 * Copies text, preferring the host's platform clipboard (works inside the Android
 * WebView, where `navigator.clipboard` is often unavailable), then the async
 * Clipboard API, then a hidden textarea + execCommand. Rejects only if all fail.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await host.platformClipboardWrite(text);
    return;
  } catch {
    // fall through
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand('copy')) {
      throw new Error('클립보드에 복사하지 못했습니다.');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

/** Error text for "오류 로그 복사": the UI error plus the host's recent log (`log.get`). */
export async function buildErrorReport(parts: {
  title: string;
  message: string;
  errorLog?: string;
}): Promise<string> {
  const sections = [`${parts.title}\n${parts.message}`];
  if (parts.errorLog) sections.push(`[화면 오류]\n${parts.errorLog}`);
  const clientLog = getClientErrorLog();
  if (clientLog) sections.push(`[최근 화면 오류]\n${clientLog}`);
  sections.push(`[화면 정보]\n${navigator.userAgent}\n${window.location.hash || '#/'}`);
  try {
    const snap = await host.logGet();
    const hostLog = snap?.text || snap?.lines?.join('\n') || '';
    sections.push(`[호스트 로그]\n${hostLog || '기록된 로그가 없습니다.'}`);
  } catch (err) {
    sections.push(
      `[호스트 로그]\n가져오지 못했습니다: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return sections.join('\n\n');
}
