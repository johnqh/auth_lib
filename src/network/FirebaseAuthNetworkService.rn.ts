/**
 * @fileoverview React Native Firebase-aware network service with automatic token refresh and logout handling.
 *
 * Uses @react-native-firebase/auth for token management.
 * Extends RNNetworkService to add:
 * - On 401 (Unauthorized): Force refresh Firebase token and retry once
 * - On 403 (Forbidden): Log the user out
 */

import { RNNetworkService } from '@sudobility/di/rn';
import { getFirebaseAuth } from '../config/firebase-init.rn.js';

export interface FirebaseAuthNetworkServiceOptions {
  /** Called when user is logged out due to 403 */
  onLogout?: () => void;
  /** Called when token refresh fails */
  onTokenRefreshFailed?: (error: Error) => void;
}

/**
 * Get a fresh Firebase ID token with force refresh.
 * Returns empty string if not authenticated.
 */
async function getAuthToken(forceRefresh = false): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return '';

  try {
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.error('[FirebaseAuthNetworkService] Failed to get ID token:', err);
    return '';
  }
}

/**
 * Log the user out via Firebase.
 */
async function logoutUser(onLogout?: () => void): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await auth.signOut();
    onLogout?.();
  } catch (err) {
    console.error('[FirebaseAuthNetworkService] Failed to sign out:', err);
  }
}

/**
 * Network service with Firebase authentication support for React Native.
 * Automatically refreshes token on 401 and logs out on 403.
 */
export class FirebaseAuthNetworkService extends RNNetworkService {
  private serviceOptions: FirebaseAuthNetworkServiceOptions | undefined;

  constructor(options?: FirebaseAuthNetworkServiceOptions) {
    super();
    this.serviceOptions = options;
  }

  /**
   * Override request to add 401 retry and 403 logout handling.
   */
  override async request(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const response = await super.request(url, options);

    // On 401, get fresh token and retry once
    if (response.status === 401) {
      const freshToken = await getAuthToken(true);
      if (freshToken) {
        const retryHeaders = {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${freshToken}`,
        };
        return super.request(url, {
          ...options,
          headers: retryHeaders,
        });
      } else {
        // Token refresh failed
        this.serviceOptions?.onTokenRefreshFailed?.(
          new Error('Failed to refresh token')
        );
      }
    }

    // On 403, log the user out
    if (response.status === 403) {
      console.warn(
        '[FirebaseAuthNetworkService] 403 Forbidden - logging user out'
      );
      await logoutUser(this.serviceOptions?.onLogout);
      // Return the original response so the UI can handle it
    }

    return response;
  }
}
