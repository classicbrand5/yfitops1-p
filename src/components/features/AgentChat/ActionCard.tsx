// src/components/features/AgentChat/ActionCard.tsx
import React from 'react';
import { DiffPreview } from './DiffPreview';
import { Check, X, Loader2, Clock, AlertCircle, Terminal, FileEdit, FilePlus, Trash2, FolderPlus, Search } from 'lucide-react';
import type { AgentAction } from '@/types/agent.types';

interface ActionCardProps {
  action: AgentAction;
  index: number;
  onApprove?: (index: number) => void;
  onReject?: (index: number) => void;
  showControls?: boolean;
}

function getActionIcon(type: AgentAction['type']) {
  switch (type) {
    case 'run_command': return Terminal;
    case 'write_file': return FilePlus;
    case 'edit_file': return FileEdit;
    case 'delete_file': return Trash2;
    case 'create_dir': return FolderPlus;
    case 'search_files': return Search;
    default: return FileEdit;
  }
}

function getActionLabel(type: AgentAction['type']): string {
  switch (type) {
    case 'run_command': return 'Run Command';
    case 'write_file': return 'Write File';
    case 'edit_file': return 'Edit File';
    case 'read_file': return 'Read File';
    case 'delete_file': return 'Delete File';
    case 'create_dir': return 'Create Directory';
    case 'search_files': return 'Search Files';
    case 'open_pr': return 'Open PR';
    default: return 'Action';
  }
}

function StatusIcon({ status }: { status: AgentAction['status'] }) {
  switch (status) {
    case 'pending':   return <Clock size={12} style={{ color: 'var(--text-muted)' }} aria-label="Pending" />;
    case 'approved':  return <Check size={12} style={{ color: 'var(--success)' }} aria-label="Approved" />;
    case 'rejected':  return <X size={12} style={{ color: 'var(--danger)' }} aria-label="Rejected" />;
    case 'executing': return <Loader2 size={12} style={{ color: 'var(--accent-400)' }} className="animate-spin" aria-label="Executing" />;
    case 'done':      return <Check size={12} style={{ color: 'var(--success)' }} aria-label="Done" />;
    case 'failed':    return <AlertCircle size={12} style={{ color: 'var(--danger)' }} aria-label="Failed" />;
    default:          return null;
  }
}

export function ActionCard({ action, index, onApprove, onReject, showControls = true }: ActionCardProps) {
  const Icon = getActionIcon(action.type);
  const label = getActionLabel(action.type);
  const isPending = action.status === 'pending';
  const isFailed = action.status === 'failed';
  const isDone = action.status === 'done';
  const isExecuting = action.status === 'executing';
  const isRejected = action.status === 'rejected';

  return (
    <div
      className="rounded-lg overflow-hidden my-2"
      style={{
        border: `1px solid ${
          isFailed ? 'rgba(255,77,109,0.3)'
          : isDone ? 'rgba(0,245,160,0.2)'
          : isRejected ? 'rgba(255,255,255,0.06)'
          : 'var(--border-default)'
        }`,
        background: isFailed ? 'rgba(255,77,109,0.04)' : isDone ? 'rgba(0,245,160,0.04)' : 'var(--bg-surface)',
        opacity: isRejected ? 0.5 : 1,
      }}
      role="article"
      aria-label={`Action: ${label}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs flex-shrink-0"
          style={{
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.2)',
            color: 'var(--violet-400)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}
        >
          <Icon size={10} aria-hidden="true" />
          {label}
        </div>

        {action.requiresConfirmation && (
          <span
            className="badge-warning text-xs"
            title="This action requires confirmation"
          >
            ⚠ Confirm
          </span>
        )}

        <div className="ml-auto">
          <StatusIcon status={action.status} />
        </div>
      </div>

      {/* Command / path */}
      <div className="px-3 pb-2">
        <div
          className="code-block text-xs"
          style={{ padding: '8px 12px', marginBottom: action.diff ? 0 : 0 }}
        >
          {action.type === 'run_command' && action.command
            ? `${action.command}${action.args?.length ? ' ' + action.args.join(' ') : ''}`
            : action.path ?? '—'
          }
        </div>
      </div>

      {/* Diff preview */}
      {action.type === 'edit_file' && action.diff && action.path && (
        <div className="px-3 pb-2">
          <DiffPreview path={action.path} diff={action.diff} />
        </div>
      )}

      {/* New file content preview */}
      {action.type === 'write_file' && action.content && (
        <div className="px-3 pb-2">
          <div className="code-block max-h-40 overflow-y-auto text-xs" style={{ padding: '8px 12px' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
              {action.content.slice(0, 500)}{action.content.length > 500 ? '\n… (truncated)' : ''}
            </pre>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="px-3 pb-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
          {action.explanation}
        </p>
      </div>

      {/* Result output */}
      {action.result?.output && (
        <div className="px-3 pb-2">
          <div className="code-block max-h-24 overflow-y-auto text-xs" style={{ padding: '6px 10px' }}>
            <pre style={{ margin: 0, color: isDone ? 'var(--success)' : 'var(--danger)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {action.result.output.slice(0, 300)}
            </pre>
          </div>
        </div>
      )}

      {action.result?.error && (
        <div className="px-3 pb-2">
          <p className="text-xs" style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
            ✗ {action.result.error}
          </p>
        </div>
      )}

      {/* Controls */}
      {showControls && isPending && (onApprove || onReject) && (
        <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          {onApprove && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80 min-h-[32px]"
              style={{ background: 'rgba(0,245,160,0.12)', border: '1px solid rgba(0,245,160,0.2)', color: 'var(--accent-400)', fontFamily: 'var(--font-body)' }}
              onClick={() => onApprove(index)}
              aria-label="Execute this action"
            >
              <Check size={11} aria-hidden="true" />
              Execute
            </button>
          )}
          {onReject && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80 min-h-[32px]"
              style={{ background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
              onClick={() => onReject(index)}
              aria-label="Skip this action"
            >
              <X size={11} aria-hidden="true" />
              Skip
            </button>
          )}
        </div>
      )}

      {/* Executing state */}
      {isExecuting && (
        <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <Loader2 size={11} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent-400)' }} aria-hidden="true" />
          <span className="text-xs" style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-body)' }}>Executing…</span>
        </div>
      )}
    </div>
  );
}
