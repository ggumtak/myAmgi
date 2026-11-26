import type React from 'react';
import { useApp } from '../../context/AppContext';
import { SheetOrDialog } from '../../ui';
import { SyncCard } from './SyncCard';

export const SyncSheet: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { syncStatus, navigate } = useApp();

  const subtitle = syncStatus?.loggedIn
    ? syncStatus.user || 'AnkiWeb 연결됨'
    : 'AnkiWeb 계정을 연결하면 모든 기기가 자동으로 맞춰집니다';

  return (
    <SheetOrDialog
      open={open}
      onClose={onClose}
      title="동기화"
      subtitle={subtitle}
      footer={
        <button
          type="button"
          className="amgi-btn amgi-btn-ghost"
          onClick={() => {
            onClose();
            navigate('#/settings');
          }}
        >
          동기화 설정 보기
        </button>
      }
    >
      <SyncCard compact onSuccess={onClose} />
    </SheetOrDialog>
  );
};
