// src/App.tsx — Route definitions + auth guard
import React, { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import NotFound from './pages/NotFound';
import { WorkspaceErrorBoundary } from '@/components/layout/WorkspaceErrorBoundary';

// Lazy-loaded pages for code splitting
const Landing    = lazy(() => import('./pages/Landing'));
const Auth       = lazy(() => import('./pages/Auth'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Analytics  = lazy(() => import('./pages/Analytics'));
const BuildMonitor = lazy(() => import('./pages/BuildMonitor'));
const Settings   = lazy(() => import('./pages/Settings'));
const Billing    = lazy(() => import('./pages/Billing'));
// Phase 1: GitHub App OAuth callback
const GitHubCallback = lazy(() => import('./pages/GitHubCallback'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Enforce consistent stale times per data type via per-query config
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
      <div className="text-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
          style={{ borderColor: 'var(--accent-400)' }}
          aria-hidden="true"
        />
        <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Loading…</p>
      </div>
    </div>
  );
}

/** Redirect unauthenticated users to /auth */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading } = useAppStore();
  const location = useLocation();

  // Boot the auth hook globally (runs once, registers listener)
  useAuth();

  if (isAuthLoading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Redirect authenticated users away from /auth */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading } = useAppStore();
  useAuth();
  if (isAuthLoading) return <PageLoader />;
  if (user) return <Navigate to="/workspace" replace />;
  return <>{children}</>;
}

/** Boot auth subscription once at the top level */
function AuthBootstrap() {
  useAuth();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
          },
        }}
      />
      <BrowserRouter>
        <AuthBootstrap />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route
              path="/auth"
              element={
                <PublicRoute>
                  <Auth />
                </PublicRoute>
              }
            />

            {/* Protected */}
            <Route
              path="/workspace"
              element={
                <ProtectedRoute>
                  <WorkspaceErrorBoundary>
                    <WorkspacePage />
                  </WorkspaceErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/builds"
              element={
                <ProtectedRoute>
                  <BuildMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <Billing />
                </ProtectedRoute>
              }
            />

            {/* Phase 1: GitHub App OAuth callback — semi-public (needs auth internally) */}
            <Route path="/auth/github/callback" element={<GitHubCallback />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
