// src/components/features/AgentChat/DiffPreview.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface DiffPreviewProps {
  path: string;
  diff: string;
}

export function DiffPreview({ path, diff }: DiffPreviewProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function renderDiffLine(line: string, index: number) {
    let bg = 'transparent';
    let color = 'var(--text-secondary)';

    if (line.startsWith('+') && !line.startsWith('+++')) {
      bg = 'rgba(0,245,160,0.08)';
      color = '#6EFFC0';
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      bg = 'rgba(255,77,109,0.08)';
      color = '#FF8099';
    } else if (line.startsWith('@@')) {
      color = 'var(--info)';
    } else if (line.startsWith('---') || line.startsWith('+++')) {
      color = 'var(--text-muted)';
    }

    return (
      <div
        key={index}
        className="px-3 py-0.5 font-mono text-xs whitespace-pre-wrap break-all"
        style={{ background: bg, color, lineHeight: 1.6 }}
      >
        {line}
      </div>
    );
  }

  const lines = diff.split('\n');

  return (
    <div
      className="rounded-lg overflow-hidden mt-2"
      style={{ border: '1px solid var(--border-default)', background: 'var(--bg-void)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
      >
        <span
          className="text-xs font-mono truncate"
          style={{ color: 'var(--text-muted)' }}
        >
          {path}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            className="flex items-center justify-center w-6 h-6 rounded transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            onClick={handleCopy}
            aria-label="Copy diff"
          >
            {copied ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
          </button>
          <button
            className="flex items-center justify-center w-6 h-6 rounded transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse diff' : 'Expand diff'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* Diff content */}
      {expanded && (
        <div className="max-h-60 overflow-y-auto" role="region" aria-label="Diff preview">
          {lines.map((line, i) => renderDiffLine(line, i))}
        </div>
      )}
    </div>
  );
}
