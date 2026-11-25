const nf = new Intl.NumberFormat('ko-KR');

/** 1204 -> "1,204". */
export function formatCount(n: number): string {
  return nf.format(n);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDateTime(secs: number): string {
  return new Date(secs * 1000).toLocaleString('ko-KR');
}

/** "60" -> "1분", "3600" -> "1시간". */
export function formatWait(secs: number): string {
  if (secs < 60) return `${secs}초`;
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}시간 ${rest}분` : `${h}시간`;
}

/** Epoch milliseconds -> "2026. 11. 25. 오후 11:47:03". */
export function formatDateTimeMs(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR');
}

/**
 * The time a backup was taken, from its name (`backup-YYYY-MM-DD-HH.MM.SS[-n].colpkg`, local time,
 * as Anki names them), else from `fallbackMs`. Returns "2026년 11월 25일 오후 11:47".
 */
export function backupDate(name: string, fallbackMs?: number): string {
  const m = /backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/.exec(name);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : new Date(fallbackMs ?? 0);
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
