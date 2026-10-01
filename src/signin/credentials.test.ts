/**
 * Each platform's credential path, driven through fake bridges: what each
 * native module is configured with, and that closing a sheet is an answer
 * rather than an error.
 */
import { describe, expect, it, vi } from 'vitest';
import type { OAuthCredential } from 'firebase/auth';
import {
  appleCredential,
  type AppleAuthAndroidBridge,
  type AppleAuthBridge,
  type GoogleSignInBridge,
  googleCredential,
} from './credentials';
import type { SignInConfig } from './config';

vi.mock('../oauth/credentials', () => ({
  buildGoogleCredential: (idToken: string) => ({
    providerId: 'google.com',
    idToken,
  }),
  buildAppleCredential: (args: { idToken: string; rawNonce?: string }) => ({
    providerId: 'apple.com',
    ...args,
  }),
}));

const CONFIG: SignInConfig = {
  googleIosClientId: 'ios-client.apps.googleusercontent.com',
  googleWebClientId: 'web-client',
  appleServiceId: 'service',
  appleRedirectUri: 'https://example.com/apple',
};

function fakeGoogle(
  response: Awaited<ReturnType<GoogleSignInBridge['signIn']>>
): GoogleSignInBridge {
  return {
    configure: vi.fn(),
    hasPlayServices: vi.fn(async () => true),
    signIn: vi.fn(async () => response),
  };
}

describe('googleCredential', () => {
  it("configures Google's SDK with the iOS client on iOS and the web client on Android", async () => {
    const token = { type: 'success', data: { idToken: 'ID' } };
    const ios = fakeGoogle(token);
    await googleCredential('ios', CONFIG, { googleSignIn: () => ios });
    expect(ios.configure).toHaveBeenCalledWith({
      iosClientId: CONFIG.googleIosClientId,
    });

    const android = fakeGoogle(token);
    const credential = await googleCredential('android', CONFIG, {
      googleSignIn: () => android,
    });
    expect(android.configure).toHaveBeenCalledWith({
      webClientId: CONFIG.googleWebClientId,
    });
    expect(credential).toEqual({ providerId: 'google.com', idToken: 'ID' });
  });

  it('answers null when the sheet is closed, and throws with no token', async () => {
    const closed = fakeGoogle({ type: 'cancelled', data: null });
    await expect(
      googleCredential('ios', CONFIG, { googleSignIn: () => closed })
    ).resolves.toBeNull();
    const empty = fakeGoogle({ type: 'success', data: { idToken: null } });
    await expect(
      googleCredential('ios', CONFIG, { googleSignIn: () => empty })
    ).rejects.toThrow('No ID token from Google');
  });

  it('goes through the system browser on a desktop, with the derived redirect scheme', async () => {
    const authenticate = vi.fn(async () => null);
    const credential = await googleCredential('macos', CONFIG, {
      webAuth: {
        authenticate,
        generateCodeVerifier: async () => 'VERIFIER',
        sha256Base64Url: async () => 'CHALLENGE',
      },
    });
    expect(credential).toBeNull(); // the browser was closed
    expect(authenticate).toHaveBeenCalledWith(
      expect.stringContaining(
        encodeURIComponent(
          'com.googleusercontent.apps.ios-client:/oauth2callback'
        )
      ),
      'com.googleusercontent.apps.ios-client'
    );
  });

  it('signs in on Windows with the Desktop-app client and a loopback redirect', async () => {
    const authenticate = vi.fn(async () => null);
    await googleCredential(
      'windows',
      {
        ...CONFIG,
        googleWindowsClientId: 'win-client.apps.googleusercontent.com',
        googleWindowsClientSecret: 'win-secret',
      },
      {
        webAuth: {
          authenticate,
          generateCodeVerifier: async () => 'VERIFIER',
          sha256Base64Url: async () => 'CHALLENGE',
        },
      }
    );
    const url = String(authenticate.mock.calls[0]?.[0]);
    expect(url).toContain('client_id=win-client.apps.googleusercontent.com');
    // A placeholder the native side replaces with the port it bound.
    expect(url).toContain(encodeURIComponent('http://127.0.0.1/callback'));
    expect(url).not.toContain('client_secret');
  });

  it('names the module it was not given', async () => {
    await expect(googleCredential('macos', CONFIG, {})).rejects.toThrow(
      'WebAuth'
    );
    await expect(googleCredential('ios', CONFIG, {})).rejects.toThrow(
      'GoogleSignin'
    );
  });
});

function fakeAppleIos(
  response: { identityToken: string | null; nonce?: string } | Error
): AppleAuthBridge<'login', 'email' | 'name'> {
  return {
    Operation: { LOGIN: 'login' },
    Scope: { EMAIL: 'email', FULL_NAME: 'name' },
    Error: { CANCELED: '1001' },
    performRequest: vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  };
}

function fakeAppleAndroid(
  response: { id_token?: string; nonce?: string } | Error
): AppleAuthAndroidBridge<'all', 'all'> {
  return {
    isSupported: true,
    ResponseType: { ALL: 'all' },
    Scope: { ALL: 'all' },
    Error: { SIGNIN_CANCELLED: 'SIGNIN_CANCELLED' },
    configure: vi.fn(),
    signIn: vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  };
}

describe('appleCredential', () => {
  it("asks Apple's sheet on iOS for email and name, and carries the nonce", async () => {
    const apple = fakeAppleIos({ identityToken: 'ID', nonce: 'NONCE' });
    const credential = (await appleCredential('ios', CONFIG, {
      appleAuth: () => apple,
    })) as OAuthCredential & { rawNonce?: string };
    expect(apple.performRequest).toHaveBeenCalledWith({
      requestedOperation: 'login',
      requestedScopes: ['email', 'name'],
    });
    expect(credential).toEqual({
      providerId: 'apple.com',
      idToken: 'ID',
      rawNonce: 'NONCE',
    });
  });

  it("runs Apple's web flow on Android with the Services ID and redirect", async () => {
    const apple = fakeAppleAndroid({ id_token: 'ID' });
    const credential = await appleCredential('android', CONFIG, {
      appleAuthAndroid: () => apple,
    });
    expect(apple.configure).toHaveBeenCalledWith({
      clientId: 'service',
      redirectUri: 'https://example.com/apple',
      responseType: 'all',
      scope: 'all',
    });
    expect(credential).toEqual({ providerId: 'apple.com', idToken: 'ID' });
  });

  it('answers null when the sheet is closed, on either platform', async () => {
    const closedIos = Object.assign(new Error('closed'), { code: '1001' });
    await expect(
      appleCredential('ios', CONFIG, {
        appleAuth: () => fakeAppleIos(closedIos),
      })
    ).resolves.toBeNull();
    const closedAndroid = Object.assign(new Error('closed'), {
      code: 'SIGNIN_CANCELLED',
    });
    await expect(
      appleCredential('android', CONFIG, {
        appleAuthAndroid: () => fakeAppleAndroid(closedAndroid),
      })
    ).resolves.toBeNull();
  });

  it('reports any other failure', async () => {
    await expect(
      appleCredential('ios', CONFIG, {
        appleAuth: () => fakeAppleIos(new Error('network')),
      })
    ).rejects.toThrow('network');
    await expect(
      appleCredential('android', CONFIG, {
        appleAuthAndroid: () => fakeAppleAndroid({}),
      })
    ).rejects.toThrow('No identity token from Apple');
  });
});
