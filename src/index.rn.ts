/**
 * @fileoverview @sudobility/auth_lib - Firebase authentication utilities (React Native)
 *
 * This is the React Native entry point that uses @react-native-firebase.
 */

// Reverse-proxy shim for regions where googleapis.com is blocked.
// AUTOMATIC: self-configures on import (JS fetch-level traffic only —
// native @react-native-firebase SDK traffic is not redirected). Opt out
// with globalThis.__SUDOBILITY_FIREBASE_PROXY_DISABLED = true.
import './config/firebase-proxy-auto.native.js';

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
} from './config/firebase-proxy.js';

// Config (RN version)
export {
  initializeFirebaseAuth,
  getFirebaseApp,
  getFirebaseAuth,
  isFirebaseConfigured,
} from './config/firebase-init.native.js';

export type {
  FirebaseInitResult,
  FirebaseAuthNetworkClientOptions,
} from './config/types.js';

// Hooks - these are React hooks that work on both platforms.
// useFirebaseAuthNetworkClient imports firebase-init via a bare path; on React
// Native bundlers (Metro) that resolves to firebase-init.native.ts (the
// @react-native-firebase impl), and on web bundlers to firebase-init.ts. The
// transport comes from @sudobility/di (RN build).
export {
  useFirebaseAuthNetworkClient,
  createFirebaseAuthNetworkClient,
} from './hooks/index.js';

export {
  useSiteAdmin,
  siteAdminQueryKey,
  type UseSiteAdminOptions,
  type UseSiteAdminResult,
  type UserInfoResponse,
} from './hooks/index.js';

// Utils - these are platform-agnostic
export {
  getFirebaseErrorMessage,
  getFirebaseErrorCode,
  formatFirebaseError,
  isFirebaseAuthError,
} from './utils/index.js';

// Network (RN version)
export {
  FirebaseAuthNetworkService,
  type FirebaseAuthNetworkServiceOptions,
} from './network/FirebaseAuthNetworkService.rn.js';

// Account management
export { deleteAccount, type DeleteAccountOptions } from './account/index.js';

// Admin - platform-agnostic
export {
  parseAdminEmails,
  isAdminEmail,
  createAdminChecker,
} from './admin/index.js';
