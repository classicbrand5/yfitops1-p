// src/main.tsx
// Phase 2 fix: global error handlers registered before React mounts
// so unhandled exceptions and promise rejections are captured.
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Phase 2 fix: catch synchronous JS errors not handled by error boundaries
window.onerror = (message, source, line, col, error) => {
  console.error('[global error]', message, source, line, col, error);
};

// Phase 2 fix: catch unhandled promise rejections (e.g., failed fetch, async throws)
window.onunhandledrejection = (event) => {
  console.error('[unhandled rejection]', event.reason);
};

createRoot(document.getElementById('root')!).render(<App />);
