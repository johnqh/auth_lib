/**
 * @fileoverview React Native Firebase initialization
 * Uses @react-native-firebase modular API configured via native files
 */

import { getAnalyticsClient } from '@sudobility/di/rn';
import type { FirebaseInitResult } from './types.js';

// Module state
let firebaseAuth: any | null = null;
let firebaseApp: any | null = null;
let initialized = false;

/**
 * Lazily load @react-native-firebase/auth using modular API
 */
function getAuthModule(): any | null {
  if (!firebaseAuth) {
    try {
      const { getAuth } = require('@react-native-firebase/auth');
      firebaseAuth = getAuth();
    } catch (e) {
      console.warn('[auth_lib] @react-native-firebase/auth not available:', e);
    }
  }
  return firebaseAuth;
}

/**
 * Lazily load @react-native-firebase/app using modular API
 */
function getAppModule(): any | null {
  if (!firebaseApp) {
    try {
      const { getApp } = require('@react-native-firebase/app');
      firebaseApp = getApp();
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
    const { onAuthStateChanged } = require('@react-native-firebase/auth');
    onAuthStateChanged(auth, (user: { uid: string } | null) => {
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
export function getFirebaseApp(): any | null {
  return getAppModule();
}

/**
 * Get the Firebase auth instance.
 * @returns Firebase auth instance or null if not available
 */
export function getFirebaseAuth(): any | null {
  return getAuthModule();
}
