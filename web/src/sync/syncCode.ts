export interface SyncCodePayload {
  supabaseUrl: string;
  supabaseAnonKey: string;
  email?: string;
  refreshToken?: string;
  accessToken?: string;
}

const PREFIX = 'MYAMGI1:';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode credentials into Android-compatible `MYAMGI1:<base64url(json)>` sync code.
 * Keys: u=supabaseUrl, k=supabaseAnonKey, e=email, r=refreshToken, t=accessToken
 */
export function encodeSyncCode(payload: SyncCodePayload): string {
  const compact: Record<string, string> = {
    u: payload.supabaseUrl.trim().replace(/\/+$/, ''),
    k: payload.supabaseAnonKey.trim(),
  };
  if (payload.email) compact.e = payload.email.trim();
  if (payload.refreshToken) compact.r = payload.refreshToken.trim();
  if (payload.accessToken) compact.t = payload.accessToken.trim();

  const jsonBytes = new TextEncoder().encode(JSON.stringify(compact));
  return `${PREFIX}${toBase64Url(jsonBytes)}`;
}

/**
 * Decode `MYAMGI1:<base64url(json)>` sync code.
 */
export function decodeSyncCode(code: string): SyncCodePayload {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error('유효하지 않은 동기화 코드입니다 (MYAMGI1: 접두사 필요).');
  }
  const encoded = trimmed.slice(PREFIX.length).trim();
  if (!encoded) {
    throw new Error('동기화 코드 내용이 비어 있습니다.');
  }
  const bytes = fromBase64Url(encoded);
  const json = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as Record<string, unknown>;

  if (typeof json.u !== 'string' || typeof json.k !== 'string' || !json.u || !json.k) {
    throw new Error('동기화 코드에 Supabase URL 또는 Anon Key가 없습니다.');
  }

  return {
    supabaseUrl: json.u.replace(/\/+$/, ''),
    supabaseAnonKey: json.k,
    email: typeof json.e === 'string' ? json.e : undefined,
    refreshToken: typeof json.r === 'string' ? json.r : undefined,
    accessToken: typeof json.t === 'string' ? json.t : undefined,
  };
}
