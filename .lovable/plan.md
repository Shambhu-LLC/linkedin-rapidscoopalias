

# LinkedIn Login "Client Authentication Failed" - Diagnosis and Fix

## Root Cause

The edge function logs confirm: every `linkedin-auth` callback fails with `{"error":"invalid_client","error_description":"Client authentication failed"}`.

Both `linkedin-auth` and `linkedin-posting` now use the **same** `LINKEDIN_POSTING_CLIENT_ID` / `LINKEDIN_POSTING_CLIENT_SECRET`. The posting flow works, so the credentials are valid. The difference is the **redirect URI**:

- Login: `https://766d7c6b-1e28-4576-adc3-731a894fadda.lovableproject.com/auth/callback`
- Posting: `https://766d7c6b-1e28-4576-adc3-731a894fadda.lovableproject.com/linkedin-posting/callback`

LinkedIn returns `invalid_client` when the redirect URI used during token exchange doesn't match one registered in the LinkedIn Developer Console. The posting redirect URI is registered; the auth one is not.

Additionally, the login flow requests `openid profile email` scopes, which requires the **"Sign In with LinkedIn using OpenID Connect"** product to be enabled on the LinkedIn app.

## What You Need To Do (LinkedIn Developer Console)

1. Go to your LinkedIn App → **Auth** → **Authorized redirect URLs**
2. Add: `https://766d7c6b-1e28-4576-adc3-731a894fadda.lovableproject.com/auth/callback`
3. Under **Products**, ensure **"Sign In with LinkedIn using OpenID Connect"** is enabled (this grants the `openid`, `profile`, `email` scopes)

## Code Improvement (Optional but Recommended)

The login flow opens LinkedIn in a **new tab** (`window.open` with `_blank`), while the posting flow uses a **popup with postMessage**. The new-tab approach is fragile because:
- The callback page (`AuthCallback`) makes the API call itself, but it may not have the same session context
- The redirect involves a magic link redirect chain that can fail

I recommend aligning the login flow to use the same popup+postMessage pattern as posting. However, this is a larger refactor and the immediate fix is the LinkedIn Developer Console configuration above.

## Summary

| Issue | Fix |
|-------|-----|
| `invalid_client` on token exchange | Add `/auth/callback` URL to LinkedIn app's authorized redirect URLs |
| Missing OpenID scopes | Enable "Sign In with LinkedIn using OpenID Connect" product on LinkedIn app |
| No code changes needed | This is a LinkedIn Developer Console configuration issue |

