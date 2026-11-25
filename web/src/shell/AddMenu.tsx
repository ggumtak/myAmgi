// The "추가" menu (deck list FAB on phones, rail button on wide screens):
// 노트 추가, 덱 만들기, 필터 덱 만들기, 가져오기.
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { decks } from '../anki';
import { host } from '../host';
import { allDeckNames, normalizeDeckName, sameDeckName } from '../lib/deckTree';
import { describeError } from '../lib/errors';
import { notifyCollectionChanged } from '../lib/hooks';
import { navigate } from '../lib/router';
import { Menu, type MenuAnchor } from '../ui/Menu';
import { PromptDialog } from '../ui/Dialogs';
import { toast } from '../ui/Toast';

export const IMPORT_ACCEPT = '.apkg,.colpkg,.txt,.csv,.tsv';

/** Validates a new full deck name against the current tree. */
export async function validateNewDeckName(value: string, exceptId?: number): Promise<string | null> {
  const name = normalizeDeckName(value);
  if (!name) return '덱 이름을 입력하세요';
  const tree = await decks.deckTree();
  const names = allDeckNames(tree);
  if (names.some((n) => sameDeckName(n, name))) {
    if (exceptId !== undefined) {
      const own = (await decks.deckNames({ includeFiltered: true, skipEmptyDefault: false })).find((d) => d.id === exceptId);
      if (own && sameDeckName(own.name, name)) return null;
    }
    return '같은 이름의 덱이 이미 있습니다';
  }
  return null;
}

/** Hidden file input + upload + classification -> continues on the host's route. */
export function useImportPicker(): { pick: () => void; input: ReactElement } {
  const ref = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => ref.current?.click(), []);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={IMPORT_ACCEPT}
      hidden
      data-testid="import-input"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
          toast(`'${file.name}' 올리는 중…`);
          const path = await host.upload(file, file.name);
          const next = await host.importFile(path, file.name);
          navigate(next.route);
        } catch (err) {
          toast(`가져오기 실패: ${describeError(err).message}`, { kind: 'error' });
        }
      }}
    />
  );
  return { pick, input };
}

export function useCreateDeckDialog(): { open: (prefix?: string) => void; dialog: ReactElement } {
  const [state, setState] = useState<{ open: boolean; prefix: string }>({ open: false, prefix: '' });
  const dialog = (
    <PromptDialog
      open={state.open}
      title={state.prefix ? `'${state.prefix.replace(/::$/, '')}'에 하위 덱 만들기` : '덱 만들기'}
      label="덱 이름"
      initialValue=""
      placeholder={state.prefix ? '하위 덱 이름' : '예: 일본어::한자'}
      hint={state.prefix ? undefined : "'::'로 하위 덱을 만들 수 있습니다 (예: 일본어::한자)"}
      confirmLabel="만들기"
      validate={(v) => (normalizeDeckName(v) ? null : '덱 이름을 입력하세요')}
      onSubmit={async (v) => {
        const full = normalizeDeckName(state.prefix + v);
        const err = await validateNewDeckName(full);
        if (err) throw new Error(err);
        try {
          await decks.addDeck(full);
        } catch (e) {
          throw new Error(describeError(e).message);
        }
        setState({ open: false, prefix: '' });
        notifyCollectionChanged();
        toast(`'${full}' 덱을 만들었습니다`);
      }}
      onClose={() => setState({ open: false, prefix: '' })}
    />
  );
  return { open: (prefix = '') => setState({ open: true, prefix }), dialog };
}

export function AddMenu({ anchor, open, onClose }: { anchor: MenuAnchor | null; open: boolean; onClose: () => void }) {
  const create = useCreateDeckDialog();
  const importer = useImportPicker();
  return (
    <>
      <Menu
        open={open}
        anchor={anchor}
        onClose={onClose}
        label="추가"
        items={[
          {
            label: '노트 추가',
            testId: 'add-note',
            onSelect: async () => {
              let deck = '';
              try {
                deck = String((await decks.getCurrentDeck()).id);
              } catch {
                // fall back to the editor's default
              }
              navigate(deck ? `/note/new?deck=${deck}` : '/note/new');
            },
          },
          { label: '덱 만들기', testId: 'add-deck', onSelect: () => create.open() },
          { label: '필터 덱 만들기', testId: 'add-filtered-deck', onSelect: () => navigate('/filtered-deck/new') },
          { label: '가져오기 (.apkg · .colpkg · 텍스트/CSV)', testId: 'add-import', onSelect: importer.pick },
        ]}
      />
      {create.dialog}
      {importer.input}
    </>
  );
}
