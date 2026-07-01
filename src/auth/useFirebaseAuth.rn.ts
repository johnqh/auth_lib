/**
 * @fileoverview Shared Firebase-auth hook — React Native native variant
 * (iOS/Android). Uses `@react-native-firebase/auth` (modular API, lazy-required
 * per house style) plus injected native Google/Apple SDKs. Reached via the
 * `@sudobility/auth_lib/auth-native` subpath (react-native condition).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AuthContextValue,
  type AuthUser,
  DEFAULT_REFRESH_INTERVAL_MS,
  type FirebaseAuthConfig,
} from './types';

/** Loosely-typed native Firebase user (avoids a compile-time RN-firebase dep). */
interface NativeUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

let rnAuthModule: any = null;

function getRnAuth(): any {
  if (!rnAuthModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    rnAuthModule = require('@react-native-firebase/auth');
  }
  return rnAuthModule;
}

function toAuthUser(firebaseUser: NativeUser | null): AuthUser | null {
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
 * Native Firebase auth state + operations. Wrap the returned value in the app's
 * own context provider so `useAuth()` keeps app-local context identity.
 */
export function useFirebaseAuthNative(
  config: FirebaseAuthConfig
): AuthContextValue {
  const configRef = useRef(config);
  configRef.current = config;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [rawUser, setRawUser] = useState<NativeUser | null>(null);
  const prevUidRef = useRef<string | null>(null);

  useEffect(() => {
    const { getAuth, onAuthStateChanged, signInAnonymously } = getRnAuth();
    const auth = getAuth();
    configRef.current.onInit?.();

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: NativeUser | null) => {
        if (!firebaseUser && configRef.current.autoSignInAnonymously) {
          try {
            await signInAnonymously(auth);
          } catch (error) {
            console.error('[Auth] Anonymous sign-in failed:', error);
            setIsLoading(false);
            setIsReady(true);
          }
          return;
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
      }
    );

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

  const requireProvider = useCallback(
    (name: keyof NonNullable<FirebaseAuthConfig['providers']>) => {
      const providers = configRef.current.providers;
      const enabledByDefault = name === 'google' || name === 'emailPassword';
      const enabled = providers ? (providers[name] ?? false) : enabledByDefault;
      if (!enabled) throw new Error(`${name} sign-in is not enabled`);
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    requireProvider('google');
    const cfg = configRef.current;
    if (!cfg.getGoogleSignin)
      throw new Error('Google sign-in requires getGoogleSignin config');
    setIsLoading(true);
    try {
      const GoogleSignin = await cfg.getGoogleSignin();
      // Pass only non-empty client ids. When omitted, the native SDK reads them
      // from GoogleService-Info.plist (iOS) / google-services.json (Android);
      // passing an empty string would override that and break configuration.
      const googleConfig: { iosClientId?: string; webClientId?: string } = {};
      if (cfg.googleNative?.iosClientId) {
        googleConfig.iosClientId = cfg.googleNative.iosClientId;
      }
      if (cfg.googleNative?.webClientId) {
        googleConfig.webClientId = cfg.googleNative.webClientId;
      }
      GoogleSignin.configure(googleConfig);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return;
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('No ID token from Google');
      const { getAuth, GoogleAuthProvider, signInWithCredential } = getRnAuth();
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), credential);
    } finally {
      setIsLoading(false);
    }
  }, [requireProvider]);

  const signInWithApple = useCallback(async () => {
    requireProvider('apple');
    const cfg = configRef.current;
    setIsLoading(true);
    try {
      const {
        getAuth,
        AppleAuthProvider,
        OAuthProvider,
        signInWithCredential,
      } = getRnAuth();
      if (cfg.getAppleAuthAndroid && cfg.appleAndroid) {
        const appleAuthAndroid = await cfg.getAppleAuthAndroid();
        if (!appleAuthAndroid.isSupported)
          throw new Error('Apple sign-in is not supported on this device');
        appleAuthAndroid.configure({
          clientId: cfg.appleAndroid.serviceId,
          redirectUri: cfg.appleAndroid.redirectUri,
          responseType: appleAuthAndroid.ResponseType.ALL,
          scope: appleAuthAndroid.Scope.ALL,
        });
        const response = await appleAuthAndroid.signIn();
        if (!response.id_token) throw new Error('No identity token from Apple');
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: response.id_token,
          rawNonce: response.nonce,
        });
        await signInWithCredential(getAuth(), credential);
        return;
      }
      if (!cfg.getAppleAuth)
        throw new Error(
          'Apple sign-in requires getAppleAuth (iOS) or getAppleAuthAndroid config'
        );
      const appleAuth = await cfg.getAppleAuth();
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      if (!response.identityToken)
        throw new Error('No identity token from Apple');
      const credential = AppleAuthProvider.credential(
        response.identityToken,
        response.nonce
      );
      await signInWithCredential(getAuth(), credential);
    } finally {
      setIsLoading(false);
    }
  }, [requireProvider]);

  const signInAnonymously = useCallback(async () => {
    requireProvider('anonymous');
    setIsLoading(true);
    try {
      const { getAuth, signInAnonymously: rnSignInAnonymously } = getRnAuth();
      await rnSignInAnonymously(getAuth());
    } finally {
      setIsLoading(false);
    }
  }, [requireProvider]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      requireProvider('emailPassword');
      setIsLoading(true);
      try {
        const { getAuth, signInWithEmailAndPassword } = getRnAuth();
        await signInWithEmailAndPassword(getAuth(), email, password);
      } finally {
        setIsLoading(false);
      }
    },
    [requireProvider]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      requireProvider('emailPassword');
      setIsLoading(true);
      try {
        const { getAuth, createUserWithEmailAndPassword } = getRnAuth();
        await createUserWithEmailAndPassword(getAuth(), email, password);
      } finally {
        setIsLoading(false);
      }
    },
    [requireProvider]
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      const { getAuth, signOut: rnSignOut } = getRnAuth();
      await rnSignOut(getAuth());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    const { getAuth, sendPasswordResetEmail: rnSendReset } = getRnAuth();
    await rnSendReset(getAuth(), email);
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
