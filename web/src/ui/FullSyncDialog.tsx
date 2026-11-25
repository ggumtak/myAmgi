// The full-sync direction dialog: opened when the host answers `needsFullSync`
// (or from 설정 › 동기화 › 전체 동기화). Two clearly explained choices, each
// naming what gets overwritten. Mounted once in App.
import { closeFullSyncDialog, runSync, useSyncState } from '../lib/sync';
import { Button } from './Button';
import { Sheet } from './Sheet';
import './FullSyncDialog.css';

export function FullSyncDialog() {
  const { askFull } = useSyncState();
  const choose = (mode: 'upload' | 'download') => {
    closeFullSyncDialog();
    void runSync(mode);
  };
  return (
    <Sheet
      open={!!askFull}
      onClose={closeFullSyncDialog}
      title={askFull === 'required' ? '전체 동기화가 필요합니다' : '전체 동기화'}
      testId="full-sync-dialog"
      actions={
        <Button variant="text" onClick={closeFullSyncDialog}>
          취소
        </Button>
      }
    >
      <p className="full-sync__intro">
        {askFull === 'required'
          ? '이 기기와 AnkiWeb의 컬렉션을 합칠 수 없습니다. 어느 쪽 내용을 남길지 고르세요.'
          : '한쪽 컬렉션을 다른 쪽 내용으로 통째로 바꿉니다. 어느 쪽 내용을 남길지 고르세요.'}
      </p>
      <div className="full-sync__choices">
        <button type="button" className="full-sync__choice" data-testid="full-sync-upload" onClick={() => choose('upload')}>
          <span className="full-sync__choice-title">이 기기의 내용을 서버에 올리기</span>
          <span className="full-sync__choice-text">
            AnkiWeb에 있는 컬렉션을 이 기기의 내용으로 덮어씁니다. 다른 기기에서 아직 동기화하지 않은 변경 내용은 사라집니다.
          </span>
        </button>
        <button type="button" className="full-sync__choice" data-testid="full-sync-download" onClick={() => choose('download')}>
          <span className="full-sync__choice-title">서버의 내용을 이 기기로 내려받기</span>
          <span className="full-sync__choice-text">
            이 기기의 컬렉션을 AnkiWeb의 내용으로 덮어씁니다. 이 기기에서 아직 올리지 않은 변경 내용은 사라집니다. 내려받기 전에 자동으로 백업합니다.
          </span>
        </button>
      </div>
    </Sheet>
  );
}
