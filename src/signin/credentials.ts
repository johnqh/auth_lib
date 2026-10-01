/**
 * @fileoverview A Google or Apple credential for Firebase's JS SDK, obtained
 * the way the platform can: Google's SDK on iOS and Android, the system
 * browser on macOS and Windows, Apple's own sheet on iOS and Apple's web flow
 * on Android. Each native module is borrowed for an ID token and nothing
 * else — the token is handed to the JS SDK's `signInWithCredential`, so one
 * Firebase holds one session on every platform, and the China proxy (a
 * `fetch` wrapper the native SDKs never pass through) covers a phone as it
 * covers a browser.
 *
 * The native modules are injected as narrow structural bridges, like
 * `WebAuthBridge`: auth_lib contains no native code and names no native
 * package. The app `require`s them — inside the function that uses them, not
 * at the top of a file, since a desktop build must load without either half.
 */

import type { OAuthCredential } from 'firebase/auth';
import {
  buildAppleCredential,
  buildGoogleCredential,
} from '../oauth/credentials';
import {
  reversedGoogleClientId,
  signInWithGoogleOAuthDesktop,
} from '../oauth/google';
import type { WebAuthBridge } from '../oauth/webAuthFlow';
import {
  isDesktopPlatform,
  type SignInConfig,
  type SignInPlatform,
} from './config';

/** `GoogleSignin` from `@react-native-google-signin/google-signin`. */
export interface GoogleSignInBridge {
  configure(params: { iosClientId?: string; webClientId?: string }): void;
  hasPlayServices(options?: Record<string, unknown>): Promise<boolean>;
  signIn(): Promise<{ type: string; data: { idToken: string | null } | null }>;
}

/*
  The enum-valued members default to `any` on purpose: a bridge instantiated
  with `unknown` is not assignable FROM the real module (its `performRequest`
  takes the enum, and `unknown` is not one), which is exactly the check an
  app's `getAppleAuth: () => appleAuth` has to pass. Inferred at a call site,
  the real enums flow through; written as a plain field type, `any` lets the
  real module in and the tests' string enums too.
*/
/** `appleAuth` from `@invertase/react-native-apple-authentication` (iOS). */
export interface AppleAuthBridge<Operation = any, Scope = any> {
  Operation: { LOGIN: Operation };
  Scope: { EMAIL: Scope; FULL_NAME: Scope };
  Error: { CANCELED: string };
  performRequest(options: {
    requestedOperation: Operation;
    requestedScopes: Scope[];
  }): Promise<{ identityToken: string | null; nonce?: string }>;
}

/** `appleAuthAndroid` from the same module. */
export interface AppleAuthAndroidBridge<ResponseType = any, Scope = any> {
  isSupported: boolean;
  ResponseType: { ALL: ResponseType };
  Scope: { ALL: Scope };
  Error: { SIGNIN_CANCELLED: string };
  configure(config: {
    clientId: string;
    redirectUri: string;
    responseType: ResponseType;
    scope: Scope;
  }): void;
  signIn(): Promise<{ id_token?: string; nonce?: string }>;
}

/** A module handed over directly, or fetched — `require` or `import()`. */
export type ModuleGetter<T> = () => T | Promise<T>;

/**
 * What the platform's Google sign-in needs. The desktops need the browser
 * bridge; iOS and Android need Google's SDK. An app hands over whichever it
 * can load — a missing one throws, since availability was checked first.
 */
export interface GoogleSignInModules {
  webAuth?: WebAuthBridge;
  googleSignIn?: ModuleGetter<GoogleSignInBridge>;
}

export interface AppleSignInModules {
  appleAuth?: ModuleGetter<AppleAuthBridge>;
  appleAuthAndroid?: ModuleGetter<AppleAuthAndroidBridge>;
}

function missing(what: string): never {
  throw new Error(`${what} is not available on this platform`);
}

/**
 * Google's credential, or null when the user closed the sheet or browser —
 * an ordinary outcome, not a failure to report.
 */
export async function googleCredential(
  platform: SignInPlatform,
  config: SignInConfig,
  modules: GoogleSignInModules
): Promise<OAuthCredential | null> {
  if (platform === 'windows') {
    // A loopback redirect and a "Desktop app" client: the native side picks
    // the port and replaces this placeholder redirect with it.
    const webAuth = modules.webAuth ?? missing('WebAuth');
    return signInWithGoogleOAuthDesktop(
      {
        clientId: config.googleWindowsClientId ?? '',
        redirectUri: 'http://127.0.0.1/callback',
        callbackScheme: 'http',
        ...(config.googleWindowsClientSecret
          ? { clientSecret: config.googleWindowsClientSecret }
          : {}),
      },
      webAuth
    );
  }
  if (isDesktopPlatform(platform)) {
    // macOS: the iOS-type client, back through its reversed-id scheme.
    const webAuth = modules.webAuth ?? missing('WebAuth');
    return signInWithGoogleOAuthDesktop(
      {
        clientId: config.googleIosClientId,
        reversedClientId: reversedGoogleClientId(config.googleIosClientId),
      },
      webAuth
    );
  }
  const GoogleSignin = await (
    modules.googleSignIn ?? missing('GoogleSignin')
  )();
  // `iosClientId` is always given on iOS: without it the module goes looking
  // for a `GoogleService-Info.plist` in the bundle, which an app on the JS
  // SDK has no other reason to ship.
  GoogleSignin.configure(
    platform === 'android'
      ? { webClientId: config.googleWebClientId }
      : { iosClientId: config.googleIosClientId }
  );
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') return null;
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('No ID token from Google');
  return buildGoogleCredential(idToken);
}

/** Apple's credential, or null when the user closed the sheet. */
export async function appleCredential(
  platform: SignInPlatform,
  config: SignInConfig,
  modules: AppleSignInModules
): Promise<OAuthCredential | null> {
  if (platform === 'android') {
    const appleAuthAndroid = await (
      modules.appleAuthAndroid ?? missing('appleAuthAndroid')
    )();
    if (!appleAuthAndroid.isSupported) {
      throw new Error('Apple sign-in is not supported on this device');
    }
    appleAuthAndroid.configure({
      clientId: config.appleServiceId,
      redirectUri: config.appleRedirectUri,
      responseType: appleAuthAndroid.ResponseType.ALL,
      scope: appleAuthAndroid.Scope.ALL,
    });
    try {
      const response = await appleAuthAndroid.signIn();
      if (!response.id_token) throw new Error('No identity token from Apple');
      return buildAppleCredential({
        idToken: response.id_token,
        ...(response.nonce ? { rawNonce: response.nonce } : {}),
      });
    } catch (error) {
      if (errorCode(error) === appleAuthAndroid.Error.SIGNIN_CANCELLED) {
        return null;
      }
      throw error;
    }
  }
  const appleAuth = await (modules.appleAuth ?? missing('appleAuth'))();
  try {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    if (!response.identityToken) {
      throw new Error('No identity token from Apple');
    }
    return buildAppleCredential({
      idToken: response.identityToken,
      ...(response.nonce ? { rawNonce: response.nonce } : {}),
    });
  } catch (error) {
    if (errorCode(error) === appleAuth.Error.CANCELED) return null;
    throw error;
  }
}

/** What either Apple module puts on a rejection, where it puts anything. */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}
