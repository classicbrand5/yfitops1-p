// src/components/layout/TopBar.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import {
  Bell,
  ChevronRight,
  Search,
  LogOut,
  Settings,
  CreditCard,
  Moon,
  Sun,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/supabase';
import { toast } from 'sonner';

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openCommandPalette, notifications, unreadNotificationCount, markNotificationRead, theme, toggleTheme, user } = useAppStore();
  const { mockSignOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  function getBreadcrumbs(): string[] {
    const parts = location.pathname.split('/').filter(Boolean);
    return ['YFitOps', ...parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1))];
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      mockSignOut();
    }
    navigate('/auth');
    toast.success('Signed out successfully');
  }

  function getInitials(name: string): string {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  const breadcrumbs = getBreadcrumbs();

  return (
    <header
      className="flex items-center gap-4 px-4 flex-shrink-0 border-b z-10 relative"
      style={{
        height: 56,
        background: 'rgba(6,6,9,0.85)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--border-subtle)',
      }}
      role="banner"
    >
      {/* Logo mark */}
      <div className="flex items-center gap-2 mr-2">
        <Zap size={16} style={{ color: 'var(--accent-400)' }} />
      </div>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 flex-1 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb}>
            {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
            <span
              className="text-sm truncate"
              style={{
                color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </nav>

      {/* Global search trigger */}
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all min-w-0"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-muted)',
          width: 220,
        }}
        onClick={openCommandPalette}
        aria-label="Open command palette (Ctrl+K)"
      >
        <Search size={13} />
        <span className="flex-1 text-left text-sm" style={{ fontSize: 13 }}>Search commands…</span>
        <kbd
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)', fontSize: 10, border: '1px solid var(--border-default)' }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Notifications */}
      <div className="relative">
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              aria-label={`Notifications${unreadNotificationCount > 0 ? ` — ${unreadNotificationCount} unread` : ''}`}
            >
              <Bell size={16} />
              {unreadNotificationCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: 'var(--danger)', color: 'white', fontSize: 9 }}
                  aria-hidden="true"
                >
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 p-0"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                Notifications
              </h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notifications</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 border-b cursor-pointer transition-all"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: n.read ? 'transparent' : 'rgba(0,245,160,0.03)',
                    }}
                    onClick={() => markNotificationRead(n.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && markNotificationRead(n.id)}
                    aria-label={`${n.title}: ${n.message}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <div className="mt-1.5 flex-shrink-0 status-dot-green" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                          {n.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Theme toggle */}
      <button
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
        style={{ color: 'var(--text-muted)', background: 'transparent' }}
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* User menu */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-secondary)', background: 'transparent' }}
              aria-label="User menu"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--violet-500)', color: 'white' }}
              >
                {getInitials(user.fullName)}
              </div>
              <span className="text-sm font-medium hidden md:block" style={{ color: 'var(--text-primary)' }}>
                {user.fullName.split(' ')[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
          >
            <div className="px-3 py-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                {user.fullName}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            </div>
            <DropdownMenuSeparator style={{ background: 'var(--border-subtle)' }} />
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="gap-2 cursor-pointer"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              <Settings size={14} /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/billing')}
              className="gap-2 cursor-pointer"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
            >
              <CreditCard size={14} /> Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'var(--border-subtle)' }} />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="gap-2 cursor-pointer"
              style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)' }}
            >
              <LogOut size={14} /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
