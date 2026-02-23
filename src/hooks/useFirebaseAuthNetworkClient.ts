/**
 * @fileoverview Hook to provide a resilient network client with automatic token refresh and logout handling.
 *
 * - On 401 (Unauthorized): Force refresh Firebase token and retry once
 * - On 403 (Forbidden): Log the user out
 */

import { useMemo } from 'react';
import { getNetworkService } from '@sudobility/di';
import { signOut } from 'firebase/auth';
import type {
  NetworkClient,
  NetworkRequestOptions,
  NetworkResponse,
  Optional,
} from '@sudobility/types';
import { getFirebaseAuth } from '../config/firebase-init';
import type { FirebaseAuthNetworkClientOptions } from '../config/types';

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
    console.error(
      '[useFirebaseAuthNetworkClient] Failed to get ID token:',
      err
    );
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
    console.error('[useFirebaseAuthNetworkClient] Failed to sign out:', err);
  }
}

/**
 * Create a network client adapter that wraps a platform network
 * with 401 retry and 403 logout handling.
 *
 * @param platformNetwork - The underlying network service to wrap (optional, defaults to getNetworkService())
 * @param options - Optional callbacks for logout and token refresh failure
 */
export function createFirebaseAuthNetworkClient(
  platformNetwork?: {
    request: (url: string, options?: RequestInit) => Promise<Response>;
  },
  options?: FirebaseAuthNetworkClientOptions
): NetworkClient {
  const network = platformNetwork ?? getNetworkService();

  const parseResponse = async <T>(
    response: Response
  ): Promise<NetworkResponse<T>> => {
    let data: T | undefined;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        data = (await response.json()) as T;
      } catch {
        // JSON parse failed, leave data undefined
      }
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers,
      data,
      success: response.ok,
      timestamp: new Date().toISOString(),
    };
  };

  /**
   * Inject Firebase auth token into request headers if available and not already set.
   */
  const injectAuthToken = async (
    requestInit: RequestInit
  ): Promise<RequestInit> => {
    const headers = (requestInit.headers as Record<string, string>) ?? {};
    if (!headers['Authorization']) {
      const token = await getAuthToken(false);
      if (token) {
        return {
          ...requestInit,
          headers: { ...headers, Authorization: `Bearer ${token}` },
        };
      }
    }
    return requestInit;
  };

  /**
   * Execute request with retry logic:
   * - Auto-inject Firebase auth token on every request
   * - On 401: Force refresh token and retry once
   * - On 403: Log user out (no retry)
   */
  const executeWithRetry = async <T>(
    url: string,
    requestInit: RequestInit
  ): Promise<NetworkResponse<T>> => {
    const authedInit = await injectAuthToken(requestInit);
    const response = await network.request(url, authedInit);

    // On 401, get fresh token and retry once
    if (response.status === 401) {
      const freshToken = await getAuthToken(true);
      if (freshToken) {
        const retryHeaders = {
          ...(requestInit.headers as Record<string, string>),
          Authorization: `Bearer ${freshToken}`,
        };
        const retryResponse = await network.request(url, {
          ...requestInit,
          headers: retryHeaders,
        });
        return parseResponse<T>(retryResponse);
      } else {
        // Token refresh failed
        options?.onTokenRefreshFailed?.(new Error('Failed to refresh token'));
      }
    }

    // On 403, log the user out
    if (response.status === 403) {
      console.warn(
        '[useFirebaseAuthNetworkClient] 403 Forbidden - logging user out'
      );
      await logoutUser(options?.onLogout);
      // Return the original response so the UI can handle it
    }

    return parseResponse<T>(response);
  };

  return {
    async request<T>(
      url: string,
      reqOptions?: Optional<NetworkRequestOptions>
    ): Promise<NetworkResponse<T>> {
      const requestInit: RequestInit = {
        method: reqOptions?.method ?? 'GET',
      };
      if (reqOptions?.headers) requestInit.headers = reqOptions.headers;
      if (reqOptions?.body) requestInit.body = reqOptions.body;
      if (reqOptions?.signal) requestInit.signal = reqOptions.signal;
      return executeWithRetry<T>(url, requestInit);
    },

    async get<T>(
      url: string,
      reqOptions?: Optional<Omit<NetworkRequestOptions, 'method' | 'body'>>
    ): Promise<NetworkResponse<T>> {
      const requestInit: RequestInit = {
        method: 'GET',
      };
      if (reqOptions?.headers) requestInit.headers = reqOptions.headers;
      if (reqOptions?.signal) requestInit.signal = reqOptions.signal;
      return executeWithRetry<T>(url, requestInit);
    },

    async post<T>(
      url: string,
      body?: Optional<unknown>,
      reqOptions?: Optional<Omit<NetworkRequestOptions, 'method'>>
    ): Promise<NetworkResponse<T>> {
      const requestInit: RequestInit = {
        method: 'POST',
      };
      if (reqOptions?.headers) requestInit.headers = reqOptions.headers;
      if (body) requestInit.body = JSON.stringify(body);
      if (reqOptions?.signal) requestInit.signal = reqOptions.signal;
      return executeWithRetry<T>(url, requestInit);
    },

    async put<T>(
      url: string,
      body?: Optional<unknown>,
      reqOptions?: Optional<Omit<NetworkRequestOptions, 'method'>>
    ): Promise<NetworkResponse<T>> {
      const requestInit: RequestInit = {
        method: 'PUT',
      };
      if (reqOptions?.headers) requestInit.headers = reqOptions.headers;
      if (body) requestInit.body = JSON.stringify(body);
      if (reqOptions?.signal) requestInit.signal = reqOptions.signal;
      return executeWithRetry<T>(url, requestInit);
    },

    async delete<T>(
      url: string,
      reqOptions?: Optional<Omit<NetworkRequestOptions, 'method' | 'body'>>
    ): Promise<NetworkResponse<T>> {
      const requestInit: RequestInit = {
        method: 'DELETE',
      };
      if (reqOptions?.headers) requestInit.headers = reqOptions.headers;
      if (reqOptions?.signal) requestInit.signal = reqOptions.signal;
      return executeWithRetry<T>(url, requestInit);
    },
  };
}

/**
 * Hook to get a Firebase Auth network client with automatic 401 retry and 403 logout.
 *
 * @param options - Optional callbacks for logout and token refresh failure
 * @returns NetworkClient instance
 */
export function useFirebaseAuthNetworkClient(
  options?: FirebaseAuthNetworkClientOptions
): NetworkClient {
  return useMemo(
    () => createFirebaseAuthNetworkClient(undefined, options),
    [options]
  );
}
