import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { failed: boolean };

/** Last line of defence: a render crash shows a recovery screen instead of a blank app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="error crash">
        <p>Something went wrong showing this screen. Your data is still saved on this phone.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
