import { describe, expect, it } from 'vitest';

import * as authLib from '../index';

describe('auth_lib proxy surface', () => {
  it.each([
    'setFirebaseProxy',
    'getFirebaseProxyOrigin',
    'firebaseProxyReady',
    'disableFirebaseProxy',
    'isFirebaseReachable',
  ])('re-exports %s from di', name => {
    expect(typeof (authLib as Record<string, unknown>)[name]).toBe('function');
  });

  it('keeps the auth-specific provider filter', () => {
    expect(typeof authLib.filterAuthProvidersForProxy).toBe('function');
  });

  it('no longer exports a default proxy origin', () => {
    expect(
      (authLib as Record<string, unknown>).DEFAULT_FIREBASE_PROXY_ORIGIN
    ).toBeUndefined();
  });

  it('does not route Firebase traffic merely because it was imported', () => {
    expect(authLib.getFirebaseProxyOrigin()).toBeNull();
    expect(authLib.isFirebaseProxyActive()).toBe(false);
  });
});
