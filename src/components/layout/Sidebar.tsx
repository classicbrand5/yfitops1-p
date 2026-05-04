// src/components/layout/Sidebar.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import {
  LayoutDashboard,
  Bot,
  FolderOpen,
  Terminal,
  BarChart3,
  GitBranch,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
  isAccent?: boolean;
}

const topItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Bot, label: 'AI Agent', href: '/workspace', isAccent: true },
  { icon: FolderOpen, label: 'Explorer', href: '/workspace' },
  { icon: Terminal, label: 'Terminal', href: '/workspace' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: GitBranch, label: 'Build Monitor', href: '/builds' },
];

const bottomItems: NavItem[] = [
  { icon: CreditCard, label: 'Billing', href: '/billing' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed, user } = useAppStore();

  const width = sidebarCollapsed ? 56 : 220;

  function isActive(href: string): boolean {
    return location.pathname === href;
  }

  function getInitials(name: string): string {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 border-r relative z-10 transition-all duration-200"
      style={{
        width,
        background: 'var(--bg-void)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-3 py-4 border-b cursor-pointer"
        style={{ borderColor: 'var(--border-subtle)', height: 56 }}
        onClick={() => navigate('/dashboard')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard')}
        aria-label="Go to dashboard"
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-accent)' }}
        >
          <Zap size={16} style={{ color: 'var(--accent-400)' }} />
        </div>
        {!sidebarCollapsed && (
          <span
            className="font-display text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.02em' }}
          >
            YFitOps
          </span>
        )}
      </div>

      {/* Top nav items */}
      <nav className="flex-1 py-3 overflow-y-auto" aria-label="Primary navigation">
        <ul className="space-y-0.5 px-2" role="list">
          {topItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            const button = (
              <li key={item.label} role="listitem">
                <button
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group min-h-[44px] ${
                    active ? 'sidebar-item-active' : ''
                  }`}
                  style={{
                    color: active ? 'var(--accent-400)' : item.isAccent ? 'var(--accent-400)' : 'var(--text-muted)',
                    background: active ? 'rgba(0,245,160,0.06)' : 'transparent',
                    borderLeft: active ? '3px solid var(--accent-400)' : '3px solid transparent',
                  }}
                  onClick={() => navigate(item.href)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    size={18}
                    className="flex-shrink-0 transition-colors"
                    style={{
                      color: active ? 'var(--accent-400)' : item.isAccent ? 'var(--accent-500)' : 'var(--text-muted)',
                    }}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {item.badge && !sidebarCollapsed && (
                    <span className="ml-auto badge-accent">{item.badge}</span>
                  )}
                </button>
              </li>
            );

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="glass">
                    <p style={{ color: 'var(--text-primary)', fontSize: 13 }}>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return button;
          })}
        </ul>
      </nav>

      {/* Bottom items */}
      <div className="py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <ul className="space-y-0.5 px-2 mb-2" role="list">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            const button = (
              <li key={item.label} role="listitem">
                <button
                  className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 min-h-[44px]"
                  style={{
                    color: active ? 'var(--accent-400)' : 'var(--text-muted)',
                    background: active ? 'rgba(0,245,160,0.06)' : 'transparent',
                  }}
                  onClick={() => navigate(item.href)}
                  aria-label={item.label}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              </li>
            );

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="glass">
                    <p style={{ color: 'var(--text-primary)', fontSize: 13 }}>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return button;
          })}
        </ul>

        {/* User avatar */}
        {user && (
          <div className="px-2">
            <div
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer min-h-[44px]"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => navigate('/settings')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/settings')}
              aria-label="User settings"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                style={{ background: 'var(--violet-500)', color: 'white' }}
              >
                {getInitials(user.fullName)}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {user.fullName}
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {user.plan.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="px-2 mt-2">
          <button
            className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all min-h-[36px]"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : (
              <>
                <ChevronLeft size={14} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
