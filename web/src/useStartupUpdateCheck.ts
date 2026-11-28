import { useEffect, useRef } from 'react';
import { useApp } from './context/AppContext';
import { host, type UpdateStatusResponse } from './host';
import { hasOpenModal, useToast } from './ui';

/** Pref key holding the time (ms) of the last automatic update check. */
export const UPDATE_LAST_AUTO_CHECK_PREF = 'update.lastAutoCheck';
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Hash that opens Settings with the update sheet. */
export const SETTINGS_UPDATE_HASH = '#/settings/update';

/**
 * Checks for updates once per launch (at most every 6 h) on Android.
 *
 * - UI-bundle-only update: applied silently; the page reloads right away only when the
 *   user is on a root tab with no sheet open, otherwise a toast offers the reload (the
 *   bundle is picked up on the next launch anyway).
 * - APK update: a toast with a button that opens Settings' update sheet. Never installs
 *   on its own (`update.apply` would start the APK download).
 *
 * `canReloadNow` is read when the UI bundle has been applied.
 */
export function useStartupUpdateCheck(canReloadNow: () => boolean): void {
  const { info, prefs, setPref, navigate } = useApp();
  const { showToast } = useToast();
  const startedRef = useRef(false);
  const canReloadRef = useRef(canReloadNow);
  canReloadRef.current = canReloadNow;

  useEffect(() => {
    // `info` and `prefs` arrive together from the initial load.
    if (!info || startedRef.current) return;
    startedRef.current = true;
    // Desktop has no updater (`update.check` is unsupported there).
    if (info.platform !== 'android') return;

    const last = prefs[UPDATE_LAST_AUTO_CHECK_PREF];
    const now = Date.now();
    if (typeof last === 'number' && last > 0 && last <= now && now - last < AUTO_CHECK_INTERVAL_MS) {
      return;
    }

    // Not cancelled on cleanup: the check runs once per launch (StrictMode re-runs the
    // effect, and `startedRef` keeps the second run from starting another check).
    void (async () => {
      void setPref(UPDATE_LAST_AUTO_CHECK_PREF, now);
      let res: UpdateStatusResponse;
      try {
        res = await host.updateCheck();
      } catch {
        return; // offline / unsupported: try again next launch
      }
      if (res?.supported === false || !res?.available) return;

      if (res.apkAvailable) {
        showToast(`새 앱 버전(${res.version || '최신'})이 있습니다.`, 'info', {
          label: '업데이트 보기',
          onClick: () => navigate(SETTINGS_UPDATE_HASH),
        });
        return;
      }

      if (res.uiAvailable) {
        let applied: UpdateStatusResponse;
        try {
          applied = await host.updateApply();
        } catch {
          return; // leave it for the manual button in Settings
        }
        if (!applied?.applied) return;
        if (!applied.reloadRequired) return;
        if (canReloadRef.current() && !hasOpenModal()) {
          window.location.reload();
          return;
        }
        showToast('새 화면 업데이트 준비됨', 'info', {
          label: '지금 적용',
          onClick: () => window.location.reload(),
        });
      }
    })();
    // Runs once, when `info` first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);
}
