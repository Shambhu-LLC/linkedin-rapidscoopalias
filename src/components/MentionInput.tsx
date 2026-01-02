import { useState, useRef, useEffect, useCallback, KeyboardEvent, ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Check, X, ExternalLink } from "lucide-react";
import { linkedinApi, SearchUser } from "@/lib/linkedin-api";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  interimTranscript?: string;
  accountId?: string | null;
}

export function MentionInput({ 
  value, 
  onChange, 
  placeholder, 
  className,
  interimTranscript = "",
  accountId
}: MentionInputProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<SearchUser[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [editingMention, setEditingMention] = useState<SearchUser | null>(null);
  const [editedDisplayName, setEditedDisplayName] = useState("");
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  const [linkedInAccountId, setLinkedInAccountId] = useState<string | null>(accountId || null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load LinkedIn account on mount
  useEffect(() => {
    if (accountId) {
      setLinkedInAccountId(accountId);
      return;
    }

    linkedinApi.getAccounts().then((data) => {
      const accounts = (data as any)?.accounts ?? data;
      const list = Array.isArray(accounts) ? accounts : [];
      const firstLinkedIn = list.find((a: any) => (a?.platform ?? a?.accountId?.platform) === 'linkedin');
      const id = firstLinkedIn?._id ?? firstLinkedIn?.id;

      const orgs = firstLinkedIn?.metadata?.availableOrganizations
        ?? firstLinkedIn?.accountId?.metadata?.availableOrganizations
        ?? [];
      setAvailableOrganizations(Array.isArray(orgs) ? orgs : []);

      if (typeof id === 'string' && id.length > 0) {
        setLinkedInAccountId(id);
      }
    }).catch((err) => {
      console.error('Error fetching accounts for mentions:', err);
    });
  }, [accountId]);

  // Debounced search function matching PostsView exactly
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setMentionSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!linkedInAccountId) {
        setMentionSuggestions([]);
        return;
      }

      setIsSearchingUsers(true);
      const trimmed = query.trim();
      const normalized = trimmed.toLowerCase();

      // Search local organizations first
      const orgMatches: SearchUser[] = (availableOrganizations ?? [])
        .filter((o: any) => {
          const name = (o?.name ?? '').toString().toLowerCase();
          const vanity = (o?.vanityName ?? '').toString().toLowerCase();
          return (name && name.includes(normalized)) || (vanity && vanity.includes(normalized)) || (vanity && normalized.includes(vanity));
        })
        .slice(0, 5)
        .map((o: any) => {
          const urn = (o?.urn ?? (o?.id ? `urn:li:organization:${o.id}` : '')).toString();
          const name = (o?.name ?? o?.vanityName ?? trimmed).toString();
          const vanityName = (o?.vanityName ?? '').toString();
          const mentionFormat = urn ? `@[${name}](${urn})` : `@${name}`;
          return { id: urn || vanityName || name, name, vanityName, mentionFormat } as SearchUser;
        });

      try {
        const looksLikeUrl = /^https?:\/\//i.test(trimmed) || trimmed.includes("linkedin.com/");
        const looksLikeVanity = /^[a-z0-9-]+$/i.test(trimmed) && trimmed.includes("-");
        const shouldSendDisplayName = !looksLikeUrl && !looksLikeVanity;

        // Generate search variations to try
        const searchVariations: { query: string; displayName?: string }[] = [];
        
        // 1. Full query as-is
        searchVariations.push({ 
          query: trimmed, 
          ...(shouldSendDisplayName ? { displayName: trimmed } : {}) 
        });

        // 2. Vanity format (lowercase with hyphens)
        const vanityGuess = trimmed.toLowerCase().replace(/\s+/g, '-');
        if (vanityGuess !== trimmed.toLowerCase()) {
          searchVariations.push({ query: vanityGuess });
        }

        // 3. Common name suffixes/extensions for partial matches
        const commonSuffixes = ['an', 'ar', 'en', 'er', 'in', 'on', 'kumar', 'raj', 'nathan', 'rajan', 'arasan'];
        for (const suffix of commonSuffixes) {
          const extended = `${trimmed}${suffix}`;
          searchVariations.push({ query: extended, displayName: extended });
        }

        // 4. If query has multiple words, try each word and combinations
        const words = trimmed.split(/\s+/);
        if (words.length > 1) {
          for (const word of words) {
            if (word.length >= 3) {
              searchVariations.push({ query: word, displayName: word });
            }
          }

          if (words.length > 2) {
            for (let i = 0; i < words.length - 1; i++) {
              const pair = `${words[i]} ${words[i + 1]}`;
              searchVariations.push({ query: pair, displayName: pair });
            }
          }
        }

        // Remove duplicates
        const uniqueVariations = searchVariations.filter((v, idx, arr) => 
          arr.findIndex(x => x.query.toLowerCase() === v.query.toLowerCase()) === idx
        );

        // Search all variations in parallel
        const searchPromises = uniqueVariations.map(async (variation) => {
          try {
            return await linkedinApi.searchUsers(variation.query, {
              accountId: linkedInAccountId,
              ...(variation.displayName ? { displayName: variation.displayName } : {}),
            });
          } catch {
            return [];
          }
        });

        const allResults = await Promise.all(searchPromises);
        
        // Merge results, removing duplicates by ID
        let users: SearchUser[] = [];
        for (const results of allResults) {
          for (const user of results) {
            if (!users.some(u => u.id === user.id)) {
              users.push(user);
            }
          }
        }

        const merged = [...orgMatches, ...users.filter(u => !orgMatches.some(o => o.id === u.id))];
        setMentionSuggestions(merged);
      } catch (error) {
        console.error('Error searching users:', error);
        setMentionSuggestions(orgMatches);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 500);
  }, [linkedInAccountId, availableOrganizations]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(position);

    const textBeforeCursor = newValue.substring(0, position);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1 && !textBeforeCursor.substring(atIndex).includes("\n")) {
      const search = textBeforeCursor.substring(atIndex + 1);
      setMentionSearch(search);
      setShowMentions(true);
      searchUsers(search);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionClick = (user: SearchUser) => {
    if (user.id?.includes('organization')) {
      insertMentionWithName(user, user.name);
      return;
    }
    setEditingMention(user);
    setEditedDisplayName(user.name);
  };

  const insertMentionWithName = (user: SearchUser, displayName: string) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const textBeforeAt = value.substring(0, atIndex);
    const textAfterCursor = value.substring(cursorPosition);

    const urn = user.id || '';
    const mentionText = urn ? `@[${displayName}](${urn})` : `@${displayName}`;

    const newContent = `${textBeforeAt}${mentionText} ${textAfterCursor}`;
    onChange(newContent);
    setShowMentions(false);
    setEditingMention(null);
    setEditedDisplayName("");
    textareaRef.current?.focus();
  };

  const confirmMentionEdit = () => {
    if (editingMention && editedDisplayName.trim()) {
      insertMentionWithName(editingMention, editedDisplayName.trim());
    }
  };

  const cancelMentionEdit = () => {
    setEditingMention(null);
    setEditedDisplayName("");
  };

  // Highlight mentions in preview
  const highlightMentions = (text: string | undefined | null): ReactNode => {
    if (!text) return null;

    const parts: ReactNode[] = [];
    const re = /@\[([^\]]+)\]\(([^)]+)\)|(@[\w-]+)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      const [full] = match;
      const idx = match.index;

      if (idx > lastIndex) {
        parts.push(text.slice(lastIndex, idx));
      }

      const label = match[1];
      const urn = match[2];
      const plainAt = match[3];

      const linkFor = (name: string, urnValue?: string) => {
        if (urnValue?.startsWith("urn:li:organization:")) {
          const orgId = urnValue.split(":").pop();
          if (orgId) return `https://www.linkedin.com/company/${orgId}/`;
        }

        const vanity = name.trim();
        const looksLikeVanity = /^[a-z0-9-]+$/i.test(vanity) && vanity.includes("-");
        if (looksLikeVanity) return `https://www.linkedin.com/in/${vanity}/`;

        return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`;
      };

      if (label && urn) {
        const href = linkFor(label, urn);
        parts.push(
          <a
            key={`${idx}-${urn}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary font-medium underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            title={`Open ${label} on LinkedIn`}
          >
            @{label}
          </a>
        );
      } else if (plainAt) {
        const name = plainAt.slice(1);
        const href = linkFor(name);
        parts.push(
          <a
            key={`${idx}-${plainAt}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary font-medium underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            title={`Search ${name} on LinkedIn`}
          >
            {plainAt}
          </a>
        );
      } else {
        parts.push(full);
      }

      lastIndex = idx + full.length;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  const displayValue = value + (interimTranscript ? (value ? " " : "") + interimTranscript : "");

  // Check if content has any mentions
  const hasMentions = /@\[([^\]]+)\]\(([^)]+)\)|(@[\w-]+)/.test(value);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleContentChange}
        className={className}
      />
      
      {/* Mention Suggestions - positioned above textarea like PostsView */}
      {showMentions && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {mentionSearch.length < 3 ? (
            <div className="p-4 text-sm text-muted-foreground">
              <p className="font-medium mb-1">To @mention someone:</p>
              <p>Type their <strong>first name</strong> (e.g., <code className="bg-secondary px-1 rounded">@Suguna</code>)</p>
              <p className="text-xs mt-1 opacity-70">Only 1st-degree connections can be mentioned.</p>
            </div>
          ) : isSearchingUsers ? (
            <div className="p-4 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Looking up "{mentionSearch}"...</span>
            </div>
          ) : mentionSuggestions.length > 0 ? (
            mentionSuggestions.map((user) => (
              <button
                key={user.id}
                onClick={() => handleMentionClick(user)}
                className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                  {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.id?.includes('organization') ? 'Click to add @mention' : 'Click to edit name before adding'}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-sm text-muted-foreground space-y-3">
              <p>No match for "<strong>{mentionSearch}</strong>"</p>
              <div className="text-xs space-y-1.5">
                <p className="font-medium">Try these options:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Paste their <strong>LinkedIn profile URL</strong> (most reliable)</li>
                  <li>Try just their <strong>first name</strong> (e.g., "Suryaa")</li>
                  <li>Try their <strong>vanity name</strong> from the URL (e.g., "suryaa-duraivelu-5031b1370")</li>
                </ul>
                <p className="pt-1 opacity-70">Note: Only 1st-degree connections can be mentioned.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview with highlighted mentions */}
      {hasMentions && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Preview (links open in new tab)</p>
          <div className="text-sm whitespace-pre-wrap break-words">{highlightMentions(value)}</div>
        </div>
      )}

      {/* Edit Display Name Dialog */}
      <Dialog open={!!editingMention} onOpenChange={(open) => !open && cancelMentionEdit()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Display Name</DialogTitle>
            <DialogDescription>
              For the mention to be clickable on LinkedIn, the display name must <strong>exactly match</strong> what appears on their profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                Display Name (edit to match their LinkedIn profile exactly)
              </label>
              <Input
                value={editedDisplayName}
                onChange={(e) => setEditedDisplayName(e.target.value)}
                placeholder="Enter exact profile name"
                className="text-base"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmMentionEdit();
                  } else if (e.key === 'Escape') {
                    cancelMentionEdit();
                  }
                }}
              />
            </div>
            {editingMention?.vanityName && (
              <div className="text-xs text-muted-foreground">
                <a 
                  href={`https://www.linkedin.com/in/${editingMention.vanityName}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2 hover:no-underline inline-flex items-center gap-1"
                >
                  Open profile to check exact name <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground mb-1">Preview:</p>
              <p className="font-medium text-primary">@{editedDisplayName || '...'}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelMentionEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={confirmMentionEdit} disabled={!editedDisplayName.trim()}>
              <Check className="h-4 w-4 mr-1" />
              Insert Mention
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
