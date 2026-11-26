// 설정: 학습 · 화면 · 동기화 · 백업 · 정보. UI preferences live on the host.
import { hostInfoStore, usePrefs, type ThemePref } from '../../host';
import { describeError } from '../../lib/errors';
import { AppBar } from '../../ui/AppBar';
import { IconChevronRight } from '../../ui/icons';
import { ListRow, ListSection } from '../../ui/ListRow';
import { SyncButton } from '../../ui/SyncButton';
import { toast } from '../../ui/Toast';
import { AboutSection } from './AboutSection';
import { Toggle } from './Toggle';
import './Settings.css';

const THEMES: { value: ThemePref; label: string; hint: string }[] = [
  { value: 'auto', label: '자동', hint: '기기의 밝게/어둡게 설정을 따릅니다' },
  { value: 'light', label: '밝게', hint: '' },
  { value: 'dark', label: '어둡게', hint: '' },
  { value: 'eink', label: '전자잉크', hint: '흑백, 애니메이션 없음, 큰 버튼' },
];

export function SettingsScreen() {
  const [prefs, setPrefs] = usePrefs();
  const save = (patch: Parameters<typeof setPrefs>[0]) =>
    setPrefs(patch).catch((err) => toast(`저장하지 못했습니다: ${describeError(err).message}`, { kind: 'error' }));
  const theme = prefs.theme ?? 'auto';

  return (
    <div className="screen">
      <AppBar title="설정" actions={<SyncButton />} />
      <div className="screen__body settings">
        <ListSection title="학습">
          <Toggle label="2버튼 모드" hint="모름 · 암기 완료 두 개만 표시" checked={!!prefs.twoButtons} onChange={(v) => save({ twoButtons: v })} testId="pref-two-buttons" />
          <Toggle label="탭해서 정답 보기" hint="카드를 누르면 정답이 보입니다" checked={prefs.tapToShowAnswer ?? true} onChange={(v) => save({ tapToShowAnswer: v })} />
          <Toggle label="볼륨키/리모컨으로 답하기" checked={prefs.volumeKeys ?? !!hostInfoStore.get()?.eink} onChange={(v) => save({ volumeKeys: v })} testId="pref-volume-keys" />
        </ListSection>

        <ListSection title="화면">
          <div role="radiogroup" aria-label="테마" className="radio-list">
            {THEMES.map((t) => (
              <label key={t.value} className="radio-row" data-testid={`theme-${t.value}`}>
                <input type="radio" name="theme" value={t.value} checked={theme === t.value} onChange={() => save({ theme: t.value })} />
                <span className="radio-row__mark" aria-hidden="true" />
                <span className="radio-row__text">
                  <span>{t.label}</span>
                  {t.hint && <span className="radio-row__hint">{t.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        </ListSection>

        <ListSection title="동기화 · 백업">
          <ListRow title="동기화" subtitle="AnkiWeb 로그인, 미디어 동기화, 전체 올리기/내려받기" href="#/settings/sync" trailing={<IconChevronRight />} testId="settings-sync" />
          <ListRow title="백업" subtitle="지금 백업, 복원, 보관 개수" href="#/settings/backup" trailing={<IconChevronRight />} testId="settings-backup" />
        </ListSection>

        <ListSection title="관리">
          <ListRow title="노트 유형" href="#/notetypes" trailing={<IconChevronRight />} />
          <ListRow title="도구" subtitle="데이터베이스 검사, 미디어 검사, 빈 카드 정리" href="#/settings/tools" trailing={<IconChevronRight />} testId="settings-tools" />
          <ListRow title="내보내기" subtitle="덱 또는 컬렉션을 파일로" href="#/export" trailing={<IconChevronRight />} />
        </ListSection>

        <AboutSection />
      </div>
    </div>
  );
}
