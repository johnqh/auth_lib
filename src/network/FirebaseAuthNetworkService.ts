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

/** Default token refresh interval in milliseconds (30 seconds) */
const DEFAULT_TOKEN_REFRESH_INTERVAL_MS = 30 * 1000;

export interface FirebaseAuthNetworkServiceOptions {
  /** Called when user is logged out due to 403 */
  onLogout?: () => void;
  /** Called when token refresh fails */
  onTokenRefreshFailed?: (error: Error) => void;
  /** Token refresh interval in milliseconds (default: 30 seconds) */
  tokenRefreshIntervalMs?: number;
}

// Token cache for proactive refresh
let cachedToken: string | null = null;
let tokenTimestamp: number = 0;

/**
 * Get a Firebase ID token, refreshing if stale or forced.
 * Returns empty string if not authenticated.
 *
 * @param forceRefresh - Force refresh regardless of cache
 * @param refreshIntervalMs - Consider token stale after this many milliseconds
 */
async function getAuthToken(
  forceRefresh = false,
  refreshIntervalMs = DEFAULT_TOKEN_REFRESH_INTERVAL_MS
): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) {
    console.error('[FirebaseAuthNetworkService] getAuthToken: No current user');
    cachedToken = null;
    tokenTimestamp = 0;
    return '';
  }

  const now = Date.now();
  const tokenAge = now - tokenTimestamp;
  const isStale = tokenAge > refreshIntervalMs;

  // Return cached token if valid and not forced refresh
  if (!forceRefresh && !isStale && cachedToken) {
    return cachedToken;
  }

  try {
    // Force refresh if stale or explicitly requested
    const shouldForceRefresh = forceRefresh || isStale;
    const token = await user.getIdToken(shouldForceRefresh);
    cachedToken = token;
    tokenTimestamp = now;
    return token;
  } catch (error) {
    console.error('[FirebaseAuthNetworkService] getAuthToken failed:', error);
    cachedToken = null;
    tokenTimestamp = 0;
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
          console.error('[FirebaseAuthNetworkService] 401 Unauthorized, attempting token refresh');
          const freshToken = await getAuthToken(true);
          if (freshToken) {
            console.error('[FirebaseAuthNetworkService] Token refreshed, retrying request');
            const retryHeaders = {
              ...options.headers,
              Authorization: `Bearer ${freshToken}`,
            };
            try {
              return await super.request<T>(url, {
                ...options,
                headers: retryHeaders,
              });
            } catch (retryError) {
              console.error('[FirebaseAuthNetworkService] Retry after token refresh failed:', retryError);
              throw retryError;
            }
          } else {
            // Token refresh failed
            console.error('[FirebaseAuthNetworkService] Token refresh failed, no fresh token obtained');
            this.serviceOptions?.onTokenRefreshFailed?.(
              new Error('Failed to refresh token')
            );
          }
        }

        // On 403, log the user out
        if (networkError.status === 403) {
          console.error('[FirebaseAuthNetworkService] 403 Forbidden, logging user out');
          await logoutUser(this.serviceOptions?.onLogout);
        }

        // Log other HTTP errors
        if (networkError.status !== 401 && networkError.status !== 403) {
          console.error(`[FirebaseAuthNetworkService] HTTP ${networkError.status}:`, networkError.message);
        }
      } else {
        // Non-HTTP error (network failure, timeout, etc.)
        console.error('[FirebaseAuthNetworkService] Network error:', error);
      }

      // Re-throw the original error
      throw error;
    }
  }
}
