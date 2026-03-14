

# Use LINKEDIN_POSTING_CLIENT_ID for Login Auth

## What Changes

The `linkedin-auth` edge function currently reads `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` — secrets that don't exist in your project. Your project only has `LINKEDIN_POSTING_CLIENT_ID` and `LINKEDIN_POSTING_CLIENT_SECRET`.

## Changes

**File:** `supabase/functions/linkedin-auth/index.ts` (lines 9-10)

Replace:
```typescript
const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID")!;
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
```

With:
```typescript
const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_POSTING_CLIENT_ID")!;
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_POSTING_CLIENT_SECRET")!;
```

This means both login and posting will use the same LinkedIn app credentials. Note: the login flow uses OpenID scopes (`openid, profile, email`) while posting uses `r_basicprofile, w_member_social` — you'll need to ensure your LinkedIn app has both sets of permissions enabled.

| File | Change |
|------|--------|
| `supabase/functions/linkedin-auth/index.ts` | Switch env vars from `LINKEDIN_CLIENT_ID`/`SECRET` to `LINKEDIN_POSTING_CLIENT_ID`/`SECRET` |

