import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from 'react';
import type { ResolvedTheme } from '../../context/AppContext';

export interface CardFrameKeyEvent {
  key: string;
  code: string;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  repeat: boolean;
}

export interface CardRenderPayload {
  side: 'question' | 'answer';
  html: string;
  css?: string;
  bodyClass?: string;
  preloadAnswerHtml?: string;
  theme?: ResolvedTheme;
  fontScale?: number;
  lineHeight?: number;
  tapToFlip?: boolean;
  hanjaEnabled?: boolean;
  forwardKeys?: boolean;
}

export interface CardFrameProps {
  className?: string;
  style?: CSSProperties;
  theme?: ResolvedTheme;
  fontScale?: number;
  lineHeight?: number;
  tapToFlip?: boolean;
  hanjaEnabled?: boolean;
  title?: string;
  onFrameReady?: () => void;
  onRendered?: (side: 'question' | 'answer') => void;
  onCardTap?: () => void;
  onPlaySound?: (tag: string) => void;
  onTypeAnsSubmit?: (value: string) => void;
  onHanjaLookup?: (text: string, sentence?: string) => void;
  onBridgeCommand?: (cmd: string) => void;
  onKeyDown?: (ev: CardFrameKeyEvent) => void;
}

export interface CardFrameHandle {
  render: (payload: CardRenderPayload) => void;
  setTheme: (theme: ResolvedTheme) => void;
  setFontScale: (fontScale: number) => void;
  setLineHeight: (lineHeight: number) => void;
  hanjaKey: (action: 'open' | 'next' | 'prev') => void;
  getTypedAnswer: () => Promise<string>;
}

type FrameOutboundMessage =
  | ({ type: 'render' } & CardRenderPayload)
  | { type: 'setTheme'; theme: ResolvedTheme }
  | { type: 'setFontScale'; fontScale: number }
  | { type: 'setLineHeight'; lineHeight: number }
  | { type: 'setForwardKeys'; enabled: boolean }
  | { type: 'hanjaKey'; action: 'open' | 'next' | 'prev' }
  | { type: 'getTypedAnswer' };

function getTargetOrigin(): string {
  try {
    if (window.location?.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
  } catch {
    // Ignore location access errors
  }
  return '*';
}

export const CardFrame = forwardRef<CardFrameHandle, CardFrameProps>(
  function CardFrame(
    {
      className,
      style,
      theme = 'light',
      fontScale,
      lineHeight,
      tapToFlip,
      hanjaEnabled,
      title = '카드 영역',
      onFrameReady,
      onRendered,
      onCardTap,
      onPlaySound,
      onTypeAnsSubmit,
      onHanjaLookup,
      onBridgeCommand,
      onKeyDown,
    },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const loadedRef = useRef(false);
    const readyRef = useRef(false);
    const queueRef = useRef<FrameOutboundMessage[]>([]);
    const typedAnswerResolversRef = useRef<Array<(val: string) => void>>([]);
    const frameInputFocusedRef = useRef(false);
    const forwardKeys = Boolean(onKeyDown);

    const callbacksRef = useRef({
      onFrameReady,
      onRendered,
      onCardTap,
      onPlaySound,
      onTypeAnsSubmit,
      onHanjaLookup,
      onBridgeCommand,
      onKeyDown,
    });
    callbacksRef.current = {
      onFrameReady,
      onRendered,
      onCardTap,
      onPlaySound,
      onTypeAnsSubmit,
      onHanjaLookup,
      onBridgeCommand,
      onKeyDown,
    };

    const defaultsRef = useRef({
      theme,
      fontScale,
      lineHeight,
      tapToFlip,
      hanjaEnabled,
      forwardKeys,
    });
    defaultsRef.current = {
      theme,
      fontScale,
      lineHeight,
      tapToFlip,
      hanjaEnabled,
      forwardKeys,
    };

    const flushQueue = useCallback(() => {
      const win = iframeRef.current?.contentWindow;
      if (!win || (!loadedRef.current && !readyRef.current)) return;
      const queued = queueRef.current;
      if (queued.length === 0) return;
      queueRef.current = [];
      const targetOrigin = getTargetOrigin();
      for (const msg of queued) {
        win.postMessage(msg, targetOrigin);
      }
    }, []);

    const postToFrame = useCallback(
      (msg: FrameOutboundMessage) => {
        const win = iframeRef.current?.contentWindow;
        if (win && (loadedRef.current || readyRef.current)) {
          flushQueue();
          win.postMessage(msg, getTargetOrigin());
        } else {
          queueRef.current.push(msg);
        }
      },
      [flushQueue]
    );

    // Listen for messages coming from this iframe instance
    useEffect(() => {
      const onMessage = (event: MessageEvent) => {
        const win = iframeRef.current?.contentWindow;
        if (!win || event.source !== win) return;
        const expectedOrigin = getTargetOrigin();
        if (expectedOrigin !== '*' && event.origin && event.origin !== expectedOrigin) {
          return;
        }
        const data = event.data as Record<string, unknown> | null;
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
          case 'frameReady':
            readyRef.current = true;
            flushQueue();
            callbacksRef.current.onFrameReady?.();
            break;
          case 'rendered':
            callbacksRef.current.onRendered?.(
              data.side === 'answer' ? 'answer' : 'question'
            );
            break;
          case 'cardTap':
            callbacksRef.current.onCardTap?.();
            break;
          case 'playSound':
            if (typeof data.tag === 'string') {
              callbacksRef.current.onPlaySound?.(data.tag);
            }
            break;
          case 'typeAnsSubmit':
            callbacksRef.current.onTypeAnsSubmit?.(
              typeof data.value === 'string' ? data.value : ''
            );
            break;
          case 'hanjaLookup':
            if (typeof data.text === 'string' && data.text.length > 0) {
              callbacksRef.current.onHanjaLookup?.(
                data.text,
                typeof data.sentence === 'string' && data.sentence.length > 0
                  ? data.sentence
                  : undefined
              );
            }
            break;
          case 'typedAnswer': {
            const val = typeof data.value === 'string' ? data.value : '';
            const resolvers = typedAnswerResolversRef.current.splice(0);
            for (const resolve of resolvers) {
              resolve(val);
            }
            break;
          }
          case 'bridgeCommand':
            if (typeof data.cmd === 'string') {
              callbacksRef.current.onBridgeCommand?.(data.cmd);
            }
            break;
          case 'inputFocus': {
            const focused = Boolean(data.focused);
            if (focused !== frameInputFocusedRef.current) {
              frameInputFocusedRef.current = focused;
              window.dispatchEvent(
                new CustomEvent('amgi:frame-input-focus', { detail: focused })
              );
            }
            break;
          }
          case 'keyDown':
            callbacksRef.current.onKeyDown?.({
              key: typeof data.key === 'string' ? data.key : '',
              code: typeof data.code === 'string' ? data.code : '',
              shift: Boolean(data.shift),
              ctrl: Boolean(data.ctrl),
              meta: Boolean(data.meta),
              alt: Boolean(data.alt),
              repeat: Boolean(data.repeat),
            });
            break;
          default:
            break;
        }
      };

      window.addEventListener('message', onMessage);
      return () => {
        window.removeEventListener('message', onMessage);
        if (frameInputFocusedRef.current) {
          frameInputFocusedRef.current = false;
          window.dispatchEvent(
            new CustomEvent('amgi:frame-input-focus', { detail: false })
          );
        }
        const pending = typedAnswerResolversRef.current.splice(0);
        for (const resolve of pending) {
          resolve('');
        }
      };
    }, [flushQueue]);

    // Sync theme/fontScale/lineHeight/forwardKeys props dynamically
    useEffect(() => {
      postToFrame({ type: 'setTheme', theme });
    }, [theme, postToFrame]);

    useEffect(() => {
      if (fontScale !== undefined) {
        postToFrame({ type: 'setFontScale', fontScale });
      }
    }, [fontScale, postToFrame]);

    useEffect(() => {
      if (lineHeight !== undefined) {
        postToFrame({ type: 'setLineHeight', lineHeight });
      }
    }, [lineHeight, postToFrame]);

    useEffect(() => {
      postToFrame({ type: 'setForwardKeys', enabled: forwardKeys });
    }, [forwardKeys, postToFrame]);

    useImperativeHandle(
      ref,
      () => ({
        render(payload: CardRenderPayload) {
          const defs = defaultsRef.current;
          postToFrame({
            type: 'render',
            ...payload,
            theme: payload.theme ?? defs.theme,
            fontScale: payload.fontScale ?? defs.fontScale,
            lineHeight: payload.lineHeight ?? defs.lineHeight,
            tapToFlip: payload.tapToFlip ?? defs.tapToFlip,
            hanjaEnabled: payload.hanjaEnabled ?? defs.hanjaEnabled,
            forwardKeys: payload.forwardKeys ?? defs.forwardKeys,
          });
        },
        setTheme(nextTheme: ResolvedTheme) {
          postToFrame({ type: 'setTheme', theme: nextTheme });
        },
        setFontScale(nextScale: number) {
          postToFrame({ type: 'setFontScale', fontScale: nextScale });
        },
        setLineHeight(nextLineHeight: number) {
          postToFrame({ type: 'setLineHeight', lineHeight: nextLineHeight });
        },
        hanjaKey(action: 'open' | 'next' | 'prev') {
          postToFrame({ type: 'hanjaKey', action });
        },
        getTypedAnswer(): Promise<string> {
          return new Promise<string>((resolve) => {
            let settled = false;
            const done = (val: string) => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timer);
              resolve(val);
            };
            const timer = window.setTimeout(() => {
              const idx = typedAnswerResolversRef.current.indexOf(done);
              if (idx >= 0) typedAnswerResolversRef.current.splice(idx, 1);
              done('');
            }, 600);
            typedAnswerResolversRef.current.push(done);
            postToFrame({ type: 'getTypedAnswer' });
          });
        },
      }),
      [postToFrame]
    );

    const handleIframeLoad = useCallback(() => {
      loadedRef.current = true;
      flushQueue();
    }, [flushQueue]);

    return (
      <iframe
        ref={iframeRef}
        src="/media/__amgi_frame.html"
        title={title}
        className={className}
        onLoad={handleIframeLoad}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          background: 'var(--surface)',
          ...style,
        }}
      />
    );
  }
);

export default CardFrame;
