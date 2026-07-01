/**
 * @fileoverview Canonical auth-context contract shared by every app's
 * AuthProvider, plus the config the shared hooks accept. Platform-agnostic
 * (types only) — safe to import from web, RN, and the `oauth` subpath.
 */

import type { OAuthClientConfig, WebAuthBridge } from '../oauth/webAuthFlow';

/** Serialisable subset of the Firebase user consumed by app components. */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

/** The canonical value exposed by every app's `useAuth()`. */
export interface AuthContextValue {
  /** Currently authenticated user, or `null` when signed out. */
  user: AuthUser | null;
  /** Whether an auth operation is in progress. */
  isLoading: boolean;
  /** Whether the initial auth state has been determined. */
  isReady: boolean;
  /** Current Firebase ID token, or `null`. */
  token: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  /** Return the current ID token (cached), or `null`. */
  getToken: () => Promise<string | null>;
  /** Force-refresh the ID token and return it. */
  refreshToken: () => Promise<string | null>;
}

/** Which providers an app enables. Disabled providers' methods reject. */
export interface AuthProvidersConfig {
  google?: boolean;
  apple?: boolean;
  anonymous?: boolean;
  emailPassword?: boolean;
}

/**
 * Minimal shape of `@react-native-google-signin/google-signin`'s default
 * export that the native hook uses. Injected so auth_lib carries no native dep.
 */
export interface GoogleSigninLike {
  configure(options: Record<string, unknown>): void;
  hasPlayServices(options?: Record<string, unknown>): Promise<boolean>;
  signIn(): Promise<{
    type?: string;
    data?: { idToken?: string | null } | null;
  }>;
}

/** Minimal shape of `@invertase/react-native-apple-authentication`'s iOS API. */
export interface AppleAuthLike {
  performRequest(
    options: unknown
  ): Promise<{ identityToken: string | null; nonce: string }>;
  Operation: { LOGIN: unknown };
  Scope: { EMAIL: unknown; FULL_NAME: unknown };
}

/** Minimal shape of the Android web Apple API (`appleAuthAndroid`). */
export interface AppleAuthAndroidLike {
  isSupported: boolean;
  // Native SDK option bag (AndroidConfig); typed loose to accept the real module.
  configure(options: any): void;
  signIn(): Promise<{ id_token?: string; nonce?: string }>;
  ResponseType: { ALL: unknown };
  Scope: { ALL: unknown };
}

/**
 * Config for the shared Firebase-auth hooks. Fields are consumed selectively by
 * the JS-SDK (desktop/web) vs native variant; unused ones are ignored.
 */
export interface FirebaseAuthConfig {
  /** JS-SDK only: Firebase web config object (`apiKey`, `authDomain`, …). */
  firebaseConfig?: Record<string, unknown>;
  /** JS-SDK only: AsyncStorage instance for RN persistence (injected). */
  asyncStorage?: unknown;
  /** Desktop Google PKCE config (`clientId` + `reversedClientId`). */
  googleOAuth?: OAuthClientConfig;
  /** Injected system-browser bridge for desktop Google PKCE. */
  webAuth?: WebAuthBridge;
  /** Native Google client ids for `GoogleSignin.configure`. */
  googleNative?: { webClientId?: string; iosClientId?: string };
  /** Native Google Sign-In module getter. */
  getGoogleSignin?: () => Promise<GoogleSigninLike>;
  /** Native (iOS/macOS) Apple module getter. */
  getAppleAuth?: () => Promise<AppleAuthLike>;
  /** Android web Apple module getter + config. */
  getAppleAuthAndroid?: () => Promise<AppleAuthAndroidLike>;
  appleAndroid?: { serviceId: string; redirectUri: string };
  /** Which providers are enabled. Defaults: google + emailPassword on. */
  providers?: AuthProvidersConfig;
  /** Auto-anonymous sign-in when the listener fires with no user. */
  autoSignInAnonymously?: boolean;
  /** Called on every auth-state change (e.g. set consumables user id). */
  onUserChanged?: (user: AuthUser | null) => void;
  /** Called once on provider init (e.g. initialize a downstream service). */
  onInit?: () => void;
  /** Called on uid identity transitions (e.g. LayoutAnimation). */
  onIdentityChange?: (prevUid: string | null, nextUid: string | null) => void;
  /** Background token-refresh interval (ms). Default 50 min; `null` disables. */
  refreshIntervalMs?: number | null;
}

/** Default background refresh interval: 50 minutes (tokens expire at 60). */
export const DEFAULT_REFRESH_INTERVAL_MS = 50 * 60 * 1000;
