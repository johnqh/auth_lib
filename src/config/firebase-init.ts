/**
 * @fileoverview Configurable Firebase initialization
 *
 * Note: This module expects Firebase to be initialized by @sudobility/di_web
 * before calling initializeFirebaseAuth(). It uses the existing Firebase app
 * instance rather than creating a new one.
 */

import { type FirebaseApp, getApp, getApps } from 'firebase/app';
import { type Auth, getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseService } from '@sudobility/di_web';
import type { FirebaseInitResult } from './types';

// Singleton state
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

/**
 * Check if Firebase app is initialized
 */
export function isFirebaseConfigured(): boolean {
  return getApps().length > 0;
}

/**
 * Initialize Firebase Auth using the existing Firebase app.
 *
 * IMPORTANT: This requires Firebase to be initialized first by @sudobility/di_web.
 * Call initializeWebApp() from di_web before calling this function.
 *
 * @returns Firebase app and auth instances
 * @throws Error if Firebase app is not initialized
 */
export function initializeFirebaseAuth(): FirebaseInitResult {
  // Check if already initialized
  if (firebaseApp && firebaseAuth) {
    return { app: firebaseApp, auth: firebaseAuth };
  }

  // Get the existing Firebase app (initialized by di_web)
  if (getApps().length === 0) {
    throw new Error(
      '[auth_lib] Firebase app not initialized. Call initializeWebApp() from @sudobility/di_web first.'
    );
  }

  firebaseApp = getApp();

  // Initialize Firebase Auth
  firebaseAuth = getAuth(firebaseApp);

  // Set up analytics user tracking on auth state changes
  onAuthStateChanged(firebaseAuth, user => {
    try {
      const firebaseService = getFirebaseService();
      if (user) {
        // User signed in - set analytics user ID (will be hashed by the service)
        firebaseService.analytics.setUserId(user.uid);
      }
      // Note: We don't clear user ID on sign out as Firebase Analytics
      // handles this automatically and it helps with session continuity
    } catch {
      // Firebase service may not be initialized yet, ignore silently
    }
  });

  return { app: firebaseApp, auth: firebaseAuth };
}

/**
 * Get the Firebase app instance.
 * Must call initializeFirebaseAuth() first.
 *
 * @returns Firebase app instance or null if not initialized
 */
export function getFirebaseApp(): FirebaseApp | null {
  return firebaseApp;
}

/**
 * Get the Firebase auth instance.
 * Must call initializeFirebaseAuth() first.
 *
 * @returns Firebase auth instance or null if not initialized
 */
export function getFirebaseAuth(): Auth | null {
  return firebaseAuth;
}
