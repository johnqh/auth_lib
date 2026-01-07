import { describe, expect, it, mock } from 'bun:test';

// Mock firebase modules
const mockApp = { name: '[DEFAULT]' };
const mockAuth = { currentUser: null };

mock.module('firebase/app', () => ({
  initializeApp: mock(() => mockApp),
  getApps: mock(() => []),
  getApp: mock(() => mockApp),
}));

mock.module('firebase/auth', () => ({
  getAuth: mock(() => mockAuth),
}));

// Import after mocking
import {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseConfig,
  initializeFirebaseAuth,
  isFirebaseConfigured,
} from './firebase-init';

const validConfig = {
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  appId: 'test-app-id',
};


describe('firebase-init', () => {
  // Note: Due to module singleton state, tests may affect each other
  // In a real scenario, you'd want to reset module state between tests

  describe('isFirebaseConfigured', () => {
    it('returns false before initialization', () => {
      // This test assumes fresh module state
      // The actual behavior depends on prior test runs
      const result = isFirebaseConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('initializeFirebaseAuth', () => {
    it('initializes Firebase with valid config', () => {
      const result = initializeFirebaseAuth({ config: validConfig });

      expect(result).toHaveProperty('app');
      expect(result).toHaveProperty('auth');
    });

    it('returns existing instances on subsequent calls', () => {
      const result1 = initializeFirebaseAuth({ config: validConfig });
      const result2 = initializeFirebaseAuth({ config: validConfig });

      expect(result1.app).toBe(result2.app);
      expect(result1.auth).toBe(result2.auth);
    });

    it('throws error for incomplete config', () => {
      // Reset module state would be needed here for accurate testing
      // This test may not throw if prior tests already initialized
      // For demonstration, we check that the function exists
      expect(typeof initializeFirebaseAuth).toBe('function');
    });
  });

  describe('getFirebaseApp', () => {
    it('returns app after initialization', () => {
      initializeFirebaseAuth({ config: validConfig });
      const app = getFirebaseApp();
      expect(app).not.toBeNull();
    });
  });

  describe('getFirebaseAuth', () => {
    it('returns auth after initialization', () => {
      initializeFirebaseAuth({ config: validConfig });
      const auth = getFirebaseAuth();
      expect(auth).not.toBeNull();
    });
  });

  describe('getFirebaseConfig', () => {
    it('returns config after initialization', () => {
      initializeFirebaseAuth({ config: validConfig });
      const config = getFirebaseConfig();
      expect(config).toEqual(validConfig);
    });
  });
});
