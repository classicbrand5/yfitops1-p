// src/components/features/AgentChat/AgentThinking.tsx
import React from 'react';

export function AgentThinking() {
  return (
    <div className="flex items-start gap-3 animate-fade-up" role="status" aria-label="AI agent is thinking">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold animate-pulse-glow"
        style={{
          background: 'rgba(0,245,160,0.12)',
          border: '1px solid rgba(0,245,160,0.3)',
          color: 'var(--accent-400)',
          fontFamily: 'var(--font-display)',
          fontSize: 10,
        }}
        aria-hidden="true"
      >
        AI
      </div>

      <div className="glass rounded-xl px-4 py-3" style={{ minWidth: 120 }}>
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
          YFitOps is thinking
        </p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {[0, 200, 400].map((delay, i) => (
            <span
              key={i}
              className="animate-thinking"
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent-400)',
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
