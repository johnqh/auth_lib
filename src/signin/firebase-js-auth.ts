/**
 * @fileoverview Firebase's JS SDK Auth in a React Native app, kept across
 * launches.
 *
 * This is what makes the China proxy work on a phone. `setFirebaseProxy`
 * (`@sudobility/di`) wraps the global `fetch`, and the JS SDK's React Native
 * build looks `fetch` up per request, so a phone's sign-in and token refresh
 * pass through it exactly as a browser's do; the native Firebase SDKs make
 * their own connections that no JS wrapper sees. Configured from values the
 * app passes — read from its environment — since the JS SDK reads nothing
 * from `GoogleService-Info.plist` or `google-services.json`.
 */

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import * as firebaseAuthModule from 'firebase/auth';
import {
  type Auth,
  getAuth,
  initializeAuth,
  type Persistence,
} from 'firebase/auth';

/** Firebase's web config: the API key and whatever else the app has. */
export interface FirebaseJsAuthConfig {
  apiKey: string;
  authDomain?: string;
  projectId?: string;
  [option: string]: unknown;
}

/** `AsyncStorage`, or anything with its shape. */
export interface PersistenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * The app's Auth, created on first call and held after. `initializeAuth`
 * may be called a single time per app, and callers read this on every
 * request. Returns null with no API key: an unconfigured build is a
 * supported state — local-only, no sign-in — not an error.
 *
 * Kept on the device, so signing in is done once rather than at every
 * launch. Left to `getAuth`, the JS SDK holds a session in memory under
 * React Native — there is no browser storage for it to fall back on — and
 * the account is gone the moment the app quits. `getReactNativePersistence`
 * exists only in the SDK's React Native build, which Metro resolves and a
 * test runner does not, and its types do not declare it; it is read off the
 * module so its absence is a fallback rather than a crash at import.
 */
export function createFirebaseJsAuth(
  config: FirebaseJsAuthConfig,
  storage: PersistenceStorage | null
): Auth | null {
  if (!config.apiKey) return null;
  const existing = getApps()[0];
  if (existing) return getAuth(existing);
  const app: FirebaseApp = initializeApp(config);
  const persistenceFor = (
    firebaseAuthModule as unknown as {
      getReactNativePersistence?: (storage: PersistenceStorage) => Persistence;
    }
  ).getReactNativePersistence;
  return persistenceFor && storage
    ? initializeAuth(app, { persistence: persistenceFor(storage) })
    : getAuth(app);
}
