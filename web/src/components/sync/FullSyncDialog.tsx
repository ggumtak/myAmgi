import type React from 'react';
import { useApp } from '../../context/AppContext';
import { IconDownload, IconUpload, SheetOrDialog } from '../../ui';
import './sync.css';

export const FullSyncDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { startBackgroundSync } = useApp();

  const handleChoose = (mode: 'download' | 'upload') => {
    onClose();
    startBackgroundSync(mode);
  };

  return (
    <SheetOrDialog
      open={open}
      onClose={onClose}
      title="어느 쪽 기록을 남길까요?"
      footer={
        <button
          type="button"
          className="amgi-btn amgi-btn-secondary"
          onClick={onClose}
        >
          취소
        </button>
      }
    >
      <div className="amgi-fullsync-body">
        <p className="amgi-prose" style={{ margin: 0, fontSize: 14 }}>
          이 기기와 AnkiWeb 서버의 카드 구성이 달라서 한쪽을 기준으로 통일해야 합니다.
          선택하면 백그라운드에서 진행되므로 다른 화면이나 앱을 자유롭게 쓰실 수 있어요.
        </p>

        <div className="amgi-fullsync-options">
          <button
            type="button"
            className="amgi-fullsync-option"
            onClick={() => handleChoose('download')}
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
                다른 기기에서 정리한 최신 카드·덱 옵션·Anki 설정을 그대로 가져옵니다. (진행 전 자동 백업)
              </span>
            </span>
          </button>

          <button
            type="button"
            className="amgi-fullsync-option"
            onClick={() => handleChoose('upload')}
          >
            <span className="amgi-fullsync-option-icon" aria-hidden="true">
              <IconUpload size={18} />
            </span>
            <span className="amgi-fullsync-option-text">
              <span className="amgi-fullsync-option-title">
                <span>이 기기 내용을 서버로 보내기</span>
              </span>
              <span className="amgi-fullsync-option-desc">
                지금 이 기기에 있는 카드와 기록으로 서버를 덮어씁니다.
              </span>
            </span>
          </button>
        </div>
      </div>
    </SheetOrDialog>
  );
};
