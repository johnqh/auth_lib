/**
 * @fileoverview React Native Firebase initialization
 * Uses @react-native-firebase which is configured via native files
 */

import { getAnalyticsClient } from '@sudobility/di/rn';
import type { FirebaseInitResult } from './types.js';

// Types for lazy-loaded RN Firebase modules

type RNFirebaseAuth = any;

type RNFirebaseApp = any;

// Module state
let firebaseAuth: RNFirebaseAuth | null = null;
let firebaseApp: RNFirebaseApp | null = null;
let initialized = false;

/**
 * Lazily load @react-native-firebase/auth
 */
function getAuthModule(): RNFirebaseAuth | null {
  if (!firebaseAuth) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const authModule = require('@react-native-firebase/auth');
      firebaseAuth = authModule.default ? authModule.default() : authModule();
    } catch (e) {
      console.warn('[auth_lib] @react-native-firebase/auth not available:', e);
    }
  }
  return firebaseAuth;
}

/**
 * Lazily load @react-native-firebase/app
 */
function getAppModule(): RNFirebaseApp | null {
  if (!firebaseApp) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const appModule = require('@react-native-firebase/app');
      firebaseApp = appModule.default ? appModule.default() : appModule;
    } catch (e) {
      console.warn('[auth_lib] @react-native-firebase/app not available:', e);
    }
  }
  return firebaseApp;
}

/**
 * Check if Firebase is configured (always true for RN since it's native config)
 */
export function isFirebaseConfigured(): boolean {
  return getAppModule() !== null;
}

/**
 * Initialize Firebase Auth for React Native.
 * Note: Firebase is configured via native files (google-services.json / GoogleService-Info.plist).
 *
 * @returns Firebase app and auth instances
 */
export function initializeFirebaseAuth(): FirebaseInitResult {
  // Get the RN Firebase modules
  const app = getAppModule();
  const auth = getAuthModule();

  if (!app || !auth) {
    throw new Error(
      '[auth_lib] React Native Firebase is not available. Make sure @react-native-firebase/app and @react-native-firebase/auth are installed.'
    );
  }

  // Set up analytics user tracking on auth state changes
  if (!initialized) {
    auth.onAuthStateChanged((user: { uid: string } | null) => {
      try {
        const analyticsClient = getAnalyticsClient();
        if (user) {
          // User signed in - set analytics user ID (will be hashed by the service)
          analyticsClient.setUserId(user.uid);
        }
        // Note: We don't clear user ID on sign out as Firebase Analytics
        // handles this automatically and it helps with session continuity
      } catch {
        // Analytics client may not be initialized yet, ignore silently
      }
    });
    initialized = true;
  }

  // Return the instances (types are any for RN compatibility)
  return { app, auth } as FirebaseInitResult;
}

/**
 * Get the Firebase app instance.
 * @returns Firebase app instance or null if not available
 */
export function getFirebaseApp(): RNFirebaseApp | null {
  return getAppModule();
}

/**
 * Get the Firebase auth instance.
 * @returns Firebase auth instance or null if not available
 */
export function getFirebaseAuth(): RNFirebaseAuth | null {
  return getAuthModule();
}
