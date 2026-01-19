/**
 * @fileoverview Configurable Firebase initialization
 */

import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseService } from '@sudobility/di';
import type {
  FirebaseConfig,
  FirebaseInitOptions,
  FirebaseInitResult,
} from './types';

// Singleton state
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseConfig: FirebaseConfig | null = null;

/**
 * Check if Firebase is configured with the required fields
 */
export function isFirebaseConfigured(): boolean {
  if (!firebaseConfig) return false;
  const requiredFields: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'appId',
  ];
  return requiredFields.every(field => !!firebaseConfig?.[field]);
}

/**
 * Initialize Firebase Auth with the provided configuration.
 * This should be called once at app startup (e.g., in main.tsx).
 *
 * @param options - Firebase initialization options
 * @returns Firebase app and auth instances
 * @throws Error if Firebase is already initialized with different config
 */
export function initializeFirebaseAuth(
  options: FirebaseInitOptions
): FirebaseInitResult {
  const { config } = options;

  // Store the config
  firebaseConfig = config;

  // Check if already initialized
  if (firebaseApp && firebaseAuth) {
    return { app: firebaseApp, auth: firebaseAuth };
  }

  // Validate configuration
  if (!isFirebaseConfigured()) {
    throw new Error(
      '[auth_lib] Firebase configuration is incomplete. Required fields: apiKey, authDomain, projectId, appId'
    );
  }

  // Initialize Firebase app (avoid duplicate initialization)
  firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();

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

/**
 * Get the current Firebase configuration.
 *
 * @returns Firebase config or null if not initialized
 */
export function getFirebaseConfig(): FirebaseConfig | null {
  return firebaseConfig;
}
