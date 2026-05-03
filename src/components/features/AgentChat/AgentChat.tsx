// src/components/features/AgentChat/AgentChat.tsx
import React, { useEffect, useRef } from 'react';
import { useAIAgent } from '@/hooks/useAIAgent';
import { AgentMessage } from './AgentMessage';
import { AgentThinking } from './AgentThinking';
import { PromptBar } from './PromptBar';
import { useAppStore } from '@/store/useAppStore';
import { useConversationSync } from '@/hooks/useConversationSync';
import { Plus, MessageSquare, Trash2, LogIn } from 'lucide-react';
import { AgentModelPicker } from './AgentModelPicker';

export function AgentChat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    conversations,
    activeConversationId,
    activeMessages,
    isThinking,
    isAuthenticated,
    createConversation,
    sendMessage,
    clearChat,
    setActiveConversation,
  } = useAIAgent();

  // Sync conversations to Supabase
  const { syncToSupabase } = useConversationSync();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Sync to Supabase after each message
    if (activeConversationId) {
      syncToSupabase(activeConversationId);
    }
  }, [activeMessages, isThinking, activeConversationId]);

  // Create initial conversation if none
  useEffect(() => {
    if (conversations.length === 0) {
      createConversation('New conversation');
    }
  }, []);

  function handleSend(content: string) {
    sendMessage(content);
  }

  function handleNewConversation() {
    createConversation('New conversation');
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)' }}
      role="region"
      aria-label="AI Agent Chat"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-void)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs animate-pulse-glow"
            style={{ background: 'rgba(0,245,160,0.12)', border: '1px solid rgba(0,245,160,0.25)', color: 'var(--accent-400)', fontFamily: 'var(--font-display)', fontSize: 8 }}
            aria-hidden="true"
          >
            AI
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '0.04em', fontSize: 12 }}>
            YFitOps Agent
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Model switcher */}
          <AgentModelPicker />
          {activeConversationId && (
            <button
              className="flex items-center justify-center w-7 h-7 rounded transition-all hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => clearChat(activeConversationId)}
              aria-label="Clear chat"
              title="Clear chat"
            >
              <Trash2 size={12} />
            </button>
          )}
          {activeConversationId && (
            <button
              className="flex items-center justify-center w-7 h-7 rounded transition-all hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              onClick={handleNewConversation}
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus size={12} />
            </button>
          )}
          {!activeConversationId && (
            <button
              className="flex items-center justify-center w-7 h-7 rounded transition-all hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              onClick={handleNewConversation}
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Auth banner — shown when user is not signed in */}
      {!isAuthenticated && (
        <div
          className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
          style={{
            background: 'rgba(255,77,109,0.06)',
            borderColor: 'rgba(255,77,109,0.2)',
          }}
          role="alert"
        >
          <LogIn size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)' }}>
              Sign in required
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              The AI agent requires authentication.
            </p>
          </div>
          <a
            href="/auth"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
            style={{
              background: 'rgba(255,77,109,0.12)',
              border: '1px solid rgba(255,77,109,0.25)',
              color: 'var(--danger)',
              fontFamily: 'var(--font-body)',
              textDecoration: 'none',
            }}
          >
            Sign in
          </a>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {activeMessages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4 animate-pulse-glow"
              style={{ background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)' }}
              aria-hidden="true"
            >
              <MessageSquare size={20} style={{ color: 'var(--accent-400)' }} />
            </div>
            <h3 className="font-display text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              YFitOps AI Agent
            </h3>
            <p className="text-xs leading-relaxed max-w-[200px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              Describe a task — I can write code, run commands, fix bugs, and open PRs.
            </p>
            <div className="mt-4 space-y-1.5 w-full max-w-[220px]">
              {[
                'Create a JWT auth middleware',
                'Fix the N+1 query in users API',
                'Deploy to staging and run tests',
              ].map((example) => (
                <button
                  key={example}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all glass-hover"
                  style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                  onClick={() => handleSend(example)}
                  aria-label={`Try: ${example}`}
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}

        {activeMessages.map((msg) => (
          <AgentMessage key={msg.id} message={msg} />
        ))}

        {isThinking && <AgentThinking />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <PromptBar onSend={handleSend} isThinking={isThinking} isAuthenticated={isAuthenticated} />
    </div>
  );
}
