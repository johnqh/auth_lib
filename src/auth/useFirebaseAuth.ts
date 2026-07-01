/**
 * @fileoverview Shared Firebase-auth hook — JS-SDK variant (desktop/web/macOS/
 * Windows). Mirrors the copied desktop `AuthContext` implementations from the
 * app fleet, parameterized by {@link FirebaseAuthConfig}. Reached only via the
 * `@sudobility/auth_lib/auth-js` subpath (no `react-native` export condition) so
 * macOS/Windows resolve this JS build instead of the native one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  getAuth,
  // @ts-expect-error – getReactNativePersistence is exported at runtime
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { signInWithGoogleOAuthDesktop } from '../oauth/google';
import { buildAppleCredential } from '../oauth/credentials';
import {
  type AuthContextValue,
  type AuthUser,
  DEFAULT_REFRESH_INTERVAL_MS,
  type FirebaseAuthConfig,
} from './types';

let app: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

function resolveAuth(config: FirebaseAuthConfig): Auth | null {
  const firebaseConfig = config.firebaseConfig;
  if (!firebaseConfig || !firebaseConfig.apiKey) return null;
  if (!firebaseAuth) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
    firebaseAuth = config.asyncStorage
      ? initializeAuth(app, {
          persistence: getReactNativePersistence(config.asyncStorage),
        })
      : getAuth(app);
  }
  return firebaseAuth;
}

function toAuthUser(firebaseUser: User | null): AuthUser | null {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    isAnonymous: firebaseUser.isAnonymous,
  };
}

/**
 * JS-SDK Firebase auth state + operations. Wrap the returned value in the app's
 * own context provider so `useAuth()` keeps app-local context identity.
 */
export function useFirebaseAuthJs(
  config: FirebaseAuthConfig
): AuthContextValue {
  const configRef = useRef(config);
  configRef.current = config;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [rawUser, setRawUser] = useState<User | null>(null);
  const prevUidRef = useRef<string | null>(null);

  useEffect(() => {
    const cfg = configRef.current;
    const auth = resolveAuth(cfg);
    cfg.onInit?.();
    if (!auth) {
      setIsLoading(false);
      setIsReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser && configRef.current.autoSignInAnonymously) {
        try {
          await firebaseSignInAnonymously(auth);
        } catch (error) {
          console.error('[Auth] Anonymous sign-in failed:', error);
          setIsLoading(false);
          setIsReady(true);
        }
        return; // listener re-fires with the anonymous user
      }

      const mapped = toAuthUser(firebaseUser);
      const nextUid = mapped?.uid ?? null;
      if (prevUidRef.current !== nextUid) {
        configRef.current.onIdentityChange?.(prevUidRef.current, nextUid);
        prevUidRef.current = nextUid;
      }

      setUser(mapped);
      setRawUser(firebaseUser);
      configRef.current.onUserChanged?.(mapped);

      if (firebaseUser) {
        try {
          setToken(await firebaseUser.getIdToken());
        } catch (error) {
          console.error('[Auth] Error getting ID token:', error);
          setToken(null);
        }
      } else {
        setToken(null);
      }

      setIsLoading(false);
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const intervalMs = configRef.current.refreshIntervalMs;
    if (!rawUser || intervalMs === null) return;
    const refreshInterval = setInterval(async () => {
      try {
        setToken(await rawUser.getIdToken(true));
      } catch (error) {
        console.error('[Auth] Error refreshing token:', error);
      }
    }, intervalMs ?? DEFAULT_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshInterval);
  }, [rawUser]);

  const requireAuth = useCallback((): Auth => {
    const auth = resolveAuth(configRef.current);
    if (!auth) throw new Error('Firebase not configured');
    return auth;
  }, []);

  const requireProvider = useCallback(
    (name: keyof NonNullable<FirebaseAuthConfig['providers']>) => {
      const providers = configRef.current.providers;
      // Default-on for google + emailPassword to match the fleet's base behavior.
      const enabledByDefault = name === 'google' || name === 'emailPassword';
      const enabled = providers ? (providers[name] ?? false) : enabledByDefault;
      if (!enabled) throw new Error(`${name} sign-in is not enabled`);
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    requireProvider('google');
    const auth = requireAuth();
    const cfg = configRef.current;
    if (!cfg.googleOAuth || !cfg.webAuth) {
      throw new Error(
        'Google desktop sign-in requires googleOAuth + webAuth config'
      );
    }
    setIsLoading(true);
    try {
      const credential = await signInWithGoogleOAuthDesktop(
        cfg.googleOAuth,
        cfg.webAuth
      );
      if (credential) await signInWithCredential(auth, credential);
    } finally {
      setIsLoading(false);
    }
  }, [requireAuth, requireProvider]);

  const signInWithApple = useCallback(async () => {
    requireProvider('apple');
    const auth = requireAuth();
    const cfg = configRef.current;
    if (!cfg.getAppleAuth)
      throw new Error('Apple sign-in requires getAppleAuth config');
    setIsLoading(true);
    try {
      const appleAuth = await cfg.getAppleAuth();
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      if (!response.identityToken)
        throw new Error('No identity token from Apple');
      const credential = buildAppleCredential({
        idToken: response.identityToken,
        rawNonce: response.nonce,
      });
      await signInWithCredential(auth, credential);
    } finally {
      setIsLoading(false);
    }
  }, [requireAuth, requireProvider]);

  const signInAnonymously = useCallback(async () => {
    requireProvider('anonymous');
    const auth = requireAuth();
    setIsLoading(true);
    try {
      await firebaseSignInAnonymously(auth);
    } finally {
      setIsLoading(false);
    }
  }, [requireAuth, requireProvider]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      requireProvider('emailPassword');
      const auth = requireAuth();
      setIsLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } finally {
        setIsLoading(false);
      }
    },
    [requireAuth, requireProvider]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      requireProvider('emailPassword');
      const auth = requireAuth();
      setIsLoading(true);
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } finally {
        setIsLoading(false);
      }
    },
    [requireAuth, requireProvider]
  );

  const signOut = useCallback(async () => {
    const auth = resolveAuth(configRef.current);
    if (!auth) return;
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    const auth = resolveAuth(configRef.current);
    if (!auth) throw new Error('Firebase not configured');
    await firebaseSendPasswordResetEmail(auth, email);
  }, []);

  const getToken = useCallback(async () => {
    if (!rawUser) return null;
    try {
      return await rawUser.getIdToken();
    } catch (error) {
      console.error('[Auth] Error getting token:', error);
      return null;
    }
  }, [rawUser]);

  const refreshToken = useCallback(async () => {
    if (!rawUser) return null;
    try {
      const newToken = await rawUser.getIdToken(true);
      setToken(newToken);
      return newToken;
    } catch (error) {
      console.error('[Auth] Error refreshing token:', error);
      return null;
    }
  }, [rawUser]);

  return useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isReady,
      token,
      signInWithGoogle,
      signInWithApple,
      signInAnonymously,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      sendPasswordResetEmail,
      getToken,
      refreshToken,
    }),
    [
      user,
      isLoading,
      isReady,
      token,
      signInWithGoogle,
      signInWithApple,
      signInAnonymously,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      sendPasswordResetEmail,
      getToken,
      refreshToken,
    ]
  );
}
