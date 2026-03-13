

# Fix Post Analytics and Build Errors

## Problems

1. **Build errors**: `NodeJS.Timeout` type doesn't exist in the browser TypeScript config. Need to replace with `ReturnType<typeof setTimeout>`.

2. **Analytics shows zeros**: The `get-post-analytics` action uses the GetLate post `_id` (e.g., `69b44d45f7920cff86c0d92c`) to call `/posts/{id}/analytics` — this endpoint likely doesn't exist in the GetLate API. The fallback `/posts/{id}` also fails, so it returns all zeros.

3. **LinkedIn direct analytics fails**: The same GetLate `_id` is passed as `postUrn` to the LinkedIn `/v2/socialActions/{urn}` endpoint, but it needs a proper LinkedIn URN like `urn:li:share:...`.

4. **Only one analytics section shows**: The LinkedIn direct call fails (wrong URN format), showing "Not available" for that section.

## Solution

### Fix 1: NodeJS.Timeout build errors
Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` in:
- `src/components/PostsView.tsx` (line 121)
- `src/components/MentionInput.tsx` (line 43)
- `src/components/ConnectLinkedInPosting.tsx` (line 22)

### Fix 2: GetLate per-post analytics
The GetLate analytics response (from `get-analytics` action) already includes per-post analytics in the `posts` array. Instead of calling a non-existent `/posts/{id}/analytics` endpoint, use the existing analytics data that's already fetched with the posts list. Two approaches:

**Approach**: Use the analytics data already embedded in the posts list response. The `get-posts` transform already extracts `impressions`, `reactions`, `comments`, `shares` from `post.analytics`. Pass these values directly to the analytics dialog instead of making a separate API call.

### Fix 3: LinkedIn direct analytics
The posts from GetLate don't include LinkedIn URNs, so we can't call LinkedIn's `/v2/socialActions/{urn}`. Options:
- Remove the LinkedIn direct analytics section (since we don't have the URN)
- OR try to find the URN from the GetLate post data (if available in metadata)

**Approach**: Check if GetLate posts include a LinkedIn post URN in their data. If not, show "LinkedIn URN not available" instead of making a failing call.

## Changes

| File | Change |
|------|--------|
| `src/components/PostsView.tsx` | Fix `NodeJS.Timeout`, pass post analytics data directly to dialog |
| `src/components/MentionInput.tsx` | Fix `NodeJS.Timeout` |
| `src/components/ConnectLinkedInPosting.tsx` | Fix `NodeJS.Timeout` |
| `src/components/PostAnalyticsDialog.tsx` | Accept inline analytics data, only call LinkedIn API if URN available |
| `supabase/functions/linkedin-api/index.ts` | Include `linkedinPostUrn` in post transform if available from GetLate data |

