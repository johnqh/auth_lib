# Improvement Plans for @sudobility/auth_lib

## Priority 1 - High Impact

### 1. Export `createFirebaseAuthNetworkClient` from Top-Level ✅ DONE
- Currently only exported from `hooks/index.ts` barrel, not from the main `index.ts` or `index.rn.ts`
- Non-hook consumers (e.g., singletons, config files) can't easily access the factory function
- Add re-export to both entry points

### 2. Add Token Caching to `createFirebaseAuthNetworkClient` ✅ DONE
- `FirebaseAuthNetworkService` has token caching with 5-min TTL
- `createFirebaseAuthNetworkClient` calls `getIdToken()` on every request
- Unify the caching strategy between the two implementations

### 3. Increase Test Coverage ✅ DONE
- Add tests for 401 retry and 403 logout flows in `useFirebaseAuthNetworkClient`
- Test `FirebaseAuthNetworkService` token refresh behavior
- Test RN-specific initialization with `@react-native-firebase`

## Priority 2 - Medium Impact

### 4. Consolidate Network Client Implementations
- `useFirebaseAuthNetworkClient` and `FirebaseAuthNetworkService` have overlapping functionality
- Consider merging into a single implementation with hook and non-hook entry points
- Reduce code duplication for auth token injection and retry logic

### 5. Add Refresh Token Failure Recovery
- When token refresh fails, currently just logs an error
- Consider triggering re-authentication flow
- Add configurable `onTokenRefreshFailed` callback with sensible default

### 6. Add Request Queuing During Token Refresh
- Multiple concurrent requests can trigger multiple token refreshes
- Queue requests during refresh and resolve all with the new token
- Prevents unnecessary Firebase API calls

## Priority 3 - Nice to Have

### 7. Add Auth State Persistence Diagnostics
- Expose current auth state (token age, refresh pending, etc.) for debugging
- Add logging for auth lifecycle events
- Consider DevTools integration

### 8. Support Custom Token Providers
- Currently hardcoded to Firebase Auth
- Add an abstraction layer for the token provider
- Would allow testing with mock tokens or alternative auth providers

### 9. Add Rate Limiting for Auth Retries
- 401 retry with force refresh could be abused
- Add exponential backoff for repeated auth failures
- Prevent retry storms when the auth server is down
