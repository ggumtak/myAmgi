import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { announceClientError, describeError as describe, recordClientError, subscribeClientErrors } from './clientErrors';
import { ErrorState, useToast } from './ui';

let globalHandlersInstalled = false;

/**
 * Installs window `error` / `unhandledrejection` handlers once. If the app never
 * rendered (the root element is empty), a plain fallback with a reload button is
 * written into it so the screen is never blank.
 */
export function installGlobalErrorHandlers(rootEl: HTMLElement | null): void {
  if (globalHandlersInstalled || typeof window === 'undefined') return;
  globalHandlersInstalled = true;

  const ensureNotBlank = () => {
    window.setTimeout(() => {
      if (!rootEl || rootEl.childElementCount > 0) return;
      const wrap = document.createElement('div');
      wrap.setAttribute('role', 'alert');
      wrap.style.cssText =
        'padding:24px 16px;font:16px/1.6 system-ui,sans-serif;color:#000;background:#fff;min-height:100dvh;box-sizing:border-box';
      const title = document.createElement('p');
      title.style.cssText = 'font-weight:700;margin:0 0 8px';
      title.textContent = '앱 화면을 불러오지 못했습니다';
      const body = document.createElement('p');
      body.style.cssText = 'margin:0 0 16px';
      body.textContent = '다시 불러오기를 눌러 주세요. 문제가 계속되면 앱을 완전히 닫았다가 다시 여세요.';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '다시 불러오기';
      btn.style.cssText = 'min-height:44px;padding:0 16px;border:2px solid #000;background:#fff;font:inherit';
      btn.addEventListener('click', () => window.location.reload());
      wrap.append(title, body, btn);
      rootEl.appendChild(wrap);
    }, 0);
  };

  window.addEventListener('error', (ev: ErrorEvent) => {
    // Resource load errors (img/audio) do not reach window without capture; this is a script error.
    recordClientError('error', ev.error ?? ev.message);
    announceClientError(describe(ev.error ?? ev.message).message);
    ensureNotBlank();
  });
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    recordClientError('unhandledrejection', ev.reason);
    // Aborted fetches (navigation away) are expected noise.
    if (ev.reason instanceof DOMException && ev.reason.name === 'AbortError') return;
    announceClientError(describe(ev.reason).message);
    ensureNotBlank();
  });
}

/** Shows a toast (throttled) for uncaught errors / unhandled rejections. Render inside ToastProvider. */
export function GlobalErrorToaster() {
  const { showToast } = useToast();
  const lastAtRef = useRef(0);
  useEffect(() => {
    const fn = (message: string) => {
      const now = Date.now();
      if (now - lastAtRef.current < 5000) return;
      lastAtRef.current = now;
      showToast(
        message ? `예기치 못한 오류가 발생했습니다: ${message}` : '예기치 못한 오류가 발생했습니다.',
        'error'
      );
    };
    return subscribeClientErrors(fn);
  }, [showToast]);
  return null;
}

/* --------------------------------------------------------------------------
 * React error boundary
 * ------------------------------------------------------------------------ */

export interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Title shown above the message. */
  title?: string;
  /** Clear the error when the hash route changes (per-route boundary). */
  resetOnHashChange?: boolean;
  /** Root boundary: retry reloads the page (providers may be broken). */
  reloadOnRetry?: boolean;
}

interface AppErrorBoundaryState {
  error: unknown;
  componentStack: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: unknown): Partial<AppErrorBoundaryState> {
    return { error: error ?? new Error('알 수 없는 오류') };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? '';
    recordClientError('render', error, componentStack);
    this.setState({ componentStack });
  }

  componentDidMount(): void {
    if (this.props.resetOnHashChange) {
      window.addEventListener('hashchange', this.handleHashChange);
    }
  }

  componentWillUnmount(): void {
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  private handleHashChange = () => {
    if (this.state.error) this.reset();
  };

  private reset = () => {
    this.setState({ error: null, componentStack: '' });
  };

  private handleRetry = () => {
    if (this.props.reloadOnRetry) {
      window.location.reload();
      return;
    }
    this.reset();
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    const { message, detail } = describe(error);
    const errorLog = [detail, componentStack.trim()].filter(Boolean).join('\n\n');
    return (
      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <ErrorState
          title={this.props.title ?? '화면을 표시하지 못했습니다'}
          message={
            message
              ? `예기치 못한 오류가 발생했습니다: ${message}`
              : '예기치 못한 오류가 발생했습니다.'
          }
          errorLog={errorLog}
          onRetry={this.handleRetry}
          retryLabel={this.props.reloadOnRetry ? '다시 불러오기' : '다시 시도'}
        />
      </div>
    );
  }
}
