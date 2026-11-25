// Empty and error states. Errors always show a Korean message and "오류 로그 복사".
import { useState, type ReactNode } from 'react';
import { copyErrorLog, describeError } from '../lib/errors';
import { Button } from './Button';
import { IconAlert, IconCopy, IconInbox } from './icons';
import { toast } from './Toast';
import './States.css';

export function EmptyState({ title, message, actions, icon }: { title: string; message?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="state" data-testid="empty-state">
      <div className="state__icon">{icon ?? <IconInbox size={40} />}</div>
      <h2 className="state__title">{title}</h2>
      {message && <p className="state__message">{message}</p>}
      {actions && <div className="state__actions">{actions}</div>}
    </div>
  );
}

export function CopyLogButton({ error, variant = 'secondary' }: { error?: unknown; variant?: 'secondary' | 'text' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      icon={<IconCopy size={20} />}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await copyErrorLog(error);
          toast('오류 로그를 복사했습니다');
        } catch {
          toast('복사하지 못했습니다', { kind: 'error' });
        } finally {
          setBusy(false);
        }
      }}
    >
      오류 로그 복사
    </Button>
  );
}

export function ErrorState({ error, title = '문제가 생겼습니다', onRetry }: { error: unknown; title?: string; onRetry?: () => void }) {
  const d = describeError(error);
  return (
    <div className="state state--error" role="alert" data-testid="error-state">
      <div className="state__icon">
        <IconAlert size={40} />
      </div>
      <h2 className="state__title">{title}</h2>
      <p className="state__message">{d.message}</p>
      <div className="state__actions">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            다시 시도
          </Button>
        )}
        <CopyLogButton error={error} />
      </div>
    </div>
  );
}
