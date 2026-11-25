import React, { useState } from 'react';
import { AppSettings, NightMode } from '../types/models';
import { decodeSyncCode, encodeSyncCode } from '../sync/syncCode';
import {
  signInWithPassword,
  signUpWithPassword,
  syncWithSupabase,
} from '../sync/supabaseSync';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  onSyncComplete: () => Promise<void>;
  onResetCollection: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onSyncComplete,
  onResetCollection,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabaseAnonKey);
  const [email, setEmail] = useState(settings.supabaseEmail);
  const [password, setPassword] = useState('');
  const [syncCodeInput, setSyncCodeInput] = useState(settings.syncCode);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleApplySyncCode = async () => {
    setSyncError('');
    setSyncMessage('');
    try {
      const decoded = decodeSyncCode(syncCodeInput);
      const updated = await onUpdateSettings({
        supabaseUrl: decoded.supabaseUrl,
        supabaseAnonKey: decoded.supabaseAnonKey,
        supabaseEmail: decoded.email ?? '',
        supabaseRefreshToken: decoded.refreshToken ?? '',
        supabaseAccessToken: decoded.accessToken ?? '',
        syncCode: syncCodeInput.trim(),
      });
      setSupabaseUrl(updated.supabaseUrl);
      setSupabaseAnonKey(updated.supabaseAnonKey);
      setEmail(updated.supabaseEmail);
      setSyncMessage('1초 기기 연결 코드가 적용되었습니다. 지금 동기화를 눌러주세요.');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleGenerateSyncCode = async () => {
    setSyncError('');
    if (!supabaseUrl || !supabaseAnonKey) {
      setSyncError('Supabase URL과 Anon Key를 먼저 입력하세요.');
      return;
    }
    const code = encodeSyncCode({
      supabaseUrl,
      supabaseAnonKey,
      email,
      refreshToken: settings.supabaseRefreshToken,
      accessToken: settings.supabaseAccessToken,
    });
    setSyncCodeInput(code);
    await onUpdateSettings({
      supabaseUrl,
      supabaseAnonKey,
      supabaseEmail: email,
      syncCode: code,
    });
    setSyncMessage('MYAMGI1 기기 연결 코드가 생성되었습니다.');
  };

  const handleAuth = async (mode: 'signin' | 'signup') => {
    setBusy(true);
    setSyncError('');
    setSyncMessage('');
    try {
      const session =
        mode === 'signin'
          ? await signInWithPassword(supabaseUrl, supabaseAnonKey, email, password)
          : await signUpWithPassword(supabaseUrl, supabaseAnonKey, email, password);

      const code = encodeSyncCode({
        supabaseUrl,
        supabaseAnonKey,
        email: session.user?.email ?? email,
        refreshToken: session.refresh_token,
        accessToken: session.access_token,
      });

      await onUpdateSettings({
        supabaseUrl: supabaseUrl.trim().replace(/\/+$/, ''),
        supabaseAnonKey: supabaseAnonKey.trim(),
        supabaseEmail: session.user?.email ?? email,
        supabaseAccessToken: session.access_token,
        supabaseRefreshToken: session.refresh_token,
        supabaseUserId: session.user?.id ?? '',
        syncCode: code,
      });
      setSyncCodeInput(code);
      setPassword('');
      setSyncMessage(mode === 'signin' ? '로그인 및 세션 저장 완료!' : '회원가입 완료!');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRunSync = async () => {
    setBusy(true);
    setSyncError('');
    setSyncMessage('동기화 준비 중...');
    try {
      const report = await syncWithSupabase((p) => {
        setSyncMessage(p.detail);
      });
      await onSyncComplete();
      setSyncMessage(
        `동기화 완료! (업로드 ${report.pushedItems}건, 수신 ${report.pulledItems}건, 미디어 ${report.uploadedMedia}건)`
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-grid">
      <div className="card-surface panel-pad">
        <h3>학습 &amp; 화면 설정</h3>

        <div className="setting-item">
          <div>
            <div className="setting-title">2버튼 고속 학습 모드</div>
            <div className="muted-text small">
              기본값 ON: 정답 확인 후 <strong>다시(1)</strong> / <strong>괜찮음(Space, Enter, 2)</strong>만 사용하며 3·4 키는 무시합니다. 끄면 4버튼 모드(다시/어려움/괜찮음/쉬움)로 전환됩니다.
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.twoButtonMode}
              onChange={(e) => void onUpdateSettings({ twoButtonMode: e.target.checked })}
            />
            <span className="slider" />
          </label>
        </div>

        <div className="setting-item">
          <div>
            <div className="setting-title">야간 모드 (Night Mode)</div>
            <div className="muted-text small">
              Anki 카드의 <code>html.night_mode</code> 스타일과 앱 테마를 전환합니다.
            </div>
          </div>
          <select
            value={settings.nightMode}
            onChange={(e) =>
              void onUpdateSettings({ nightMode: e.target.value as NightMode })
            }
          >
            <option value="auto">시스템 자동 (Auto)</option>
            <option value="light">라이트 (Light)</option>
            <option value="dark">다크 (Dark)</option>
          </select>
        </div>

        <div className="setting-item danger-zone">
          <div>
            <div className="setting-title">로컬 데이터 초기화</div>
            <div className="muted-text small">
              IndexedDB에 저장된 모든 덱, 카드, 복습 기록, 미디어를 삭제합니다.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('정말 모든 로컬 학습 데이터를 초기화하시겠습니까?')) {
                void onResetCollection();
              }
            }}
          >
            초기화
          </button>
        </div>
      </div>

      <div className="card-surface panel-pad">
        <h3>1초 기기 연결 코드 (MYAMGI1)</h3>
        <p className="muted-text small">
          Android 앱에서 복사한 <code>MYAMGI1:...</code> 코드를 붙여넣으면 Supabase 설정과 로그인 세션이 즉시 연결됩니다.
        </p>

        <div className="form-field">
          <span>연결 코드</span>
          <textarea
            rows={3}
            placeholder="MYAMGI1:eyJ1Ijo..."
            value={syncCodeInput}
            onChange={(e) => setSyncCodeInput(e.target.value)}
          />
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => void handleApplySyncCode()}>
            코드 불러오기
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleGenerateSyncCode()}
          >
            현재 설정으로 코드 생성
          </button>
          {syncCodeInput && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(syncCodeInput);
                setSyncMessage('연결 코드가 클립보드에 복사되었습니다.');
              }}
            >
              복사
            </button>
          )}
        </div>
      </div>

      <div className="card-surface panel-pad full-span">
        <div className="sync-header-row">
          <div>
            <h3>Supabase 클라우드 동기화</h3>
            <p className="muted-text small">
              <code>amgi_user_settings</code>, <code>amgi_sync_items</code>,{' '}
              <code>amgi-media</code> 스토리지 버킷과 직접 REST API로 동기화합니다.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void handleRunSync()}
          >
            {busy ? '동기화 중...' : '☁️ 지금 동기화'}
          </button>
        </div>

        <div className="form-grid-2">
          <label className="form-field">
            <span>Supabase URL</span>
            <input
              type="url"
              placeholder="https://xxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Supabase Anon Key</span>
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>이메일</span>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>비밀번호</span>
            <input
              type="password"
              placeholder="로그인/가입 시 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void handleAuth('signin')}
          >
            로그인
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void handleAuth('signup')}
          >
            회원가입
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              void onUpdateSettings({
                supabaseUrl: supabaseUrl.trim().replace(/\/+$/, ''),
                supabaseAnonKey: supabaseAnonKey.trim(),
                supabaseEmail: email.trim(),
              }).then(() => setSyncMessage('Supabase 연결 설정 저장됨'))
            }
          >
            URL/키만 저장
          </button>
          {settings.lastSyncAt ? (
            <span className="muted-text small">
              마지막 동기화: {new Date(settings.lastSyncAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {(syncMessage || syncError) && (
          <div className={`inline-banner ${syncError ? 'alert-error' : 'alert-ok'}`}>
            {syncError ? `⚠️ ${syncError}` : `✅ ${syncMessage}`}
          </div>
        )}
      </div>
    </div>
  );
};
