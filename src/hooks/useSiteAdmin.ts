/**
 * @fileoverview Hook to check if the current user is a site admin.
 *
 * Fetches user info from the backend API and caches the result using TanStack Query.
 * This provides a single source of truth for site admin status from the backend.
 */

import { useQuery } from '@tanstack/react-query';
import type { NetworkClient, UserInfoResponse } from '@sudobility/types';

// Re-export UserInfoResponse for consumers
export type { UserInfoResponse } from '@sudobility/types';

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Options for useSiteAdmin hook
 */
export interface UseSiteAdminOptions {
  /** Network client for making API requests */
  networkClient: NetworkClient;
  /** Base URL of the API (e.g., "https://api.example.com/api/v1") */
  baseUrl: string;
  /** Firebase user ID */
  userId: string | undefined;
  /** Firebase ID token for authentication */
  token: string | undefined;
  /** Cache time in milliseconds (default: 5 minutes) */
  staleTime?: number;
  /** Whether to enable the query (default: true when userId and token are provided) */
  enabled?: boolean;
}

/**
 * Return type for useSiteAdmin hook
 */
export interface UseSiteAdminResult {
  /** Whether the user is a site admin */
  isSiteAdmin: boolean;
  /** Full user info from the API */
  userInfo: UserInfoResponse | null;
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query has an error */
  isError: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Refetch the user info */
  refetch: () => void;
}

/**
 * Query key for site admin queries
 */
export const siteAdminQueryKey = (userId: string) =>
  ['siteAdmin', userId] as const;

/**
 * Hook to check if the current user is a site admin.
 *
 * Fetches user info from the backend /users/:userId endpoint and caches the result.
 * The backend is the single source of truth for site admin status.
 *
 * @example
 * ```tsx
 * const { isSiteAdmin, isLoading } = useSiteAdmin({
 *   networkClient,
 *   baseUrl: 'https://api.example.com/api/v1',
 *   userId: user?.uid,
 *   token: idToken,
 * });
 *
 * if (isLoading) return <Loading />;
 * if (isSiteAdmin) return <AdminPanel />;
 * ```
 */
export function useSiteAdmin(options: UseSiteAdminOptions): UseSiteAdminResult {
  const {
    networkClient,
    baseUrl,
    userId,
    token,
    staleTime = 5 * 60 * 1000, // 5 minutes default
    enabled,
  } = options;

  const isEnabled = enabled ?? (!!userId && !!token);

  const query = useQuery({
    queryKey: siteAdminQueryKey(userId ?? ''),
    queryFn: async (): Promise<UserInfoResponse | null> => {
      if (!userId || !token) {
        return null;
      }

      const url = `${baseUrl}/users/${userId}`;
      const response = await networkClient.get<ApiResponse<UserInfoResponse>>(
        url,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok || !response.data?.success || !response.data.data) {
        // User not found or not authorized - not an admin
        return null;
      }

      return response.data.data;
    },
    enabled: isEnabled,
    staleTime,
    // Retry once on failure (might be a transient network error)
    retry: 1,
    // Don't refetch on window focus for admin status
    refetchOnWindowFocus: false,
  });

  return {
    isSiteAdmin: query.data?.siteAdmin ?? false,
    userInfo: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
