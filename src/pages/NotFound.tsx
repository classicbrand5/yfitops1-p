import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
      <div className="text-center animate-fade-up">
        <div className="font-display text-8xl font-bold mb-4 glow-text" style={{ color: 'var(--accent-400)' }}>404</div>
        <h1 className="font-display text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          Page not found
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
          The route <code style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-mono)' }}>{location.pathname}</code> does not exist.
        </p>
        <button className="btn-accent" onClick={() => navigate('/')}>
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
