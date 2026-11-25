// Ready-made dialogs on top of Sheet: confirm and single-line text prompt.
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Sheet } from './Sheet';

export function ConfirmDialog(props: {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!props.open) setBusy(false);
  }, [props.open]);
  const confirm = async () => {
    setBusy(true);
    try {
      await props.onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      busy={busy}
      testId="confirm-dialog"
      actions={
        <>
          <Button variant="text" onClick={props.onClose} disabled={busy}>
            취소
          </Button>
          <Button variant={props.danger ? 'danger' : 'primary'} onClick={confirm} loading={busy}>
            {props.confirmLabel}
          </Button>
        </>
      }
    >
      {props.message}
    </Sheet>
  );
}

export function PromptDialog(props: {
  open: boolean;
  title: ReactNode;
  label: string;
  initialValue?: string;
  placeholder?: string;
  hint?: ReactNode;
  confirmLabel: string;
  /** Return an error message to keep the dialog open. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(props.initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (props.open) {
      setValue(props.initialValue ?? '');
      setError(null);
      setBusy(false);
    }
  }, [props.open, props.initialValue]);
  const submit = async () => {
    const err = props.validate?.(value) ?? null;
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      await props.onSubmit(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      busy={busy}
      testId="prompt-dialog"
      actions={
        <>
          <Button variant="text" onClick={props.onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {props.confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field__label" htmlFor="prompt-input">
          {props.label}
        </label>
        <input
          id="prompt-input"
          className="field__input"
          value={value}
          placeholder={props.placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={!!error}
        />
        {error ? <div className="field__error" role="alert">{error}</div> : props.hint ? <div className="field__hint">{props.hint}</div> : null}
      </form>
    </Sheet>
  );
}
