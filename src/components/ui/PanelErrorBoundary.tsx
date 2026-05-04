// src/components/ui/PanelErrorBoundary.tsx
// Phase 2: Per-panel error boundary — class component wrapping each IDE panel.
// On crash, renders a recovery card matching YFitOps design system:
//   void background, danger-red text, mint retry button, mono stack trace.
// Also fires a fire-and-forget insert to the Supabase events table for analytics.

import React from 'react';
import { RefreshCw, Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  panelName: string;
  children: React.ReactNode;
}

export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Phase 2 fix: log to console with panel context
    console.error(`[PanelErrorBoundary:${this.props.panelName}]`, error, info);

    // Phase 2 fix: fire-and-forget insert to Supabase events table
    // Uses raw fetch so we don't depend on the Supabase client (which may be broken)
    const supabaseUrl = (import.meta.env as Record<string, string>).VITE_SUPABASE_URL;
    const supabaseAnonKey = (import.meta.env as Record<string, string>).VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      // Attempt to get current user's session token from localStorage for authenticated insert
      let authToken = supabaseAnonKey;
      try {
        const storageKey = Object.keys(localStorage).find((k) => k.includes('supabase') && k.includes('auth'));
        if (storageKey) {
          const sessionRaw = localStorage.getItem(storageKey);
          if (sessionRaw) {
            const parsed = JSON.parse(sessionRaw) as { access_token?: string };
            if (parsed.access_token) authToken = parsed.access_token;
          }
        }
      } catch {
        // ignore — use anon key
      }

      fetch(`${supabaseUrl}/rest/v1/events`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          event_type: 'client_error',
          payload: {
            panel: this.props.panelName,
            message: error.message,
            stack: error.stack?.slice(0, 500),
            component_stack: info.componentStack?.slice(0, 300),
          },
        }),
      }).catch(() => {
        // silently swallow — we don't want error reporting to cause more errors
      });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const errorMsg = this.state.error?.message ?? 'Unknown error';
    const errorStack = this.state.error?.stack ?? '';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          padding: 24,
          background: 'rgba(13,13,20,0.97)',
        }}
        role="alert"
        aria-live="assertive"
        aria-label={`${this.props.panelName} panel crashed`}
      >
        {/* Danger icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,77,109,0.12)',
            border: '1px solid rgba(255,77,109,0.3)',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={20} color="#FF4D6D" aria-hidden="true" />
        </div>

        {/* Panel name */}
        <p
          style={{
            color: '#EEEEFF',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-display, "JetBrains Mono", monospace)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {this.props.panelName} crashed
        </p>

        {/* Error message */}
        <p
          style={{
            color: '#FF4D6D',
            fontSize: 11,
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            maxWidth: 320,
            textAlign: 'center',
            wordBreak: 'break-all',
            lineHeight: 1.5,
            background: 'rgba(255,77,109,0.06)',
            border: '1px solid rgba(255,77,109,0.15)',
            borderRadius: 6,
            padding: '8px 12px',
            margin: 0,
          }}
        >
          {errorMsg.slice(0, 200)}
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Phase 2 fix: Retry resets error boundary state */}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid rgba(0,245,160,0.35)',
              background: 'rgba(0,245,160,0.10)',
              color: '#00F5A0',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-body, sans-serif)',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              minHeight: 36,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.8')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
            aria-label="Retry — reset this panel"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Retry
          </button>

          {/* Copy full stack trace */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(errorStack || errorMsg).catch(() => {});
              toast.success('Error stack copied to clipboard');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid rgba(122,122,153,0.25)',
              background: 'rgba(122,122,153,0.08)',
              color: '#7A7A99',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-body, sans-serif)',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              minHeight: 36,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.7')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
            aria-label="Copy error stack trace"
          >
            <Copy size={12} aria-hidden="true" />
            Copy error
          </button>
        </div>

        {/* Hint text */}
        <p
          style={{
            color: '#4A4A6A',
            fontSize: 10,
            fontFamily: 'var(--font-body, sans-serif)',
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Only this panel crashed — the rest of the IDE is still running.
          <br />
          If retry doesn't help, refresh the page.
        </p>
      </div>
    );
  }
}
