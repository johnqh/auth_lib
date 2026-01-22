# Auth Lib

Firebase authentication utilities with token refresh handling for React applications.

**npm**: `@sudobility/auth_lib` (public)

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun
- **Build**: TypeScript compiler (tsc)
- **Test**: Vitest
- **Auth**: Firebase

## Project Structure

```
src/
├── index.ts          # Public exports (web)
├── index.rn.ts       # Public exports (React Native)
├── admin/            # Admin whitelist utilities
│   └── admin-emails.ts # parseAdminEmails, isAdminEmail, createAdminChecker
├── config/           # Configuration types and utilities
├── hooks/            # React hooks for auth
│   └── useAuth.ts    # Main auth hook with token refresh
├── network/          # Network client utilities
│   └── ...           # Auth-aware network client helpers
└── utils/            # Utility functions
    └── tokenRefresh.ts # Token refresh utilities
```

## Commands

```bash
bun run build        # Build to dist/
bun run dev          # Watch mode build
bun run clean        # Remove dist/
bun test             # Run tests
bun run typecheck    # TypeScript check
bun run lint         # Run ESLint
bun run lint:fix     # Fix lint issues
bun run format       # Format with Prettier
```

## Key Features

- Firebase auth token management
- Automatic token refresh before expiry
- React hooks for auth state
- Network client integration with auto-retry on 401
- Admin email whitelist utilities

## Usage

```typescript
import { useAuth, AuthConfig } from '@sudobility/auth_lib';

// Configure auth
const config: AuthConfig = {
  refreshThresholdMs: 5 * 60 * 1000, // Refresh 5 min before expiry
};

// In a React component
const { user, token, isLoading, signIn, signOut } = useAuth(config);
```

## Peer Dependencies

Required in consuming app:
- `react` >= 19.0.0
- `firebase` >= 12.0.0
- `@sudobility/di` - Dependency injection
- `@sudobility/types` - Common types
- `@tanstack/react-query` >= 5.0.0 - For useSiteAdmin hook

## Publishing

```bash
bun run prepublishOnly  # Build
npm publish             # Publish to npm
```

## Architecture

```
auth_lib (this package)
    ↑
shapeshyft_app (consumes auth)
sudojo_app (consumes auth)
```

## Code Patterns

### Token Refresh
```typescript
// Token is refreshed automatically when:
// 1. Token is within threshold of expiry
// 2. API returns 401 (triggers immediate refresh)
// 3. App resumes from background
```

### Error Handling
- Network errors: Retry with exponential backoff
- Auth errors: Redirect to login
- Token refresh failures: Sign out user

### Site Admin Check (Recommended)
```typescript
import { useSiteAdmin } from '@sudobility/auth_lib';

// In a React component - fetches from backend API
const { isSiteAdmin, isLoading, userInfo } = useSiteAdmin({
  networkClient,
  baseUrl: 'https://api.example.com/api/v1',
  userId: user?.uid,
  token: idToken,
});

if (isLoading) return <Loading />;
if (isSiteAdmin) {
  // Show admin features
}
```

### Admin Email Whitelist (Deprecated - use useSiteAdmin instead)
```typescript
import { createAdminChecker } from '@sudobility/auth_lib';

// Create checker once at startup
const isAdmin = createAdminChecker(process.env.ADMIN_EMAILS);
// ADMIN_EMAILS="admin@example.com,other@example.com"

// In middleware:
if (isAdmin(user.email)) {
  // Bypass rate limiting, subscription checks, etc.
}
```
