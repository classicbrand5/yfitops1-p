// src/pages/Settings.tsx
import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

type SettingsTab = 'profile' | 'agent' | 'editor' | 'terminal' | 'notifications' | 'security';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'agent', label: 'AI Agent' },
  { id: 'editor', label: 'Editor' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { user, agentAutonomy, setAgentAutonomy, expertMode, setExpertMode, agentContext, updateAgentContext } = useAppStore();

  function handleSave() {
    toast.success('Settings saved');
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-fade-up mb-8">
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Settings</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Manage your account, agent, and workspace preferences</p>
          </div>

          <div className="flex gap-6">
            {/* Tab sidebar */}
            <div className="flex-shrink-0 w-44">
              <nav role="navigation" aria-label="Settings sections">
                <ul className="space-y-0.5" role="list">
                  {TABS.map((tab) => (
                    <li key={tab.id} role="listitem">
                      <button
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all"
                        style={{
                          background: activeTab === tab.id ? 'var(--bg-overlay)' : 'transparent',
                          color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                          borderLeft: activeTab === tab.id ? '3px solid var(--accent-400)' : '3px solid transparent',
                          fontFamily: 'var(--font-body)',
                        }}
                        onClick={() => setActiveTab(tab.id)}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                      >
                        {tab.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 panel p-6 animate-fade-up delay-100">
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 14 }}>Profile</h2>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Full Name</label>
                    <input type="text" defaultValue={user?.fullName ?? ''} className="input-dark" aria-label="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Email</label>
                    <input type="email" defaultValue={user?.email ?? ''} className="input-dark" aria-label="Email" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>GitHub Username</label>
                    <input type="text" defaultValue={user?.githubUsername ?? ''} className="input-dark" placeholder="@username" aria-label="GitHub username" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Role</label>
                    <select className="input-dark" defaultValue={user?.role ?? 'developer'} aria-label="Role">
                      <option value="developer">Developer</option>
                      <option value="tech_lead">Tech Lead</option>
                      <option value="engineering_manager">Engineering Manager</option>
                    </select>
                  </div>
                  <button className="btn-accent" onClick={handleSave}>Save Changes</button>
                </div>
              )}

              {activeTab === 'agent' && (
                <div className="space-y-6">
                  <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 14 }}>AI Agent</h2>

                  {/* Autonomy */}
                  <div>
                    <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Agent Autonomy Level</label>
                    <div className="space-y-2" role="radiogroup" aria-label="Autonomy level">
                      {([
                        { value: 'ask', label: 'Ask First', desc: 'Confirms every action before executing — safest mode' },
                        { value: 'auto-safe', label: 'Auto (Safe)', desc: 'Executes safe actions automatically, confirms destructive ones' },
                        { value: 'full-auto', label: 'Full Auto', desc: 'Executes all actions without confirmation — use with care' },
                      ] as const).map((opt) => (
                        <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all" style={{ border: `1px solid ${agentAutonomy === opt.value ? 'var(--border-accent)' : 'var(--border-subtle)'}`, background: agentAutonomy === opt.value ? 'rgba(0,245,160,0.04)' : 'transparent' }} role="radio" aria-checked={agentAutonomy === opt.value}>
                          <input type="radio" name="autonomy" value={opt.value} checked={agentAutonomy === opt.value} onChange={() => setAgentAutonomy(opt.value)} className="mt-0.5 accent-[#00F5A0]" />
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{opt.label}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Expert mode */}
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Expert Mode</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Shows AI draft/critique steps and advanced context controls</p>
                    </div>
                    <button
                      className="w-10 h-6 rounded-full transition-all relative"
                      style={{ background: expertMode ? 'var(--accent-400)' : 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                      onClick={() => setExpertMode(!expertMode)}
                      role="switch"
                      aria-checked={expertMode}
                      aria-label="Toggle expert mode"
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: 'white', left: expertMode ? 'calc(100% - 22px)' : 2 }} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Context settings */}
                  <div>
                    <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Agent Context Inclusions</label>
                    <div className="space-y-2">
                      {([
                        { key: 'includeOpenFiles', label: 'Open files' },
                        { key: 'includeBuildStatus', label: 'Build status' },
                        { key: 'includeTerminalOutput', label: 'Terminal output' },
                        { key: 'includeGitHistory', label: 'Git history' },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={agentContext[key]} onChange={(e) => updateAgentContext({ [key]: e.target.checked })} className="accent-[#00F5A0]" aria-label={label} />
                          <span className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button className="btn-accent" onClick={handleSave}>Save Changes</button>
                </div>
              )}

              {activeTab === 'editor' && (
                <div className="space-y-5">
                  <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 14 }}>Editor Preferences</h2>
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Font Size: 14px</label>
                    <input type="range" min="10" max="20" defaultValue="14" className="w-full accent-[#00F5A0]" aria-label="Font size" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Tab Size</label>
                    <select className="input-dark" aria-label="Tab size">
                      <option value="2">2 spaces</option>
                      <option value="4">4 spaces</option>
                    </select>
                  </div>
                  {[['Word Wrap', true], ['Format on Save', true], ['Minimap', true]].map(([label, defaultVal]) => (
                    <div key={label as string} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{label as string}</span>
                      <input type="checkbox" defaultChecked={defaultVal as boolean} className="accent-[#00F5A0]" aria-label={label as string} />
                    </div>
                  ))}
                  <button className="btn-accent" onClick={handleSave}>Save Changes</button>
                </div>
              )}

              {(activeTab === 'terminal' || activeTab === 'notifications' || activeTab === 'security') && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-3xl mb-4" aria-hidden="true">⚙️</div>
                  <h3 className="font-display text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {TABS.find((t) => t.id === activeTab)?.label} Settings
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                    Connect your Supabase project to enable full settings management
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
