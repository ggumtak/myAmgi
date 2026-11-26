import { useState } from 'react';
import { IconCheck, IconCopy, IconRefresh, IconShield } from './Icons';

export interface ErrorStateProps {
  title?: string;
  message: string;
  errorLog?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = '문제가 발생했습니다',
  message,
  errorLog,
  onRetry,
  retryLabel = '다시 시도',
}: ErrorStateProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const payload = errorLog ? `${title}\n${message}\n\n${errorLog}` : `${title}\n${message}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard environments
      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="amgi-error-card" role="alert">
      <div className="amgi-error-head">
        <IconShield size={20} />
        <span>{title}</span>
      </div>
      <p className="amgi-error-msg">{message}</p>
      {errorLog && <pre className="amgi-error-detail">{errorLog}</pre>}
      <div className="amgi-error-actions">
        {onRetry && (
          <button
            type="button"
            className="amgi-btn amgi-btn-primary amgi-btn-sm"
            onClick={onRetry}
          >
            <IconRefresh size={16} />
            <span>{retryLabel}</span>
          </button>
        )}
        <button
          type="button"
          className="amgi-btn amgi-btn-secondary amgi-btn-sm"
          onClick={() => void handleCopy()}
        >
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          <span>{copied ? '복사됨' : '오류 로그 복사'}</span>
        </button>
      </div>
    </div>
  );
}
