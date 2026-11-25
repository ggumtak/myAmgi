import { Component, type ReactNode } from 'react';
import { ErrorState } from './States';

/** Catches render errors so a screen shows an error state, never a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error('[myAmgi] screen crashed', error);
  }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return <ErrorState error={this.state.error} title="화면을 표시하지 못했습니다" onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
