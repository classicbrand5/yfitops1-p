// src/components/ui/ConfirmModal.tsx
// Confirmation dialog — destructive (red) and approve (mint) variants
// Used for all dangerous agent actions: delete_file, open_pr, run_command

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  detail?: string;              // Monospace code block — shows exact path/command
  isDestructive?: boolean;      // true = red, false = mint
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  detail,
  isDestructive = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button on open
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const accentColor = isDestructive ? '#FF4D6D' : '#00F5A0';
  const accentBg    = isDestructive ? 'rgba(255,77,109,0.12)'  : 'rgba(0,245,160,0.10)';
  const accentBorder= isDestructive ? 'rgba(255,77,109,0.35)'  : 'rgba(0,245,160,0.35)';
  const IconEl      = isDestructive ? AlertTriangle : CheckCircle2;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 flex items-center justify-center animate-fade-in"
      style={{
        zIndex: 200,
        background: 'rgba(6,6,9,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      {/* Card */}
      <div
        className="animate-fade-up w-full max-w-md mx-4"
        style={{
          background: 'rgba(13,13,20,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6 pb-4">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
            aria-hidden="true"
          >
            <IconEl size={18} style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="confirm-modal-title"
              className="font-display font-semibold text-base mb-1"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {title}
            </h2>
            <p
              id="confirm-modal-desc"
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              {description}
            </p>
          </div>
          <button
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={13} />
          </button>
        </div>

        {/* Detail code block */}
        {detail && (
          <div className="px-6 pb-4">
            <pre
              className="text-xs overflow-x-auto"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '10px 14px',
                fontFamily: 'var(--font-mono)',
                color: accentColor,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {detail}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            className="btn-ghost text-sm py-2 px-4"
            style={{ minHeight: 40, fontSize: 13 }}
            onClick={onCancel}
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className="flex items-center gap-2 text-sm font-semibold py-2 px-5 rounded-lg transition-all"
            style={{
              minHeight: 40,
              fontSize: 13,
              background: accentBg,
              border: `1px solid ${accentBorder}`,
              color: accentColor,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
            onClick={onConfirm}
            aria-label={confirmLabel}
          >
            {isDestructive ? <AlertTriangle size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
