// Parent side of the card frame protocol (documented in web/public/card-frame.html).

export const FRAME_URL = '/media/__amgi_frame.html';

export type FrameEvent =
  | { type: 'amgi:tap'; x: number; y: number }
  | { type: 'amgi:bridge'; cmd: string; typed: string | null }
  | { type: 'amgi:typed'; value: string }
  | { type: 'amgi:key'; key: string; code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; repeat: boolean }
  | { type: 'amgi:script-error'; message: string }
  | { type: 'amgi:height'; seq: number; height: number }
  /** The frame document loaded again (a card script navigated it): the current side must be re-sent. */
  | { type: 'amgi:reloaded' };

export interface RenderRequest {
  side: 'question' | 'answer';
  html: string;
  css: string;
  bodyClass: string;
  answerPreload?: string;
  info?: Record<string, unknown>;
}

export interface FrameConfig {
  htmlClass: string;
  fontScale: number;
  inject: string | null;
}

type Listener = (ev: FrameEvent) => void;

/** Talks to one card iframe. The iframe element is kept for the whole session; cards are swapped in place. */
export class FrameBridge {
  private iframe: HTMLIFrameElement | null = null;
  private seq = 0;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;
  private renderWaiters = new Map<number, () => void>();
  private mutateWaiters = new Map<number, (bytes: Uint8Array | null) => void>();
  private nextId = 1;
  private listeners = new Set<Listener>();
  private config: FrameConfig | null = null;
  /** Whether the official reviewer.js loaded in the frame. */
  reviewerLoaded = false;
  /** Latest value of the type-in-the-answer input. */
  typed: string | null = null;

  constructor() {
    this.readyPromise = this.newReady();
    window.addEventListener('message', this.onMessage);
  }

  private newReady(): Promise<void> {
    return new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  attach(iframe: HTMLIFrameElement | null): void {
    if (iframe === this.iframe) return;
    this.iframe = iframe;
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    this.listeners.clear();
    this.renderWaiters.forEach((r) => r());
    this.renderWaiters.clear();
    this.mutateWaiters.forEach((r) => r(null));
    this.mutateWaiters.clear();
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  private post(msg: unknown): void {
    this.iframe?.contentWindow?.postMessage(msg, window.location.origin);
  }

  private onMessage = (ev: MessageEvent) => {
    if (ev.origin !== window.location.origin || !this.iframe || ev.source !== this.iframe.contentWindow) return;
    const d = ev.data as { type?: string } & Record<string, unknown>;
    if (!d || typeof d.type !== 'string') return;
    switch (d.type) {
      case 'amgi:ready': {
        const again = this.readyResolve === null;
        this.reviewerLoaded = !!d.reviewer;
        // The frame (re)loaded: re-send the config.
        if (this.config) this.post({ type: 'amgi:config', ...this.config });
        this.readyResolve?.();
        this.readyResolve = null;
        if (again) this.listeners.forEach((l) => l({ type: 'amgi:reloaded' }));
        return;
      }
      case 'amgi:rendered': {
        const r = this.renderWaiters.get(d.seq as number);
        this.renderWaiters.delete(d.seq as number);
        r?.();
        return;
      }
      case 'amgi:states-mutated': {
        const r = this.mutateWaiters.get(d.id as number);
        this.mutateWaiters.delete(d.id as number);
        r?.((d.request as Uint8Array | null) ?? null);
        return;
      }
      case 'amgi:typed':
        this.typed = String(d.value ?? '');
        break;
      case 'amgi:bridge':
        if (typeof d.typed === 'string') this.typed = d.typed;
        break;
    }
    this.listeners.forEach((l) => l(d as FrameEvent));
  };

  setConfig(config: FrameConfig): void {
    this.config = config;
    this.post({ type: 'amgi:config', ...config });
  }

  /** Shows a card side; resolves once the frame has run the card's scripts (or after `timeoutMs`). */
  async render(req: RenderRequest, timeoutMs = 8000): Promise<void> {
    await this.ready();
    const seq = ++this.seq;
    if (req.side === 'question') this.typed = null;
    const done = new Promise<void>((resolve) => {
      this.renderWaiters.set(seq, resolve);
      setTimeout(() => {
        if (this.renderWaiters.delete(seq)) resolve();
      }, timeoutMs);
    });
    this.post({ type: 'amgi:render', seq, ...req });
    return done;
  }

  drawFlag(flag: number): void {
    this.post({ type: 'amgi:flag', flag });
  }

  drawMark(marked: boolean): void {
    this.post({ type: 'amgi:mark', marked });
  }

  scroll(by: 'lineUp' | 'lineDown' | 'pageUp' | 'pageDown'): void {
    this.post({ type: 'amgi:scroll', by });
  }

  preload(html: string): void {
    this.post({ type: 'amgi:preload', html });
  }

  /** Runs custom scheduling code in the frame; resolves with SetSchedulingStatesRequest bytes or null. */
  async mutateStates(js: string, statesWithContext: Uint8Array, timeoutMs = 3000): Promise<Uint8Array | null> {
    await this.ready();
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.mutateWaiters.set(id, resolve);
      setTimeout(() => {
        if (this.mutateWaiters.delete(id)) resolve(null);
      }, timeoutMs);
      this.post({ type: 'amgi:mutate-states', id, js, statesWithContext });
    });
  }
}
