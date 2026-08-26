/**
 * @fileoverview React Native Firebase-aware network client with automatic token
 * refresh and logout handling.
 *
 * Uses @react-native-firebase/auth for token management.
 * Extends RNNetworkClient -- the React Native `NetworkClient` implementation --
 * so it exposes the same parsed `NetworkResponse` contract as the web variant.
 * (It previously extended `RNNetworkService`, whose methods return a raw
 * `fetch` Response, which is not interchangeable with a `NetworkClient`.)
 *
 * Adds:
 * - On 401 (Unauthorized): Force refresh the Firebase token and retry once.
 *   If the refresh yields no token, or the retry is still rejected, the
 *   session is dead and the user is logged out.
 * - On 403 (Forbidden): nothing. 403 is an authorization failure -- the caller
 *   is authenticated but lacks permission -- so the session is left alone and
 *   the error is surfaced for the UI to handle.
 */

import { RNNetworkClient } from '@sudobility/di/rn';
import type { NetworkRequestOptions, NetworkResponse } from '@sudobility/types';
import { getFirebaseAuth } from '../config/firebase-init.native.js';

export interface FirebaseAuthNetworkServiceOptions {
  /** Called when the user is logged out after an unrecoverable 401 */
  onLogout?: () => void;
  /** Called when token refresh fails */
  onTokenRefreshFailed?: (error: Error) => void;
  /** Default request timeout in milliseconds */
  defaultTimeoutMs?: number;
}

/**
 * Get a Firebase ID token, optionally forcing a refresh.
 * Returns an empty string when not authenticated.
 */
async function getAuthToken(forceRefresh = false): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return '';

  try {
    return await user.getIdToken(forceRefresh);
  } catch {
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
  } catch {
    // Ignore sign out errors
  }
}

/**
 * Network client with Firebase authentication support for React Native.
 * Refreshes the token and retries once on 401, logging out only when that
 * recovery fails. A 403 never affects the session.
 */
export class FirebaseAuthNetworkService extends RNNetworkClient {
  private serviceOptions: FirebaseAuthNetworkServiceOptions | undefined;

  constructor(options?: FirebaseAuthNetworkServiceOptions) {
    super(options?.defaultTimeoutMs);
    this.serviceOptions = options;
  }

  /**
   * Inject the Firebase token, retry once on 401, and end the session when
   * that retry cannot succeed.
   *
   * RNNetworkClient throws a NetworkError for non-OK responses, so the status
   * is read off the thrown error rather than a returned response.
   */
  override async request<T = unknown>(
    url: string,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    const headers = { ...options.headers };
    if (!headers['Authorization']) {
      const token = await getAuthToken(false);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      return await super.request<T>(url, { ...options, headers });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        const networkError = error as { status: number; message: string };

        if (networkError.status === 401) {
          const freshToken = await getAuthToken(true);
          if (freshToken) {
            try {
              return await super.request<T>(url, {
                ...options,
                headers: {
                  ...options.headers,
                  Authorization: `Bearer ${freshToken}`,
                },
              });
            } catch (retryError) {
              // A 401 that survives a fresh token is an unrecoverable session.
              if (
                retryError &&
                typeof retryError === 'object' &&
                'status' in retryError &&
                (retryError as { status: number }).status === 401
              ) {
                await logoutUser(this.serviceOptions?.onLogout);
              }
              throw retryError;
            }
          }

          // Refresh produced no token -- the session cannot be recovered.
          this.serviceOptions?.onTokenRefreshFailed?.(
            new Error('Failed to refresh token')
          );
          await logoutUser(this.serviceOptions?.onLogout);
        }
      }

      // 403 and everything else: surface the error, leave the session alone.
      throw error;
    }
  }
}
