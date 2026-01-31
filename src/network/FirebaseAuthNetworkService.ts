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
  console.log('[FirebaseAuthNetworkService] getAuthToken called', {
    forceRefresh,
    hasAuth: !!auth,
    hasCurrentUser: !!auth?.currentUser,
    userEmail: auth?.currentUser?.email,
  });

  const user = auth?.currentUser;
  if (!user) {
    console.warn(
      '[FirebaseAuthNetworkService] No currentUser - cannot get token'
    );
    return '';
  }

  try {
    const token = await user.getIdToken(forceRefresh);
    console.log('[FirebaseAuthNetworkService] Got token', {
      forceRefresh,
      tokenLength: token?.length,
      tokenPrefix: `${token?.substring(0, 20)}...`,
    });
    return token;
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
   * Note: WebNetworkClient throws NetworkError for non-OK responses,
   * so we catch errors and check the status code.
   */
  override async request<T = unknown>(
    url: string,
    options: NetworkRequestOptions = {}
  ): Promise<NetworkResponse<T>> {
    // Debug: Log every request
    const urlForLog = url.length > 100 ? `${url.substring(0, 100)}...` : url;
    console.log('[FirebaseAuthNetworkService] request() called', {
      url: urlForLog,
      method: options.method || 'GET',
      hasAuthHeader: !!options.headers?.Authorization,
    });

    try {
      const response = await super.request<T>(url, options);
      console.log('[FirebaseAuthNetworkService] request() succeeded', {
        url: urlForLog,
        status: response.status,
        ok: response.ok,
      });
      return response;
    } catch (error) {
      // Debug: Log the caught error in detail
      console.log('[FirebaseAuthNetworkService] request() caught error', {
        url: urlForLog,
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        hasStatus: error && typeof error === 'object' && 'status' in error,
        status:
          error && typeof error === 'object' && 'status' in error
            ? (error as { status: unknown }).status
            : 'N/A',
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : [],
      });

      // Check if this is a NetworkError with a status code we handle
      // NetworkError from @sudobility/types has 'status' property (not 'statusCode')
      if (error && typeof error === 'object' && 'status' in error) {
        const networkError = error as { status: number; message: string };

        // On 401, get fresh token and retry once
        if (networkError.status === 401) {
          console.log(
            '[FirebaseAuthNetworkService] 401 detected, attempting token refresh...'
          );
          const freshToken = await getAuthToken(true);
          if (freshToken) {
            console.log(
              '[FirebaseAuthNetworkService] Token refreshed successfully, retrying request...'
            );
            const retryHeaders = {
              ...options.headers,
              Authorization: `Bearer ${freshToken}`,
            };
            try {
              const retryResponse = await super.request<T>(url, {
                ...options,
                headers: retryHeaders,
              });
              console.log('[FirebaseAuthNetworkService] Retry succeeded!', {
                status: retryResponse.status,
                ok: retryResponse.ok,
              });
              return retryResponse;
            } catch (retryError) {
              console.error('[FirebaseAuthNetworkService] Retry also failed', {
                errorType: retryError?.constructor?.name,
                errorMessage:
                  retryError instanceof Error
                    ? retryError.message
                    : String(retryError),
              });
              throw retryError;
            }
          } else {
            // Token refresh failed
            console.error(
              '[FirebaseAuthNetworkService] Token refresh failed - no token returned (empty string)'
            );
            this.serviceOptions?.onTokenRefreshFailed?.(
              new Error('Failed to refresh token')
            );
          }
        }

        // On 403, log the user out
        if (networkError.status === 403) {
          console.warn(
            '[FirebaseAuthNetworkService] 403 Forbidden - logging user out'
          );
          await logoutUser(this.serviceOptions?.onLogout);
        }
      } else {
        console.warn(
          '[FirebaseAuthNetworkService] Error does not have status property, cannot handle',
          {
            errorType: error?.constructor?.name,
          }
        );
      }

      // Re-throw the original error
      console.log('[FirebaseAuthNetworkService] Re-throwing original error');
      throw error;
    }
  }
}
