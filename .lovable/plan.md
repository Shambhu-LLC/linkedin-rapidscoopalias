
## Fix: Edge Function Authentication Issue

### Problem Summary
When connecting LinkedIn Posting after login, the edge function fails with "User from sub claim in JWT does not exist". This happens because `supabase.auth.getUser(token)` is being used to validate the session, but the user lookup fails.

### Root Cause
The `linkedin-posting` edge function uses `getUser()` which requires looking up the user in the database. When the JWT's `sub` claim doesn't match a valid user (possibly due to stale tokens or session inconsistencies), authentication fails.

### Solution
Update the `linkedin-posting` edge function to use `getClaims(token)` instead of `getUser(token)` for authentication, following the recommended pattern for edge functions.

---

### Technical Details

#### File: `supabase/functions/linkedin-posting/index.ts`

**Current problematic code (multiple locations):**
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError) { ... }
currentUserId = user?.id;
```

**Updated code pattern:**
```typescript
const { data, error: authError } = await supabase.auth.getClaims(token);
if (authError || !data?.claims) {
  throw new Error("Not authenticated");
}
const currentUserId = data.claims.sub;
```

#### Changes Required

1. **Callback action (line ~126-143)**: Replace `getUser()` with `getClaims()`
   - Extract `sub` from claims as the user ID

2. **Get-posting-account action (line ~200-212)**: Replace `getUser()` with `getClaims()`
   - Use claims.sub for user ID

3. **Create-post action (line ~235-247)**: Replace `getUser()` with `getClaims()`
   - Use claims.sub for user ID

4. **Link-getlate-account action (line ~295-307)**: Replace `getUser()` with `getClaims()`
   - Use claims.sub for user ID

5. **Disconnect action (line ~320-332)**: Replace `getUser()` with `getClaims()`
   - Use claims.sub for user ID

---

### Why This Works

- `getClaims(jwt)` validates the token signature and returns JWT claims (`sub`, `email`, `role`, `exp`)
- Unlike `getUser()`, it doesn't require a database lookup of the user
- The `sub` claim in the JWT contains the user ID, which is all we need to associate data with the user
- This follows the recommended pattern in the Supabase edge functions documentation

---

### After Implementation

1. Deploy the updated edge function
2. Test the flow:
   - Sign in with LinkedIn
   - Connect LinkedIn for posting
   - Verify the connection succeeds
