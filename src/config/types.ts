/**
 * @fileoverview Type definitions for auth_lib
 */

import type { Auth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

/**
 * Firebase configuration object
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

/**
 * Options for initializing Firebase Auth
 */
export interface FirebaseInitOptions {
  /** Firebase configuration */
  config: FirebaseConfig;
}

/**
 * Result of Firebase initialization
 */
export interface FirebaseInitResult {
  app: FirebaseApp;
  auth: Auth;
}

/**
 * Options for the Firebase Auth network client hook
 */
export interface FirebaseAuthNetworkClientOptions {
  /** Callback when user is logged out due to 403 */
  onLogout?: () => void;
  /** Callback when token refresh fails */
  onTokenRefreshFailed?: (error: unknown) => void;
}
