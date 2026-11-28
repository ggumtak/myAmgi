import type React from 'react';
import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { IconDownload, IconUpload, SheetOrDialog } from '../../ui';
import { pushOverlay } from '../../ui/overlayStack';
import { formatSyncTime } from './SyncCard';
import './sync.css';

type FullSyncChoice = 'download' | 'upload';

export const FullSyncDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { syncStatus, startBackgroundSync } = useApp();
  const [pendingMode, setPendingMode] = useState<FullSyncChoice | null>(null);

  useEffect(() => {
    if (!open) {
      setPendingMode(null);
    }
  }, [open]);

  // Allow Android hardware back / Escape in step 2 to step back to the direction chooser first.
  useEffect(() => {
    if (!open || pendingMode === null) return;
    return pushOverlay({
      close: () => setPendingMode(null),
    });
  }, [open, pendingMode]);

  const handleConfirm = () => {
    if (!pendingMode) return;
    const mode = pendingMode;
    setPendingMode(null);
    onClose();
    startBackgroundSync(mode);
  };

  const handleClose = () => {
    setPendingMode(null);
    onClose();
  };

  const lastSyncLabel = formatSyncTime(syncStatus?.lastSync);

  return (
    <SheetOrDialog
      open={open}
      onClose={handleClose}
      title={
        pendingMode === 'download'
          ? '이 기기를 서버 내용으로 덮어쓸까요?'
          : pendingMode === 'upload'
            ? '서버를 이 기기 내용으로 덮어쓸까요?'
            : '전체 동기화 방향 선택'
      }
      subtitle={
        syncStatus?.user
          ? `${syncStatus.user} · 마지막 동기화: ${lastSyncLabel}`
          : `마지막 동기화: ${lastSyncLabel}`
      }
      footer={
        pendingMode ? (
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setPendingMode(null)}
            >
              이전으로
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={handleConfirm}
            >
              {pendingMode === 'download'
                ? '이 기기를 서버 내용으로 교체'
                : '서버를 이 기기 내용으로 교체'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary"
            onClick={handleClose}
          >
            취소
          </button>
        )
      }
    >
      {pendingMode === null ? (
        <div className="amgi-fullsync-body">
          <p className="amgi-prose" style={{ margin: 0, fontSize: 14 }}>
            이 기기와 AnkiWeb 서버의 기록을 자동으로 합칠 수 없어{' '}
            <strong>전체 동기화(한쪽 기록으로 통일)</strong>가 필요합니다.
            반대쪽의 변경 사항은 사라지므로 최신 기록이 있는 쪽을 선택해 주세요.
          </p>

          <div className="amgi-fullsync-options">
            <button
              type="button"
              className="amgi-fullsync-option"
              onClick={() => setPendingMode('download')}
            >
              <span className="amgi-fullsync-option-icon" aria-hidden="true">
                <IconDownload size={18} />
              </span>
              <span className="amgi-fullsync-option-text">
                <span className="amgi-fullsync-option-title">
                  <span>AnkiWeb 서버에서 가져오기</span>
                </span>
                <span className="amgi-fullsync-option-desc">
                  다른 기기(PC·태블릿 등)에서 정리한 기록이 최신일 때 선택합니다. 이 기기의
                  현재 상태는 자동 백업된 뒤 서버 내용으로 교체됩니다.
                </span>
              </span>
            </button>

            <button
              type="button"
              className="amgi-fullsync-option"
              onClick={() => setPendingMode('upload')}
            >
              <span className="amgi-fullsync-option-icon" aria-hidden="true">
                <IconUpload size={18} />
              </span>
              <span className="amgi-fullsync-option-text">
                <span className="amgi-fullsync-option-title">
                  <span>이 기기 내용을 서버로 보내기</span>
                </span>
                <span className="amgi-fullsync-option-desc">
                  이 기기에서 백업을 복원했거나 카드 구성을 바꾼 뒤 서버에 반영할 때 선택합니다.
                  서버의 기존 기록이 이 기기 내용으로 교체됩니다.
                </span>
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="amgi-fullsync-body">
          <div className="amgi-fullsync-warn-box" role="alert">
            <div className="amgi-fullsync-warn-title">
              {pendingMode === 'download'
                ? '이 기기의 최근 변경 사항이 사라집니다'
                : 'AnkiWeb 서버의 기존 기록이 사라집니다'}
            </div>
            <p className="amgi-prose" style={{ margin: 0, fontSize: 14 }}>
              {pendingMode === 'download'
                ? '마지막 동기화 이후 이 기기에서만 수정·복습한 내용은 모두 AnkiWeb 서버의 내용으로 덮어씌워집니다. 진행 전 이 기기 상태는 안전 백업으로 저장됩니다.'
                : 'AnkiWeb 서버에 저장된 모든 덱과 학습 기록이 지금 이 기기의 내용으로 완전히 덮어씌워집니다. 다른 기기에만 있던 변경 사항은 되돌릴 수 없습니다.'}
            </p>
          </div>
          <p className="amgi-fullsync-meta-note">
            선택하면 백그라운드에서 진행되므로 다른 화면이나 앱을 자유롭게 쓰실 수 있습니다.
          </p>
        </div>
      )}
    </SheetOrDialog>
  );
};
