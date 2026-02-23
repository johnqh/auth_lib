/**
 * @fileoverview Firebase-aware network client with automatic token refresh and logout handling.
 *
 * Extends WebNetworkClient to add:
 * - On 401 (Unauthorized): Force refresh Firebase token and retry once
 */

import { WebNetworkClient } from '@sudobility/di';
import type { NetworkRequestOptions, NetworkResponse } from '@sudobility/types';
import { getFirebaseAuth } from '../config/firebase-init';

/** Default token refresh interval in milliseconds (30 seconds) */
const DEFAULT_TOKEN_REFRESH_INTERVAL_MS = 30 * 1000;

export interface FirebaseAuthNetworkServiceOptions {
  /** Called when user is logged out */
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
 * Network client with Firebase authentication support.
 * Implements NetworkClient interface with automatic token refresh on 401.
 */
export class FirebaseAuthNetworkService extends WebNetworkClient {
  private serviceOptions: FirebaseAuthNetworkServiceOptions | undefined;

  constructor(options?: FirebaseAuthNetworkServiceOptions) {
    super();
    this.serviceOptions = options;
  }

  /**
   * Override request to automatically inject Firebase auth token
   * and add 401 retry with token refresh.
   * Note: WebNetworkClient throws NetworkError for non-OK responses,
   * so we catch errors and check the status code.
   */
  override async request<T = unknown>(
    url: string,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    // Auto-inject Firebase auth token if available and not already set
    const headers = { ...options.headers };
    if (!headers['Authorization']) {
      const token = await getAuthToken(false);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    const optionsWithAuth = { ...options, headers };

    try {
      return await super.request<T>(url, optionsWithAuth);
    } catch (error) {
      // Check if this is a NetworkError with a status code we handle
      // NetworkError from @sudobility/types has 'status' property (not 'statusCode')
      if (error && typeof error === 'object' && 'status' in error) {
        const networkError = error as { status: number; message: string };

        // On 401, get fresh token and retry once
        if (networkError.status === 401) {
          console.error(
            '[FirebaseAuthNetworkService] 401 Unauthorized, attempting token refresh'
          );
          const freshToken = await getAuthToken(true);
          if (freshToken) {
            console.error(
              '[FirebaseAuthNetworkService] Token refreshed, retrying request'
            );
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
              console.error(
                '[FirebaseAuthNetworkService] Retry after token refresh failed:',
                retryError
              );
              throw retryError;
            }
          } else {
            // Token refresh failed
            console.error(
              '[FirebaseAuthNetworkService] Token refresh failed, no fresh token obtained'
            );
            this.serviceOptions?.onTokenRefreshFailed?.(
              new Error('Failed to refresh token')
            );
          }
        }

        // Log other HTTP errors (403 is a permission error, not an auth error — don't log out)
        if (networkError.status !== 401) {
          console.error(
            `[FirebaseAuthNetworkService] HTTP ${networkError.status}:`,
            networkError.message
          );
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
