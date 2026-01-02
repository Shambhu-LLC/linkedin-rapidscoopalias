import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AtSign, Loader2, Check, X } from "lucide-react";
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingMention, setEditingMention] = useState<SearchUser | null>(null);
  const [editedDisplayName, setEditedDisplayName] = useState("");
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  const [linkedInAccountId, setLinkedInAccountId] = useState<string | null>(accountId || null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
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

  // Debounced search function
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const trimmed = query.trim();
      const normalized = trimmed.toLowerCase();

      // Search local organizations first
      const orgMatches: SearchUser[] = (availableOrganizations ?? [])
        .filter((o: any) => {
          const name = (o?.name ?? '').toString().toLowerCase();
          const vanity = (o?.vanityName ?? '').toString().toLowerCase();
          return name.includes(normalized) || vanity.includes(normalized);
        })
        .slice(0, 3)
        .map((o: any) => {
          const urn = (o?.urn ?? (o?.id ? `urn:li:organization:${o.id}` : '')).toString();
          const name = (o?.name ?? o?.vanityName ?? trimmed).toString();
          const vanityName = (o?.vanityName ?? '').toString();
          return { id: urn || vanityName || name, name, vanityName } as SearchUser;
        });

      // If we have a LinkedIn account, search for people
      if (linkedInAccountId) {
        try {
          const users = await linkedinApi.searchUsers(trimmed, {
            accountId: linkedInAccountId,
            displayName: trimmed,
          });
          const merged = [...orgMatches, ...users.filter(u => !orgMatches.some(o => o.id === u.id))];
          setSuggestions(merged.slice(0, 6));
        } catch (error) {
          console.error('Error searching users:', error);
          setSuggestions(orgMatches);
        }
      } else {
        setSuggestions(orgMatches);
      }

      setIsLoading(false);
    }, 400);
  }, [linkedInAccountId, availableOrganizations]);

  // Detect @ mention trigger
  const detectMention = (text: string, cursorPos: number) => {
    let startIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];
      if (char === "@") {
        if (i === 0 || /\s/.test(text[i - 1])) {
          startIndex = i;
          break;
        }
      }
      if (char === "\n") break;
    }

    if (startIndex >= 0) {
      const query = text.slice(startIndex + 1, cursorPos);
      if (query.length <= 50) {
        return { startIndex, query };
      }
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);

    const mention = detectMention(newValue, cursorPos);
    if (mention) {
      setMentionStartIndex(mention.startIndex);
      setMentionQuery(mention.query);
      setShowSuggestions(true);
      setSelectedIndex(0);
      searchUsers(mention.query);
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
    }
  };

  const insertMention = (user: SearchUser, displayName?: string) => {
    if (mentionStartIndex < 0) return;

    const beforeMention = value.slice(0, mentionStartIndex);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);
    
    const name = displayName || user.name;
    const urn = user.id || '';
    const mentionText = urn ? `@[${name}](${urn})` : `@${name}`;
    const newValue = beforeMention + mentionText + " " + afterMention;
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
    setEditingMention(null);
    setEditedDisplayName("");

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleMentionClick = (user: SearchUser) => {
    // Organizations insert directly
    if (user.id?.includes('organization')) {
      insertMention(user);
      return;
    }
    // People get name editing option
    setEditingMention(user);
    setEditedDisplayName(user.name);
  };

  const confirmMentionEdit = () => {
    if (editingMention && editedDisplayName.trim()) {
      insertMention(editingMention, editedDisplayName.trim());
    }
  };

  const cancelMentionEdit = () => {
    setEditingMention(null);
    setEditedDisplayName("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
        if (showSuggestions && suggestions[selectedIndex]) {
          e.preventDefault();
          handleMentionClick(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case "Tab":
        if (showSuggestions && suggestions[selectedIndex]) {
          e.preventDefault();
          handleMentionClick(suggestions[selectedIndex]);
        }
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = value + (interimTranscript ? (value ? " " : "") + interimTranscript : "");

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={className}
      />
      
      {/* Mention Edit Dialog */}
      {editingMention && (
        <div className="absolute left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 p-3">
          <p className="text-sm text-muted-foreground mb-2">Edit display name for mention:</p>
          <div className="flex gap-2">
            <Input
              value={editedDisplayName}
              onChange={(e) => setEditedDisplayName(e.target.value)}
              placeholder="Display name"
              className="flex-1"
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
            <Button size="icon" variant="default" onClick={confirmMentionEdit}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={cancelMentionEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Suggestions Dropdown */}
      {showSuggestions && !editingMention && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="py-1">
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
                <AtSign className="h-3 w-3" />
                Mention someone
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-accent transition-colors ${
                    index === selectedIndex ? "bg-accent" : ""
                  }`}
                  onClick={() => handleMentionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                    {suggestion.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{suggestion.name}</p>
                    {suggestion.vanityName && (
                      <p className="text-xs text-muted-foreground truncate">
                        {suggestion.vanityName}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : mentionQuery.length >= 2 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found for "{mentionQuery}"
            </div>
          ) : mentionQuery.length > 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
