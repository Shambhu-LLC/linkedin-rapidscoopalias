import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AtSign, Loader2 } from "lucide-react";
import { linkedinApi } from "@/lib/linkedin-api";

interface Mention {
  id: string;
  name: string;
  headline?: string;
  profilePicture?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  interimTranscript?: string;
}

export function MentionInput({ 
  value, 
  onChange, 
  placeholder, 
  className,
  interimTranscript = ""
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Mention[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sample connections for demo - in production, fetch from LinkedIn API
  const sampleConnections: Mention[] = [
    { id: "1", name: "Sarah Chen", headline: "VP of Engineering at TechCorp" },
    { id: "2", name: "Michael Rodriguez", headline: "Startup Founder & CEO" },
    { id: "3", name: "Emily Johnson", headline: "Product Manager at Google" },
    { id: "4", name: "David Kim", headline: "Software Engineer at Meta" },
    { id: "5", name: "Jessica Williams", headline: "Marketing Director" },
    { id: "6", name: "Alex Thompson", headline: "Data Scientist at Amazon" },
    { id: "7", name: "Rachel Green", headline: "UX Designer at Apple" },
    { id: "8", name: "Chris Martin", headline: "DevOps Lead at Netflix" },
  ];

  // Detect @ mention trigger
  const detectMention = (text: string, cursorPos: number) => {
    // Look backwards from cursor to find @
    let startIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];
      if (char === "@") {
        // Check if @ is at start or preceded by whitespace
        if (i === 0 || /\s/.test(text[i - 1])) {
          startIndex = i;
          break;
        }
      }
      // Stop if we hit whitespace before finding @
      if (/\s/.test(char)) break;
    }

    if (startIndex >= 0) {
      const query = text.slice(startIndex + 1, cursorPos);
      // Only show if query doesn't contain spaces (single word)
      if (!query.includes(" ") && query.length <= 30) {
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
      filterSuggestions(mention.query);
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
    }
  };

  const filterSuggestions = async (query: string) => {
    setIsLoading(true);
    try {
      // Filter sample connections based on query
      const filtered = sampleConnections.filter(
        (c) => c.name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } catch (error) {
      console.error("Error filtering suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const insertMention = (mention: Mention) => {
    if (mentionStartIndex < 0) return;

    const beforeMention = value.slice(0, mentionStartIndex);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);
    
    const mentionText = `@${mention.name}`;
    const newValue = beforeMention + mentionText + " " + afterMention;
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);

    // Focus and set cursor position after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
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
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case "Tab":
        if (showSuggestions && suggestions[selectedIndex]) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
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
      
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                  onClick={() => insertMention(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {suggestion.profilePicture ? (
                      <img
                        src={suggestion.profilePicture}
                        alt={suggestion.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      suggestion.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{suggestion.name}</p>
                    {suggestion.headline && (
                      <p className="text-xs text-muted-foreground truncate">
                        {suggestion.headline}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : mentionQuery.length > 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No connections found for "{mentionQuery}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
