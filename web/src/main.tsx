import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './shell/Shell.css';
import { App } from './App';
import { applyTheme, systemPrefersDark } from './lib/theme';

// Avoid a white flash before prefs arrive from the host.
applyTheme(systemPrefersDark() ? 'dark' : 'light');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
