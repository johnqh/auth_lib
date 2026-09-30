/**
 * Which ways of signing in are offered, per platform.
 *
 * A button for a way that cannot work is worse than no button: it is offered,
 * pressed, and fails. So each is offered only where the platform can do it
 * *and* this build was given what it needs to do it with.
 */
import { describe, expect, it } from 'vitest';
import { reversedGoogleClientId } from '../oauth/google';
import {
  appleSignInAvailable,
  googleSignInAvailable,
  type SignInConfig,
  type SignInPlatform,
} from './config';

const CONFIGURED: SignInConfig = {
  googleIosClientId: 'desktop-client.apps.googleusercontent.com',
  googleWebClientId: 'web-client',
  appleServiceId: 'service',
  appleRedirectUri: 'https://example.com/apple',
};

const PLATFORMS: SignInPlatform[] = ['ios', 'android', 'macos', 'windows'];

describe('googleSignInAvailable', () => {
  it('is offered on every platform that is configured for it', () => {
    for (const platform of PLATFORMS) {
      expect([platform, googleSignInAvailable(platform, CONFIGURED)]).toEqual([
        platform,
        true,
      ]);
    }
  });

  it('needs the iOS client on iOS, and nothing of the web client', () => {
    expect(
      googleSignInAvailable('ios', { ...CONFIGURED, googleWebClientId: '' })
    ).toBe(true);
    expect(
      googleSignInAvailable('ios', { ...CONFIGURED, googleIosClientId: '' })
    ).toBe(false);
  });

  it('needs the web client on Android, which is what returns an ID token', () => {
    expect(
      googleSignInAvailable('android', { ...CONFIGURED, googleWebClientId: '' })
    ).toBe(false);
    expect(
      googleSignInAvailable('android', { ...CONFIGURED, googleIosClientId: '' })
    ).toBe(true);
  });

  it('needs a Google client id on a desktop, whose reversed form is the redirect', () => {
    expect(
      googleSignInAvailable('macos', { ...CONFIGURED, googleWebClientId: '' })
    ).toBe(true);
    // Not a Google client id: no redirect scheme can be derived, so the flow
    // would open Google and never come back.
    expect(
      googleSignInAvailable('windows', {
        ...CONFIGURED,
        googleIosClientId: 'desktop-client',
      })
    ).toBe(false);
  });

  it('is never offered on the web entry', () => {
    expect(googleSignInAvailable('web', CONFIGURED)).toBe(false);
  });
});

describe('appleSignInAvailable', () => {
  it('is iOS, and Android where the web flow is configured', () => {
    expect(appleSignInAvailable('ios', CONFIGURED)).toBe(true);
    expect(appleSignInAvailable('android', CONFIGURED)).toBe(true);
    expect(
      appleSignInAvailable('android', { ...CONFIGURED, appleServiceId: '' })
    ).toBe(false);
    expect(
      appleSignInAvailable('android', { ...CONFIGURED, appleRedirectUri: '' })
    ).toBe(false);
  });

  it('is not offered on the desktops', () => {
    expect(appleSignInAvailable('macos', CONFIGURED)).toBe(false);
    expect(appleSignInAvailable('windows', CONFIGURED)).toBe(false);
  });
});

describe('reversedGoogleClientId', () => {
  it('is what Google Cloud Console shows as the iOS URL scheme', () => {
    expect(
      reversedGoogleClientId('123456-abcdef.apps.googleusercontent.com')
    ).toBe('com.googleusercontent.apps.123456-abcdef');
  });

  it('is empty for nothing, and for anything that is not a Google client id', () => {
    expect(reversedGoogleClientId('')).toBe('');
    expect(reversedGoogleClientId('.apps.googleusercontent.com')).toBe('');
    expect(reversedGoogleClientId('123456-abcdef')).toBe('');
    expect(
      reversedGoogleClientId('com.googleusercontent.apps.123456-abcdef')
    ).toBe('');
  });
});
