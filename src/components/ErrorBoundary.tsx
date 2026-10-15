import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** What to do when the user asks to start over. Defaults to reloading the page. */
  onReset?: () => void;
}

interface State {
  error?: Error;
}

/**
 * Catches a render error anywhere below it and shows the message with a way
 * out, instead of leaving a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Elegant Passwords hit an unexpected error', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reset = this.props.onReset ?? (() => window.location.reload());
    return (
      <div className="app" role="alert">
        <h1>Something went wrong</h1>
        <p className="error">{error.message || String(error)}</p>
        <p className="hint">This is a bug in the app, not a problem with your settings. Nothing has been sent anywhere.</p>
        <button type="button" className="primary" onClick={reset}>
          Reload the page
        </button>
      </div>
    );
  }
}
