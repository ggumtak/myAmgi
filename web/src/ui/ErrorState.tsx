import { useState } from 'react';
import { buildErrorReport, copyText } from '../clipboard';
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
  const [copyState, setCopyState] = useState<'idle' | 'busy' | 'copied' | 'failed'>('idle');

  const handleCopy = async () => {
    if (copyState === 'busy') return;
    setCopyState('busy');
    try {
      const payload = await buildErrorReport({ title, message, errorLog });
      await copyText(payload);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
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
          disabled={copyState === 'busy'}
          onClick={() => void handleCopy()}
        >
          {copyState === 'copied' ? <IconCheck size={16} /> : <IconCopy size={16} />}
          <span>
            {copyState === 'copied'
              ? '복사됨'
              : copyState === 'failed'
                ? '복사하지 못했습니다'
                : copyState === 'busy'
                  ? '복사 중...'
                  : '오류 로그 복사'}
          </span>
        </button>
      </div>
    </div>
  );
}
