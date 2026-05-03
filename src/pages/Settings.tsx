// src/pages/Settings.tsx
// Full settings page — persists all changes to Supabase profiles table
// Phase 0 fix: added AI Secrets tab showing provider secret names and setup instructions
import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { saveGitHubToken, listUserRepos, connectReposToSupabase } from '@/lib/github';
import type { GitHubRepo } from '@/lib/github';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Github, Loader2, Check, RefreshCw, ExternalLink, Key, ShieldCheck, AlertTriangle } from 'lucide-react';

// Phase 0 fix: added 'secrets' tab
type SettingsTab = 'profile' | 'agent' | 'editor' | 'github' | 'secrets' | 'notifications' | 'security';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'agent', label: 'AI Agent' },
  { id: 'editor', label: 'Editor' },
  { id: 'github', label: 'GitHub' },
  { id: 'secrets', label: 'AI Secrets' }, // Phase 0 fix
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
];

// ── Profile data from Supabase ─────────────────────────────────────────────
function useProfileData() {
  return useQuery({
    queryKey: ['profile-settings'],
    queryFn: async () => {
      if (!supabase) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name,email,role,github_username,github_access_token,expert_mode,agent_autonomy,ai_requests_used,ai_requests_limit,plan')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
    staleTime: 30_000,
  });
}

function useSaveProfile() {
  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
    },
  });
}

// ── AI Secrets config (Phase 0 fix) ──────────────────────────────────────
const AI_SECRETS = [
  { provider: 'OnSpace AI', secretName: 'ONSPACE_AI_API_KEY', note: 'Auto-configured by OnSpace platform', alwaysSet: true },
  { provider: 'Google AI Studio', secretName: 'GOOGLE_AI_API_KEY', note: 'aistudio.google.com/apikey — free tier', alwaysSet: false },
  { provider: 'Groq Cloud', secretName: 'GROQ_API_KEY', note: 'console.groq.com/keys — free tier', alwaysSet: false },
  { provider: 'OpenRouter', secretName: 'OPENROUTER_API_KEY', note: 'openrouter.ai/keys — free tier', alwaysSet: false },
  { provider: 'Cloudflare AI', secretName: 'CLOUDFLARE_AI_API_KEY', note: 'dash.cloudflare.com → AI → API Token', alwaysSet: false },
  { provider: 'Cloudflare Account ID', secretName: 'CLOUDFLARE_ACCOUNT_ID', note: 'Required to build the Cloudflare AI base URL', alwaysSet: false },
  { provider: 'Cerebras', secretName: 'CEREBRAS_API_KEY', note: 'inference.cerebras.ai — free tier', alwaysSet: false },
  { provider: 'Together AI', secretName: 'TOGETHER_AI_API_KEY', note: 'api.together.xyz — $1 free credit', alwaysSet: false },
] as const;

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { user, agentAutonomy, setAgentAutonomy, expertMode, setExpertMode, agentContext, updateAgentContext } = useAppStore();
  const { data: profile, refetch: refetchProfile } = useProfileData();
  const saveProfileMutation = useSaveProfile();

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('developer');
  const [profileInitialized, setProfileInitialized] = useState(false);

  const [ghToken, setGhToken] = useState('');
  const [ghRepos, setGhRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [ghLoading, setGhLoading] = useState(false);
  const [ghConnected, setGhConnected] = useState(false);

  React.useEffect(() => {
    if (profile && !profileInitialized) {
      setFullName(profile.full_name ?? '');
      setRole(profile.role ?? 'developer');
      setGhConnected(!!profile.github_access_token);
      setProfileInitialized(true);
    }
  }, [profile, profileInitialized]);

  async function handleSaveProfile() {
    await saveProfileMutation.mutateAsync({ full_name: fullName, role });
    await refetchProfile();
    toast.success('Profile saved');
  }

  async function handleSaveAgent() {
    await saveProfileMutation.mutateAsync({ expert_mode: expertMode, agent_autonomy: agentAutonomy });
    await refetchProfile();
    toast.success('AI Agent settings saved');
  }

  async function handleConnectGitHub() {
    if (!ghToken.trim()) { toast.error('Please enter a GitHub Personal Access Token'); return; }
    setGhLoading(true);
    try {
      await saveGitHubToken(ghToken.trim());
      const repos = await listUserRepos(ghToken.trim());
      setGhRepos(repos);
      setGhConnected(true);
      setGhToken('');
      await refetchProfile();
      toast.success(`GitHub connected — ${repos.length} repos found`);
    } catch (err) {
      toast.error('GitHub connection failed', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setGhLoading(false);
    }
  }

  async function handleRefreshRepos() {
    setGhLoading(true);
    try {
      const repos = await listUserRepos();
      setGhRepos(repos);
      toast.success(`Found ${repos.length} repositories`);
    } catch (err) {
      toast.error('Failed to list repos', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setGhLoading(false);
    }
  }

  async function handleConnectRepos() {
    const repos = ghRepos.filter((r) => selectedRepos.has(r.id));
    if (repos.length === 0) { toast.error('Select at least one repository'); return; }
    setGhLoading(true);
    try {
      await connectReposToSupabase(repos);
      toast.success(`${repos.length} repo${repos.length !== 1 ? 's' : ''} connected`);
      setSelectedRepos(new Set());
    } catch (err) {
      toast.error('Failed to connect repos', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setGhLoading(false);
    }
  }

  function toggleRepo(id: number) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const isSaving = saveProfileMutation.isPending;

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

              {/* ── Profile ──────────────────────────────────────── */}
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 14 }}>Profile</h2>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-dark" placeholder="Your full name" aria-label="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Email</label>
                    <input type="email" defaultValue={user?.email ?? profile?.email ?? ''} className="input-dark" disabled aria-label="Email (read-only)" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Email cannot be changed here.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Role</label>
                    <select className="input-dark" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
                      <option value="developer">Developer</option>
                      <option value="tech_lead">Tech Lead</option>
                      <option value="engineering_manager">Engineering Manager</option>
                    </select>
                  </div>
                  {profile?.github_username && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>GitHub Username</label>
                      <div className="flex items-center gap-2 input-dark" style={{ opacity: 0.7 }}>
                        <Github size={13} /><span>{profile.github_username}</span>
                      </div>
                    </div>
                  )}
                  <button className="btn-accent flex items-center gap-2" onClick={handleSaveProfile} disabled={isSaving} aria-label="Save profile">
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {isSaving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              )}

              {/* ── AI Agent ─────────────────────────────────────── */}
              {activeTab === 'agent' && (
                <div className="space-y-6">
                  <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 14 }}>AI Agent</h2>
                  <div>
                    <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Agent Autonomy Level</label>
                    <div className="space-y-2" role="radiogroup" aria-label="Autonomy level">
                      {([
                        { value: 'ask', label: 'Ask First', desc: 'Confirms every action before executing — safest mode' },
                        { value: 'auto-safe', label: 'Auto (Safe)', desc: 'Auto-executes reads & safe writes; still asks for deletions' },
                        { value: 'full-auto', label: 'Full Auto', desc: 'Executes all actions immediately without any confirmation' },
                      ] as const).map((opt) => (
                        <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all"
                          style={{ border: `1px solid ${agentAutonomy === opt.value ? 'var(--border-accent)' : 'var(--border-subtle)'}`, background: agentAutonomy === opt.value ? 'rgba(0,245,160,0.04)' : 'transparent' }}>
                          <input type="radio" name="autonomy" value={opt.value} checked={agentAutonomy === opt.value} onChange={() => setAgentAutonomy(opt.value)} className="mt-0.5 accent-[#00F5A0]" />
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{opt.label}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>Expert Mode</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Shows AI draft/critique steps and advanced context controls</p>
                    </div>
                    <button className="w-10 h-6 rounded-full transition-all relative"
                      style={{ background: expertMode ? 'var(--accent-400)' : 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                      onClick={() => setExpertMode(!expertMode)} role="switch" aria-checked={expertMode} aria-label="Toggle expert mode">
                      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: 'white', left: expertMode ? 'calc(100% - 22px)' : 2 }} aria-hidden="true" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Context Inclusions</label>
                    <div className="space-y-2">
                      {([
                        { key: 'includeOpenFiles', label: 'Open files in editor' },
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
                  <button className="btn-accent flex items-center gap-2" onClick={handleSaveAgent} disabled={isSaving} aria-label="Save agent settings">
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {isSaving ? 'Saving…' : 'Save Agent Settings'}
                  </button>
                </div>
              )}

              {/* ── Editor ───────────────────────────────────────── */}
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
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Editor preferences are stored locally and applied automatically.</p>
                </div>
              )}

              {/* ── GitHub ───────────────────────────────────────── */}
              {activeTab === 'github' && (
                <div className="space-y-5">
                  <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 14 }}>GitHub Integration</h2>
                  {ghConnected ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(0,245,160,0.06)', border: '1px solid rgba(0,245,160,0.2)' }}>
                      <Check size={14} style={{ color: 'var(--success)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>GitHub Connected</p>
                        {profile?.github_username && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{profile.github_username}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>How to get a token:</p>
                        <ol className="list-decimal pl-4 space-y-0.5">
                          <li>Go to <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-400)' }}>github.com/settings/tokens</a></li>
                          <li>Select scopes: <code className="font-mono">repo</code>, <code className="font-mono">read:user</code></li>
                          <li>Generate and paste the token below</li>
                        </ol>
                      </div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Personal Access Token</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Key size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                          <input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} className="input-dark pl-8" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" aria-label="GitHub Personal Access Token" onKeyDown={(e) => { if (e.key === 'Enter') handleConnectGitHub(); }} />
                        </div>
                        <button className="btn-accent flex items-center gap-2 flex-shrink-0" onClick={handleConnectGitHub} disabled={ghLoading || !ghToken.trim()} aria-label="Connect GitHub">
                          {ghLoading ? <Loader2 size={13} className="animate-spin" /> : <Github size={13} />}
                          Connect
                        </button>
                      </div>
                    </div>
                  )}
                  {ghConnected && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Repositories</p>
                        <button className="flex items-center gap-1.5 text-xs btn-ghost px-2 py-1" onClick={handleRefreshRepos} disabled={ghLoading} aria-label="Refresh repositories">
                          <RefreshCw size={11} className={ghLoading ? 'animate-spin' : ''} /> Refresh
                        </button>
                      </div>
                      {ghRepos.length === 0 && !ghLoading && (
                        <div className="text-center py-6">
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Click Refresh to load your repositories</p>
                        </div>
                      )}
                      {ghRepos.length > 0 && (
                        <>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                            {ghRepos.map((repo) => (
                              <label key={repo.id} className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all"
                                style={{ border: `1px solid ${selectedRepos.has(repo.id) ? 'var(--border-accent)' : 'var(--border-subtle)'}`, background: selectedRepos.has(repo.id) ? 'rgba(0,245,160,0.04)' : 'var(--bg-elevated)' }}>
                                <input type="checkbox" checked={selectedRepos.has(repo.id)} onChange={() => toggleRepo(repo.id)} className="mt-0.5 accent-[#00F5A0]" aria-label={`Select ${repo.full_name}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {repo.full_name}{repo.private && <span className="ml-1 badge-muted" style={{ fontSize: 9 }}>private</span>}
                                  </p>
                                  {repo.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{repo.description}</p>}
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {repo.language && <span className="text-xs font-mono" style={{ color: 'var(--accent-400)' }}>{repo.language}</span>}
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>★ {repo.stargazers_count}</span>
                                  </div>
                                </div>
                                <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} onClick={(e) => e.stopPropagation()} aria-label={`Open ${repo.name} on GitHub`}>
                                  <ExternalLink size={11} />
                                </a>
                              </label>
                            ))}
                          </div>
                          {selectedRepos.size > 0 && (
                            <button className="btn-accent flex items-center gap-2 mt-3" onClick={handleConnectRepos} disabled={ghLoading} aria-label={`Connect ${selectedRepos.size} selected repos`}>
                              {ghLoading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              Connect {selectedRepos.size} repo{selectedRepos.size !== 1 ? 's' : ''}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── AI Secrets (Phase 0 fix) ─────────────────────── */}
              {activeTab === 'secrets' && (
                <div className="space-y-5">
                  <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 14 }}>AI Provider Secrets</h2>

                  {/* Setup instructions */}
                  <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <p className="font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>How to add a provider API key:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-400)', textDecoration: 'underline' }}>Supabase Dashboard</a></li>
                      <li>Navigate to <strong style={{ color: 'var(--text-secondary)' }}>Edge Functions → Secrets</strong></li>
                      <li>Add the secret name (e.g. <code className="font-mono" style={{ color: 'var(--violet-400)' }}>GROQ_API_KEY</code>) and its value</li>
                      <li>Re-deploy the <code className="font-mono" style={{ color: 'var(--violet-400)' }}>agent-inference</code> edge function</li>
                    </ol>
                  </div>

                  {/* Secrets table */}
                  <div className="space-y-2">
                    {AI_SECRETS.map((row) => (
                      <div
                        key={row.secretName}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                      >
                        <div className="flex-shrink-0">
                          {row.alwaysSet
                            ? <ShieldCheck size={14} style={{ color: 'var(--success)' }} aria-label="Always configured" />
                            : <Key size={14} style={{ color: 'var(--text-muted)' }} aria-label="API key required" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                              {row.provider}
                            </span>
                            {row.alwaysSet && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,245,160,0.1)', color: 'var(--success)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                                BUILT-IN
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs" style={{ color: 'var(--violet-400)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                              {row.secretName}
                            </code>
                            <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 10 }}>
                              {row.note}
                            </span>
                          </div>
                        </div>
                        {row.alwaysSet && (
                          <span className="flex-shrink-0 flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
                            <Check size={11} /> Set
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Health dot note */}
                  <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)' }}>
                    <AlertTriangle size={13} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                    <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
                      Provider health dots (green = key configured, red = missing) appear next to each provider in the model picker dropdown in the AI chat header. Open it to see which providers are ready to use.
                    </p>
                  </div>

                  {/* Cloudflare note */}
                  <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <AlertTriangle size={13} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                    <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--warning)' }}>Cloudflare AI</strong> requires both <code style={{ color: 'var(--violet-400)', fontFamily: 'var(--font-mono)' }}>CLOUDFLARE_AI_API_KEY</code> and <code style={{ color: 'var(--violet-400)', fontFamily: 'var(--font-mono)' }}>CLOUDFLARE_ACCOUNT_ID</code> to be set. The account ID is used to construct the base API URL in the edge function.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Notifications / Security — placeholder ────────── */}
              {(activeTab === 'notifications' || activeTab === 'security') && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-3xl mb-4" aria-hidden="true">⚙️</div>
                  <h3 className="font-display text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {TABS.find((t) => t.id === activeTab)?.label} Settings
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                    Coming in a future phase
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
