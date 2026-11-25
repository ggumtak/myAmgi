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
