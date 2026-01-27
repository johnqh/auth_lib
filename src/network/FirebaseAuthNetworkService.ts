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
    await signOut(auth);
    onLogout?.();
  } catch (err) {
    console.error('[FirebaseAuthNetworkService] Failed to sign out:', err);
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
   */
  override async request<T = unknown>(
    url: string,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    const response = await super.request<T>(url, options);

    // On 401, get fresh token and retry once
    if (response.status === 401) {
      const freshToken = await getAuthToken(true);
      if (freshToken) {
        const retryHeaders = {
          ...options.headers,
          Authorization: `Bearer ${freshToken}`,
        };
        return super.request<T>(url, {
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
