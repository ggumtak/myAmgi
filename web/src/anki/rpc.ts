import * as $protobuf from 'protobufjs';

/**
 * Typed error raised when `/_anki/<method>` returns a non-2xx HTTP status
 * (typically 500 with the Anki backend's localized UTF-8 message).
 */
export class AnkiError extends Error {
  readonly status: number;
  readonly method: string;

  constructor(method: string, status: number, message: string) {
    super(message || `Anki 백엔드 오류 (${method}: HTTP ${status})`);
    this.name = 'AnkiError';
    this.method = method;
    this.status = status;
  }
}

export interface ProtoMessageCodec<TReq extends object, TRes> {
  encode(message: TReq, writer?: $protobuf.Writer): $protobuf.Writer;
  decode(reader: $protobuf.Reader | Uint8Array, length?: number): TRes;
  toObject?(
    message: TRes,
    options?: $protobuf.IConversionOptions
  ): Record<string, unknown>;
}

/** Optional base URL override for non-browser integration tests (Node/Vitest). */
let rpcBaseUrl = '';
let rpcHeaders: Record<string, string> = {};

export function configureAnkiRpc(options: {
  baseUrl?: string;
  headers?: Record<string, string>;
}): void {
  if (options.baseUrl !== undefined) {
    rpcBaseUrl = options.baseUrl.replace(/\/+$/, '');
  }
  if (options.headers !== undefined) {
    rpcHeaders = { ...options.headers };
  }
}

export function getAnkiRpcConfig(): {
  baseUrl: string;
  headers: Record<string, string>;
} {
  return { baseUrl: rpcBaseUrl, headers: { ...rpcHeaders } };
}

export async function callRaw(
  method: string,
  body: Uint8Array,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const payload =
    body.byteOffset === 0 &&
    body.byteLength === body.buffer.byteLength &&
    body.buffer instanceof ArrayBuffer
      ? body.buffer
      : new Uint8Array(body).buffer;
  const response = await fetch(`${rpcBaseUrl}/_anki/${method}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/binary',
      ...rpcHeaders,
    },
    body: payload,
    signal,
  });

  if (!response.ok) {
    let message = '';
    try {
      message = (await response.text()).trim();
    } catch {
      message = '';
    }
    throw new AnkiError(
      method,
      response.status,
      message || `Anki 백엔드 호출에 실패했습니다 (${method}, HTTP ${response.status}).`
    );
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Calls `/_anki/<method>` with protobuf request/response codecs.
 * Decoded `int64`/`uint64` fields (which protobufjs decodes as `Long` objects)
 * are preserved on the returned message; use `toNumber()` / `longToNumber()`
 * where JS numbers are required.
 */
export async function rpc<TReq extends object, TRes>(
  method: string,
  ReqType: Pick<ProtoMessageCodec<TReq, unknown>, 'encode'>,
  ResType: Pick<ProtoMessageCodec<never, TRes>, 'decode'>,
  reqObj: TReq,
  signal?: AbortSignal
): Promise<TRes> {
  const encoded = ReqType.encode(reqObj).finish();
  const raw = await callRaw(method, encoded, signal);
  return ResType.decode(raw);
}

/** Converts a protobufjs `number | Long | null | undefined` to a JS `number`. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'bigint') return Number(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const fn = (value as { toNumber?: () => number }).toNumber;
    if (typeof fn === 'function') return fn.call(value);
  }
  return fallback;
}

const textDecoder = new TextDecoder('utf-8');
const textEncoder = new TextEncoder();

export function decodeJsonBytes<T = unknown>(bytes: Uint8Array | null | undefined): T {
  if (!bytes || bytes.length === 0) return null as T;
  const str = textDecoder.decode(bytes);
  return (str ? JSON.parse(str) : null) as T;
}

export function encodeJsonBytes(value: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(value));
}
