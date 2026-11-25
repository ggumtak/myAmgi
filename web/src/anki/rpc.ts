// Raw protobuf RPC to the Anki engine through the host: POST /_anki/<method>.
//
// The host forwards the request bytes to the backend's raw dispatch
// (`<method>Raw(byte[])`) and returns the raw response bytes. Engine errors come
// back as a non-2xx status with the backend's (localized) message as UTF-8 text.

import type { Writer } from 'protobufjs/minimal';
import { methods, type MethodName, type MethodRequest, type MethodResponse } from './generated/methods';

/** Minimal shape of a generated protobufjs message class. */
export interface MessageType<Req, Res = Req> {
  encode(message: Req, writer?: Writer): Writer;
  decode(reader: Uint8Array): Res;
}

/** An error reported by the Anki engine (or by the host while forwarding). */
export class AnkiError extends Error {
  readonly method: string;
  readonly status: number;
  /** The backend's own message text (Korean when the backend language is ko). */
  readonly backendMessage: string;

  constructor(method: string, status: number, backendMessage: string) {
    super(backendMessage || `엔진 오류 (${status})`);
    this.name = 'AnkiError';
    this.method = method;
    this.status = status;
    this.backendMessage = backendMessage;
  }
}

/** Thrown when the host cannot be reached at all (no HTTP response). */
export class HostUnreachableError extends Error {
  constructor(cause: unknown) {
    super('앱 엔진에 연결할 수 없습니다');
    this.name = 'HostUnreachableError';
    (this as { cause?: unknown }).cause = cause;
  }
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

let fetcher: Fetcher = (input, init) => fetch(input, init);
let baseUrl = '';

/** Test hook / embedding hook: replace transport or base URL. */
export function configureRpc(opts: { fetch?: Fetcher; baseUrl?: string }): void {
  if (opts.fetch) fetcher = opts.fetch;
  if (opts.baseUrl !== undefined) baseUrl = opts.baseUrl.replace(/\/$/, '');
}

/**
 * Call backend method `method` (lowerCamelCase, e.g. `getQueuedCards`).
 * Encodes `request` with `Req`, decodes the reply with `Res`.
 */
export async function call<Req, Res>(
  method: string,
  Req: MessageType<Req, unknown>,
  Res: MessageType<unknown, Res>,
  request: Req,
): Promise<Res> {
  const body = Req.encode(request).finish();
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/_anki/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/binary' },
      credentials: 'include',
      // Copy into a plain ArrayBuffer-backed view; protobufjs may hand back a pooled slice.
      body: body.slice(),
    });
  } catch (err) {
    throw new HostUnreachableError(err);
  }
  if (!response.ok) {
    let text = '';
    try {
      text = (await response.text()).trim();
    } catch {
      // ignore unreadable error body
    }
    throw new AnkiError(method, response.status, text);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return Res.decode(bytes);
}

/** Table-driven call using the generated method table (fully typed). */
export function invoke<M extends MethodName>(
  name: M,
  request: MethodRequest<M> = {} as MethodRequest<M>,
): Promise<MethodResponse<M>> {
  const spec = methods[name] as unknown as {
    request: MessageType<MethodRequest<M>, unknown>;
    response: MessageType<unknown, MethodResponse<M>>;
  };
  return call(name, spec.request, spec.response, request);
}
