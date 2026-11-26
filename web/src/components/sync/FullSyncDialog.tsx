import type React from 'react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { host, HostApiError } from '../../host';
import { IconDownload, IconUpload, SheetOrDialog, useToast } from '../../ui';
import './sync.css';

export const FullSyncDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { refreshSyncStatus, bumpCollection } = useApp();
  const { showToast } = useToast();
  const [busyMode, setBusyMode] = useState<'download' | 'upload' | null>(null);

  const handleChoose = async (mode: 'download' | 'upload') => {
    if (busyMode) return;
    setBusyMode(mode);
    try {
      await host.syncRun(mode);
      await refreshSyncStatus();
      bumpCollection();
      showToast(
        mode === 'download'
          ? 'AnkiWeb 서버에서 카드와 기록을 가져왔습니다.'
          : '이 기기의 카드와 기록을 서버로 보냈습니다.',
        'success'
      );
      onClose();
    } catch (err) {
      await refreshSyncStatus().catch(() => undefined);
      if (err instanceof HostApiError && err.status === 409) {
        showToast('동기화를 중단했습니다.', 'info');
      } else {
        showToast(
          err instanceof Error ? err.message : '동기화를 끝내지 못했습니다.',
          'error'
        );
      }
    } finally {
      setBusyMode(null);
    }
  };

  return (
    <SheetOrDialog
      open={open}
      onClose={() => {
        if (!busyMode) onClose();
      }}
      title="어느 쪽 기록을 남길까요?"
      footer={
        <button
          type="button"
          className="amgi-btn amgi-btn-secondary"
          disabled={busyMode !== null}
          onClick={onClose}
        >
          취소
        </button>
      }
    >
      <div className="amgi-fullsync-body">
        <p className="amgi-prose" style={{ margin: 0, fontSize: 14 }}>
          이 기기와 AnkiWeb 서버의 카드 구성이 달라서 한쪽을 기준으로 통일해야 합니다.
          서버에서 내려받을 때는 현재 기기 데이터를 자동으로 백업한 뒤 진행합니다.
        </p>

        <div className="amgi-fullsync-options">
          <button
            type="button"
            className="amgi-fullsync-option"
            disabled={busyMode !== null}
            onClick={() => void handleChoose('download')}
          >
            <span className="amgi-fullsync-option-icon" aria-hidden="true">
              <IconDownload size={18} />
            </span>
            <span className="amgi-fullsync-option-text">
              <span className="amgi-fullsync-option-title">
                <span>AnkiWeb 서버에서 가져오기</span>
                <span className="amgi-fullsync-badge">새 기기 권장</span>
              </span>
              <span className="amgi-fullsync-option-desc">
                {busyMode === 'download'
                  ? '안전 백업 후 서버에서 가져오는 중...'
                  : '다른 기기에서 정리한 최신 카드와 기록으로 이 기기를 덮어씁니다. (진행 전 자동 백업)'}
              </span>
            </span>
          </button>

          <button
            type="button"
            className="amgi-fullsync-option"
            disabled={busyMode !== null}
            onClick={() => void handleChoose('upload')}
          >
            <span className="amgi-fullsync-option-icon" aria-hidden="true">
              <IconUpload size={18} />
            </span>
            <span className="amgi-fullsync-option-text">
              <span className="amgi-fullsync-option-title">
                <span>이 기기 내용을 서버로 보내기</span>
              </span>
              <span className="amgi-fullsync-option-desc">
                {busyMode === 'upload'
                  ? '서버로 올리는 중...'
                  : '지금 이 기기에 있는 카드와 기록으로 서버를 덮어씁니다.'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </SheetOrDialog>
  );
};
