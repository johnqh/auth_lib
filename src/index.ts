/**
 * @fileoverview @sudobility/auth_lib - Firebase authentication utilities
 *
 * This library provides:
 * - Configurable Firebase Auth initialization
 * - Network client with automatic 401 token refresh and 403 logout handling
 * - Firebase error message utilities
 */

// Reverse-proxy shim for regions where googleapis.com is blocked.
// AUTOMATIC: self-configures routing on library import (cached verdict /
// China-timezone heuristic instantly, then a reachability probe confirms).
// Kept as the FIRST import so the fetch patch is in place before any module
// that loads firebase/auth. Opt out with
// globalThis.__SUDOBILITY_FIREBASE_PROXY_DISABLED = true before importing.
import './config/firebase-proxy-auto';

// Config
export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './config';

export {
  installFirebaseProxy,
  forceFirebaseProxy,
  disableFirebaseProxy,
  autoConfigureFirebaseProxy,
  isFirebaseReachable,
  isLikelyChinaRegion,
  rewriteFirebaseProxyUrl,
  getFirebaseProxyOrigin,
  DEFAULT_FIREBASE_PROXY_ORIGIN,
  type AutoConfigureFirebaseProxyOptions,
} from './config';

export { filterAuthProvidersForProxy } from './config';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './config';

// Hooks
export {
  useFirebaseAuthNetworkClient,
  createFirebaseAuthNetworkClient,
  useProxyFilteredAuthProviders,
} from './hooks';

export {
  useSiteAdmin,
  siteAdminQueryKey,
  type UseSiteAdminOptions,
  type UseSiteAdminResult,
  type UserInfoResponse,
} from './hooks';

// Utils
export {
  getFirebaseErrorMessage,
  getFirebaseErrorCode,
  formatFirebaseError,
  isFirebaseAuthError,
} from './utils';

// Network
export {
  FirebaseAuthNetworkService,
  type FirebaseAuthNetworkServiceOptions,
} from './network';

// Account management
export { deleteAccount, type DeleteAccountOptions } from './account';

// Admin
export { parseAdminEmails, isAdminEmail, createAdminChecker } from './admin';
