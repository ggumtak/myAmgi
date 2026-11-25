import { describe, expect, it } from 'vitest';
import { decodeSyncCode, encodeSyncCode } from '../sync/syncCode';

describe('MYAMGI1 Sync Code Codec', () => {
  it('round-trips Supabase credentials with MYAMGI1 prefix and Android JSON keys', () => {
    const payload = {
      supabaseUrl: 'https://demo-project.supabase.co/',
      supabaseAnonKey: 'anon-key-123456',
      email: 'learner@example.com',
      refreshToken: 'refresh-xyz',
      accessToken: 'access-abc',
    };

    const code = encodeSyncCode(payload);
    expect(code.startsWith('MYAMGI1:')).toBe(true);

    const decoded = decodeSyncCode(code);
    expect(decoded).toEqual({
      supabaseUrl: 'https://demo-project.supabase.co',
      supabaseAnonKey: 'anon-key-123456',
      email: 'learner@example.com',
      refreshToken: 'refresh-xyz',
      accessToken: 'access-abc',
    });
  });

  it('rejects invalid prefix or missing required fields', () => {
    expect(() => decodeSyncCode('INVALID:abc')).toThrow();
    expect(() => decodeSyncCode('MYAMGI1:')).toThrow();
  });
});
