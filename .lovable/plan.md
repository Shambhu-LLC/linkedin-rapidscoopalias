

# Fix Login Issues: Email Sign-in and LinkedIn Login

## Problems Identified

**1. Email Sign-in fails with "Invalid login credentials"**
The auth logs show `user_repeated_signup` for `thudhutest@gmail.com` — the account exists but the email was never confirmed. Since email confirmation is required, the user can't sign in with their password. We need to enable auto-confirm for email signups so users can sign in immediately.

**2. LinkedIn Login fails with `invalid_client` during token exchange**
The `authorize` step works (returns correct client_id `861z1f5bpkz80u`), but the token exchange fails. The posting flow works with the same credentials because:
- Posting uses a **popup + postMessage** pattern where the parent window (with auth session) makes the API call
- Login uses a **new tab** pattern where the callback page itself makes the API call directly

The real issue: the LinkedIn auth callback page (`AuthCallback`) opens in a new tab and calls the edge function directly. But the `invalid_client` error on token exchange — despite same credentials working for posting — strongly suggests a **redirect URI mismatch**. The login callback sends `/auth/callback` as the redirect URI, which must be registered in the LinkedIn app.

Since you confirmed the redirect URI is added and OpenID is enabled, the most likely remaining cause is that the edge function needs redeployment, or there's a subtle URL mismatch. To make this robust, I'll **align the login flow to use the same popup+postMessage pattern as posting**, which is proven to work.

## Plan

### Step 1: Enable auto-confirm for email signups
Use the auth configuration tool to enable auto-confirm, so email/password users can sign in immediately without email verification.

### Step 2: Refactor LinkedIn login to use popup+postMessage pattern
This mirrors the working posting flow and avoids the fragile new-tab + magic-link redirect chain.

**Files to change:**

**`src/pages/Auth.tsx`** — Change `handleLinkedInLogin` to open a popup (not `_blank` tab), listen for `postMessage` from the callback, then use the received magic link to sign in.

**`src/pages/AuthCallback.tsx`** — Convert to a lightweight popup page that sends the code back to the parent via `postMessage` (like `LinkedInPostingCallback.tsx`), instead of making the API call itself.

**`supabase/functions/linkedin-auth/index.ts`** — Add debug logging for the client_id being used during token exchange to help diagnose any remaining issues.

### Step 3: Handle the magic link session in the parent window
After receiving the code via postMessage, the parent (`Auth.tsx`) calls the `linkedin-auth` edge function and follows the magic link redirect to establish the session.

## Summary

| Issue | Fix |
|-------|-----|
| Email sign-in fails (unconfirmed email) | Enable auto-confirm for signups |
| LinkedIn login `invalid_client` | Align to popup+postMessage pattern (proven working in posting flow) |
| Fragile new-tab flow | Replace with popup that sends code back to parent window |

