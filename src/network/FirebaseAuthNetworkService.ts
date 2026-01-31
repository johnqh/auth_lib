/**
 * @fileoverview Firebase-aware network client with automatic token refresh and logout handling.
 *
 * Extends WebNetworkClient to add:
 * - On 401 (Unauthorized): Force refresh Firebase token and retry once
 * - On 403 (Forbidden): Log the user out
 */

import { WebNetworkClient } from '@sudobility/di';
import type { NetworkRequestOptions, NetworkResponse } from '@sudobility/types';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../config/firebase-init';

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
    await signOut(auth);
    onLogout?.();
  } catch {
    // Ignore sign out errors
  }
}

/**
 * Network client with Firebase authentication support.
 * Implements NetworkClient interface with automatic token refresh on 401 and logout on 403.
 */
export class FirebaseAuthNetworkService extends WebNetworkClient {
  private serviceOptions: FirebaseAuthNetworkServiceOptions | undefined;

  constructor(options?: FirebaseAuthNetworkServiceOptions) {
    super();
    this.serviceOptions = options;
  }

  /**
   * Override request to add 401 retry and 403 logout handling.
   * Note: WebNetworkClient throws NetworkError for non-OK responses,
   * so we catch errors and check the status code.
   */
  override async request<T = unknown>(
    url: string,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    try {
      return await super.request<T>(url, options);
    } catch (error) {
      // Check if this is a NetworkError with a status code we handle
      // NetworkError from @sudobility/types has 'status' property (not 'statusCode')
      if (error && typeof error === 'object' && 'status' in error) {
        const networkError = error as { status: number; message: string };

        // On 401, get fresh token and retry once
        if (networkError.status === 401) {
          const freshToken = await getAuthToken(true);
          if (freshToken) {
            const retryHeaders = {
              ...options.headers,
              Authorization: `Bearer ${freshToken}`,
            };
            return await super.request<T>(url, {
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
        if (networkError.status === 403) {
          await logoutUser(this.serviceOptions?.onLogout);
        }
      }

      // Re-throw the original error
      throw error;
    }
  }
}
