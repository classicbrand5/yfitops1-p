// src/components/layout/WorkspaceErrorBoundary.tsx
// React Error Boundary for the Workspace — catches uncaught JS errors
// and shows a recovery UI instead of a white screen

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WorkspaceErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[WorkspaceErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="flex flex-col items-center justify-center h-full"
        style={{ background: 'var(--bg-base)' }}
        role="alert"
      >
        <div
          className="w-full max-w-md mx-4 p-8 rounded-xl text-center animate-fade-up"
          style={{
            background: 'rgba(255,77,109,0.04)',
            border: '1px solid rgba(255,77,109,0.2)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.25)' }}
            aria-hidden="true"
          >
            <AlertTriangle size={24} style={{ color: 'var(--danger)' }} />
          </div>

          <h2 className="font-display text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Workspace crashed
          </h2>

          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            An unexpected error occurred in the workspace.
          </p>

          {this.state.error && (
            <pre
              className="text-xs text-left overflow-x-auto mb-5 p-3 rounded-lg"
              style={{
                background: 'var(--bg-void)',
                border: '1px solid var(--border-default)',
                color: 'var(--danger)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {this.state.error.message}
            </pre>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              className="flex items-center gap-2 btn-ghost text-sm py-2 px-4"
              style={{ minHeight: 40 }}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Recovery
            </button>
            <button
              className="flex items-center gap-2 btn-accent text-sm py-2 px-4"
              style={{ minHeight: 40 }}
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={13} aria-hidden="true" />
              Reload Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
