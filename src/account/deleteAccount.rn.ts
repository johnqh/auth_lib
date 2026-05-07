/**
 * @fileoverview Account deletion for React Native (@react-native-firebase).
 *
 * Calls the backend DELETE endpoint, then signs out locally.
 */

import type { NetworkClient } from '@sudobility/types';
import { getFirebaseAuth } from '../config/firebase-init.rn';

/** Options for the deleteAccount function */
export interface DeleteAccountOptions {
  /** Authenticated network client (auto-injects Bearer token) */
  networkClient: NetworkClient;
  /** API base URL (e.g., https://api.sudojo.com) */
  baseUrl: string;
  /** Firebase UID of the user to delete */
  userId: string;
  /** Optional OAuth provider tokens for server-side revocation */
  providerTokens?: {
    googleAccessToken?: string;
    appleAuthorizationCode?: string;
  };
}

/** Error response shape from the API */
interface ApiErrorResponse {
  success: false;
  error: string;
}

/**
 * Delete the current user's account.
 *
 * 1. Calls DELETE /api/v1/users/:userId on the backend
 * 2. Backend checks subscription, marks account as deleted, revokes tokens, deletes Firebase user
 * 3. Signs out locally on success
 *
 * @throws Error if the backend rejects the request (e.g., active subscription)
 */
export async function deleteAccount(
  options: DeleteAccountOptions
): Promise<void> {
  const { networkClient, baseUrl, userId, providerTokens } = options;

  const response = await networkClient.request<ApiErrorResponse>(
    `${baseUrl}/api/v1/users/${userId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerTokens ?? {}),
    }
  );

  if (!response.ok) {
    const message =
      response.data?.error ?? `Failed to delete account (${response.status})`;
    throw new Error(message);
  }

  // Sign out locally via React Native Firebase
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { signOut } = require('@react-native-firebase/auth');
      await signOut(auth);
    } catch {
      // Firebase user is already deleted on the server, ignore sign-out errors
    }
  }
}
