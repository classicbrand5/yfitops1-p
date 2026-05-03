// src/components/features/AgentChat/AgentModelPicker.tsx
// Dropdown for switching AI providers and models in the chat header.
// Each provider shows its tier badge, speed, and model name.

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Zap, Sparkles, Star } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

// ── Provider / Model Registry (mirrors edge function) ─────────
export interface ProviderOption {
  id: string;
  label: string;
  defaultModel: string;
  models: ModelOption[];
  badge: 'free' | 'credits' | 'onspace';
  speed: 'fast' | 'fastest' | 'standard';
  description: string;
  color: string;              // hex for badge/dot
}

export interface ModelOption {
  id: string;
  label: string;
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'onspace',
    label: 'OnSpace AI',
    defaultModel: 'google/gemini-2.5-flash-preview',
    models: [
      { id: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash' },
      { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
    ],
    badge: 'onspace',
    speed: 'fast',
    description: 'Built-in · No key needed · 1M context',
    color: '#00F5A0',
  },
  {
    id: 'google',
    label: 'Google AI Studio',
    defaultModel: 'gemini-2.5-flash-preview',
    models: [
      { id: 'gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    badge: 'free',
    speed: 'fast',
    description: 'Free · 1M context · 15 RPM · 1500 req/day',
    color: '#4285F4',
  },
  {
    id: 'groq',
    label: 'Groq Cloud',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)' },
    ],
    badge: 'free',
    speed: 'fastest',
    description: 'Free tier · 600+ tok/s · OpenAI-compat',
    color: '#F55036',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'deepseek/deepseek-r1:free',
    models: [
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free)' },
      { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (free)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
      { id: 'deepseek/deepseek-chat:free', label: 'DeepSeek V3 (free)' },
    ],
    badge: 'free',
    speed: 'standard',
    description: 'Free tier · 200+ models · Route to best',
    color: '#7C3AED',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare AI',
    defaultModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    models: [
      { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B FP8' },
      { id: '@cf/google/gemma-3-12b-it', label: 'Gemma 3 12B' },
      { id: '@cf/mistral/mistral-7b-instruct-v0.2', label: 'Mistral 7B' },
    ],
    badge: 'free',
    speed: 'fastest',
    description: 'Free · 10k neurons/day · Zero cold start',
    color: '#F38020',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    defaultModel: 'llama-3.3-70b',
    models: [
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
    ],
    badge: 'free',
    speed: 'fastest',
    description: 'Free tier · 2000+ tok/s · Best streaming',
    color: '#22D3EE',
  },
  {
    id: 'together',
    label: 'Together AI',
    defaultModel: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    models: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5-Coder 32B' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo' },
      { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' },
    ],
    badge: 'credits',
    speed: 'fast',
    description: '$1 free credit · Best for code tasks',
    color: '#FBBF24',
  },
];

// ── Speed Icon ─────────────────────────────────────────────────
function SpeedIcon({ speed }: { speed: ProviderOption['speed'] }) {
  if (speed === 'fastest') return <Zap size={9} aria-label="Fastest inference" />;
  if (speed === 'fast') return <Sparkles size={9} aria-label="Fast inference" />;
  return <Star size={9} aria-label="Standard inference" />;
}

// ── Badge ──────────────────────────────────────────────────────
function ProviderBadge({ badge }: { badge: ProviderOption['badge'] }) {
  const styles: Record<ProviderOption['badge'], { bg: string; color: string; label: string }> = {
    free: { bg: 'rgba(0,245,160,0.10)', color: '#00F5A0', label: 'FREE' },
    credits: { bg: 'rgba(251,191,36,0.12)', color: '#FBBF24', label: '$1' },
    onspace: { bg: 'rgba(155,110,245,0.12)', color: '#9B6EF5', label: 'BUILT-IN' },
  };
  const s = styles[badge];
  return (
    <span
      className="text-xs font-semibold px-1.5 py-0.5 rounded"
      style={{ background: s.bg, color: s.color, fontSize: 9, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}
    >
      {s.label}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────
export function AgentModelPicker() {
  const { selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentProvider = PROVIDER_OPTIONS.find((p) => p.id === selectedProvider) ?? PROVIDER_OPTIONS[0];
  const currentModelLabel =
    currentProvider.models.find((m) => m.id === selectedModel)?.label ??
    currentProvider.models[0].label;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  function selectProvider(provider: ProviderOption) {
    setSelectedProvider(provider.id);
    setSelectedModel(provider.defaultModel);
    setOpen(false);
    setExpandedProvider(null);
  }

  function selectModel(providerId: string, modelId: string) {
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
    setOpen(false);
    setExpandedProvider(null);
  }

  return (
    <div ref={dropdownRef} className="relative" style={{ zIndex: 50 }}>
      {/* Trigger pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all hover:opacity-90"
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${open ? 'var(--border-accent)' : 'var(--border-default)'}`,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          cursor: 'pointer',
          minHeight: 28,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current model: ${currentProvider.label} / ${currentModelLabel}. Click to switch.`}
      >
        {/* Provider color dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: currentProvider.color }}
          aria-hidden="true"
        />
        <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentModelLabel}
        </span>
        <ChevronDown
          size={10}
          aria-hidden="true"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 150ms',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 animate-fade-up"
          style={{
            width: 300,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
          role="listbox"
          aria-label="Select AI provider and model"
        >
          {/* Header */}
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10 }}>
              AI Provider
            </p>
          </div>

          {/* Provider list */}
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {PROVIDER_OPTIONS.map((provider) => {
              const isActive = provider.id === selectedProvider;
              const isExpanded = expandedProvider === provider.id;

              return (
                <div key={provider.id}>
                  {/* Provider row */}
                  <div
                    className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all"
                    style={{
                      background: isActive ? 'rgba(0,245,160,0.05)' : 'transparent',
                      borderLeft: isActive ? `2px solid ${provider.color}` : '2px solid transparent',
                    }}
                    onClick={() => {
                      if (provider.models.length > 1) {
                        setExpandedProvider(isExpanded ? null : provider.id);
                      } else {
                        selectProvider(provider);
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && selectProvider(provider)}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                  >
                    {/* Color dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: provider.color }}
                      aria-hidden="true"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                          {provider.label}
                        </span>
                        <ProviderBadge badge={provider.badge} />
                        <span style={{ color: provider.color, marginLeft: 'auto' }}>
                          <SpeedIcon speed={provider.speed} />
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 10, marginTop: 1 }}>
                        {provider.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isActive && <Check size={11} style={{ color: provider.color }} aria-hidden="true" />}
                      {provider.models.length > 1 && (
                        <ChevronDown
                          size={10}
                          style={{
                            color: 'var(--text-muted)',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 150ms',
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>

                  {/* Model sub-list */}
                  {isExpanded && provider.models.length > 1 && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-subtle)' }}>
                      {provider.models.map((m) => {
                        const isModelActive = isActive && selectedModel === m.id;
                        return (
                          <button
                            key={m.id}
                            className="flex items-center gap-2 w-full text-left px-7 py-2 transition-all hover:opacity-80"
                            style={{
                              background: isModelActive ? `rgba(${provider.color === '#00F5A0' ? '0,245,160' : '155,110,245'},0.08)` : 'transparent',
                              color: isModelActive ? provider.color : 'var(--text-secondary)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => { e.stopPropagation(); selectModel(provider.id, m.id); }}
                            aria-label={`Use ${provider.label} with ${m.label}`}
                          >
                            {isModelActive && <Check size={10} aria-hidden="true" />}
                            <span className={isModelActive ? '' : 'ml-[14px]'}>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div
            className="px-3 py-2 border-t"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-void)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 10 }}>
              API keys configured in Supabase → Settings → Secrets
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
