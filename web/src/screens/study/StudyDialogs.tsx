// Reviewer dialogs: set due date, forget, script errors, timebox.
import { useEffect, useState } from 'react';
import { copyText } from '../../lib/errors';
import { Button } from '../../ui/Button';
import { PromptDialog } from '../../ui/Dialogs';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import type { ReviewerView } from './reviewer';
import { ConfigBool, ConfigString, getConfigBool, getConfigString } from './studyApi';
import { parseDueDate } from './studyLogic';

export function SetDueDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (days: string) => Promise<void> }) {
  const [initial, setInitial] = useState('');
  useEffect(() => {
    if (open) void getConfigString(ConfigString.SET_DUE_REVIEWER).then((v) => setInitial(v || '0'));
  }, [open]);
  return (
    <PromptDialog
      open={open}
      title="복습 날짜 지정"
      label="며칠 뒤에 복습할까요?"
      initialValue={initial}
      placeholder="예: 0, 3, 3-7, 3!"
      hint="0 = 오늘, 1 = 내일, 3-7 = 3~7일 중 무작위, 끝에 ! = 간격도 그만큼으로 변경"
      confirmLabel="지정"
      validate={(v) => (parseDueDate(v) ? null : '숫자, 범위(3-7) 또는 끝에 !를 붙인 값을 입력하세요')}
      onSubmit={async (v) => {
        const parsed = parseDueDate(v)!;
        onClose();
        await onSubmit(parsed.text);
      }}
      onClose={onClose}
    />
  );
}

export function ForgetDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (restorePosition: boolean, resetCounts: boolean) => Promise<void> }) {
  const [restore, setRestore] = useState(true);
  const [reset, setReset] = useState(false);
  useEffect(() => {
    if (!open) return;
    void getConfigBool(ConfigBool.RESTORE_POSITION_REVIEWER).then(setRestore);
    void getConfigBool(ConfigBool.RESET_COUNTS_REVIEWER).then(setReset);
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="카드 잊기"
      testId="forget-dialog"
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            data-testid="forget-confirm"
            onClick={async () => {
              onClose();
              await onSubmit(restore, reset);
            }}
          >
            잊기
          </Button>
        </>
      }
    >
      <p className="study-dialog__text">이 카드를 새 카드로 되돌립니다.</p>
      <label className="study-check">
        <input type="checkbox" checked={restore} onChange={(e) => setRestore(e.target.checked)} />
        <span>가능하면 원래 위치로 되돌리기</span>
      </label>
      <label className="study-check">
        <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} />
        <span>복습 횟수와 실패 횟수 초기화</span>
      </label>
    </Sheet>
  );
}

export function ScriptErrorSheet({ open, errors, onClose, onClear }: { open: boolean; errors: string[]; onClose: () => void; onClear: () => void }) {
  const text = errors.join('\n\n');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="카드 스크립트 오류"
      testId="script-error-sheet"
      actions={
        <>
          <Button
            variant="text"
            onClick={async () => {
              await copyText(text);
              toast('오류 내용을 복사했습니다');
            }}
          >
            복사
          </Button>
          <Button variant="text" onClick={onClear}>
            지우기
          </Button>
          <Button variant="primary" onClick={onClose}>
            닫기
          </Button>
        </>
      }
    >
      <p className="study-dialog__text">덱의 카드 템플릿에 있는 스크립트가 오류를 냈습니다. 학습은 계속할 수 있습니다.</p>
      <pre className="study-errors" data-testid="script-error-text">
        {text}
      </pre>
    </Sheet>
  );
}

export function TimeboxDialog({ view, onContinue, onFinish }: { view: ReviewerView; onContinue: () => void; onFinish: () => void }) {
  const t = view.timebox;
  return (
    <Sheet
      open={!!t}
      onClose={onContinue}
      title="학습 시간 알림"
      testId="timebox-dialog"
      actions={
        <>
          <Button variant="text" onClick={onFinish}>
            끝내기
          </Button>
          <Button variant="primary" onClick={onContinue}>
            계속
          </Button>
        </>
      }
    >
      {t && <p className="study-dialog__text">{`${t.minutes}분 동안 카드 ${t.cards}장을 공부했습니다.`}</p>}
    </Sheet>
  );
}
