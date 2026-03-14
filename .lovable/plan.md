

# LinkedIn Post Format: One-Liner Style, 800 Words

## What Changes

The current post generation enforces **under 80 words** and a **2,600-character limit** for LinkedIn. You want posts that are:
- **~800 words** in length
- **One sentence per line** (the classic LinkedIn "one-liner" scroll format)

## Changes Required

**File:** `supabase/functions/generate-post/index.ts`

1. **Update the LinkedIn character limit** from 2,600 to ~4,500 characters (800 words averages ~4,000-4,500 characters). LinkedIn actually allows up to 3,000 characters for regular posts, so we may cap at 3,000 and target ~500 words, OR use the article/long-form limit. Since LinkedIn's actual limit for feed posts is 3,000 characters, we will set the target to 800 words but note the platform cap.

2. **Update the optimizer system prompt** -- replace "UNDER 80 WORDS" with "TARGET 800 WORDS" and reinforce the one-sentence-per-line format.

3. **Update the platform instruction for LinkedIn** to reflect the new word target and one-liner style.

---

## Technical Details

### 1. Platform instruction (line ~13)

Current:
```
Post can have a maximum of 2600 characters...
```

New:
```
Write a long-form LinkedIn post targeting around 800 words.
Each sentence must be on its own line with a blank line between sentences (one-liner format).
Maximum 3000 characters (LinkedIn's limit). Prioritize depth and value.
```

### 2. Optimizer prompt (lines ~48-60)

Current rules include:
```
6. UNDER 80 WORDS: If it doesn't add value, delete it.
```

New rules:
```
6. TARGET 800 WORDS: Go deep on the topic. Every sentence earns its place.
7. ONE-LINER FORMAT: One sentence per line. Blank line between each. No paragraphs.
```

### 3. Interest pillar prompts (lines ~25-45)

Expand each framework to encourage longer, more detailed output while keeping the one-liner structure. For example, adding instructions like:
- "Expand each point with a concrete example or data point"
- "Use the one-liner format: one sentence per line, blank line between"

### Summary of file changes

| File | Change |
|------|--------|
| `supabase/functions/generate-post/index.ts` | Update LinkedIn character limit, word target (80 -> 800), and enforce one-liner formatting in all prompt sections |

No database changes or new dependencies needed.

