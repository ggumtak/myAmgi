import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.css';
import App from './App';
import { AppErrorBoundary, installGlobalErrorHandlers } from './ErrorBoundary';

const rootEl = document.getElementById('root')!;
installGlobalErrorHandlers(rootEl);

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary title="앱 화면을 불러오지 못했습니다" reloadOnRetry>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
