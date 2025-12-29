import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Plus, Send, Image, AtSign, Smile, MoreHorizontal, Edit2, Trash2, MessageSquare, Loader2, RefreshCw, ExternalLink, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { linkedinApi, LinkedInPost, SearchUser } from "@/lib/linkedin-api";
import { CommentsDialog } from "./CommentsDialog";

export function PostsView() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPost, setEditingPost] = useState<LinkedInPost | null>(null);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<SearchUser[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  const [editingMention, setEditingMention] = useState<SearchUser | null>(null);
  const [editedDisplayName, setEditedDisplayName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const data = await linkedinApi.getPosts();
      // Handle both array and object responses
      let postsArray: LinkedInPost[] = [];
      if (Array.isArray(data)) {
        postsArray = data;
      } else if (data && typeof data === 'object' && 'posts' in data) {
        postsArray = (data as { posts: LinkedInPost[] }).posts || [];
      }
      setPosts(postsArray);
      if (postsArray.length > 0) {
        toast.success(`Loaded ${postsArray.length} posts from GetLate.dev`);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error("Failed to fetch posts. Using demo data.");
      // Fallback to demo data
      setPosts([
        {
          id: "demo-1",
          content: "Excited to announce our new product launch! 🚀 @JohnDoe @JaneSmith",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          visibility: "PUBLIC",
          impressions: 4520,
          reactions: 234,
          comments: 45,
        },
        {
          id: "demo-2",
          content: "5 Tips for Better LinkedIn Engagement:\n\n1. Post consistently\n2. Engage with others\n3. Use relevant hashtags\n4. Share valuable insights\n5. Be authentic",
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          visibility: "PUBLIC",
          impressions: 3210,
          reactions: 189,
          comments: 28,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Needed for LinkedIn mention resolution via GetLate.dev
    linkedinApi.getAccounts().then((data) => {
      // Handle wrapper: { accounts: [...] } or direct array
      const accounts = (data as any)?.accounts ?? data;
      const list = Array.isArray(accounts) ? accounts : [];
      const firstLinkedIn = list.find((a: any) => (a?.platform ?? a?.accountId?.platform) === 'linkedin');
      const id = firstLinkedIn?._id ?? firstLinkedIn?.id;

      const orgs = firstLinkedIn?.metadata?.availableOrganizations
        ?? firstLinkedIn?.accountId?.metadata?.availableOrganizations
        ?? [];
      setAvailableOrganizations(Array.isArray(orgs) ? orgs : []);

      if (typeof id === 'string' && id.length > 0) {
        setDefaultAccountId(id);
        console.log('LinkedIn account found:', id);
      } else {
        console.warn('No LinkedIn account found in:', list);
      }
    }).catch((err) => {
      console.error('Error fetching accounts:', err);
      setDefaultAccountId(null);
    });
  }, []);

  // Debounce the API call to avoid spamming while typing
  const debounceRef = useRef<NodeJS.Timeout>();

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setMentionSuggestions([]);
      return;
    }

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (!defaultAccountId) {
        setMentionSuggestions([]);
        return;
      }

      setIsSearchingUsers(true);

      const trimmed = query.trim();
      const normalized = trimmed.toLowerCase();

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

        // Try primary search
        let users = await linkedinApi.searchUsers(query, {
          accountId: defaultAccountId,
          ...(shouldSendDisplayName ? { displayName: trimmed } : {}),
        });

        // If no results and query has multiple words, try variations
        const words = trimmed.split(/\s+/);
        if (users.length === 0 && words.length > 1) {
          // Try first name only
          const firstName = words[0];
          if (firstName.length >= 3) {
            const firstNameResults = await linkedinApi.searchUsers(firstName, {
              accountId: defaultAccountId,
              displayName: firstName,
            });
            users = [...users, ...firstNameResults];
          }

          // Try last name only
          const lastName = words[words.length - 1];
          if (lastName.length >= 3 && lastName !== firstName) {
            const lastNameResults = await linkedinApi.searchUsers(lastName, {
              accountId: defaultAccountId,
              displayName: lastName,
            });
            users = [...users, ...lastNameResults.filter(u => !users.some(existing => existing.id === u.id))];
          }

          // Try converting name to vanity format (lowercase, spaces to hyphens)
          const vanityGuess = trimmed.toLowerCase().replace(/\s+/g, '-');
          if (vanityGuess !== trimmed.toLowerCase()) {
            const vanityResults = await linkedinApi.searchUsers(vanityGuess, {
              accountId: defaultAccountId,
            });
            users = [...users, ...vanityResults.filter(u => !users.some(existing => existing.id === u.id))];
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
    }, 500); // Wait 500ms after user stops typing
  }, [defaultAccountId, availableOrganizations]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setContent(value);
    setCursorPosition(position);

    const textBeforeCursor = value.substring(0, position);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    // Keep mention suggestions open even if the query includes spaces (e.g. full names).
    // Close only when the user breaks the line.
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
    // For organization mentions, insert directly (they always work)
    if (user.id?.includes('organization')) {
      insertMentionWithName(user, user.name);
      return;
    }
    // For person mentions, allow editing the display name first
    setEditingMention(user);
    setEditedDisplayName(user.name);
  };

  const insertMentionWithName = (user: SearchUser, displayName: string) => {
    const textBeforeCursor = content.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const textBeforeAt = content.substring(0, atIndex);
    const textAfterCursor = content.substring(cursorPosition);

    // Build mention format with the (potentially edited) display name
    const urn = user.id || '';
    const mentionText = urn ? `@[${displayName}](${urn})` : `@${displayName}`;

    const newContent = `${textBeforeAt}${mentionText} ${textAfterCursor}`;
    setContent(newContent);
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

  const handlePost = async () => {
    if (!content.trim()) {
      toast.error("Please enter some content");
      return;
    }

    if (!defaultAccountId) {
      toast.error("No LinkedIn account connected. Please connect an account in GetLate.dev first.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && editingPost) {
        await linkedinApi.updatePost(editingPost.id, content);
        setPosts(posts.map(p => 
          p.id === editingPost.id ? { ...p, content } : p
        ));
        toast.success("Post updated successfully!");
      } else {
        const newPost = await linkedinApi.createPost(content, { accountId: defaultAccountId });
        setPosts([newPost, ...posts]);
        toast.success("Post created successfully!");
      }

      setContent("");
      setIsComposerOpen(false);
      setIsEditMode(false);
      setEditingPost(null);
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error(isEditMode ? "Failed to update post" : "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (post: LinkedInPost) => {
    setEditingPost(post);
    setContent(post.content);
    setIsEditMode(true);
    setIsComposerOpen(true);
  };

  const handleDelete = async (postId: string) => {
    try {
      await linkedinApi.deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
      toast.success("Post deleted successfully!");
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error("Failed to delete post");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const highlightMentions = (text: string | undefined | null) => {
    if (!text) return null;

    // GetLate.dev mention format: @[Name](urn:li:person:xxx)
    // We'll render these as clickable links (best-effort) in our UI.
    const parts: ReactNode[] = [];
    // Match @[Name](urn:...) format OR plain @mentions with word chars, hyphens, and numbers
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

      // LinkedIn URLs we can safely open without needing a vanity name.
      const linkFor = (name: string, urnValue?: string) => {
        if (urnValue?.startsWith("urn:li:organization:")) {
          const orgId = urnValue.split(":").pop();
          if (orgId) return `https://www.linkedin.com/company/${orgId}/`;
        }

        // If the mention looks like a LinkedIn vanity slug (e.g. suryaa-duraivelu-5031b1370),
        // we can link directly to /in/{vanity} so users can verify it before posting.
        const vanity = name.trim();
        const looksLikeVanity = /^[a-z0-9-]+$/i.test(vanity) && vanity.includes("-");
        if (looksLikeVanity) return `https://www.linkedin.com/in/${vanity}/`;

        // People mentions: we usually don't have a vanity URL (or it wasn't provided), so fall back to search.
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Posts</h1>
          <p className="text-muted-foreground">Create, edit and manage your LinkedIn posts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchPosts} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="linkedin" onClick={() => setIsComposerOpen(true)}>
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Posts List */}
      {!isLoading && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No posts yet. Create your first post!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post, i) => (
              <Card
                key={post.id}
                className="border-border/50 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap mb-4">{highlightMentions(post.content)}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(post.createdAt)}</span>
                        {post.impressions !== undefined && (
                          <>
                            <span>•</span>
                            <span>{post.impressions.toLocaleString()} impressions</span>
                          </>
                        )}
                        {post.reactions !== undefined && (
                          <>
                            <span>•</span>
                            <span>{post.reactions} reactions</span>
                          </>
                        )}
                        {post.comments !== undefined && (
                          <>
                            <span>•</span>
                            <span>{post.comments} comments</span>
                          </>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(post)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCommentsPostId(post.id)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Comments
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(post.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Composer Dialog */}
      <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Post" : "Create New Post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                placeholder="What do you want to share? Type @ then a person's name (e.g. @Suguna)..."
                className="min-h-[200px] resize-none"
              />
              
              {/* Mention Suggestions */}
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
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview (links open in new tab)</p>
              <div className="text-sm whitespace-pre-wrap break-words">{highlightMentions(content) || <span className="text-muted-foreground">Start typing to preview @mentions.</span>}</div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => toast.info("Image upload coming soon!")}>
                <Image className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setContent(content + "@");
                  textareaRef.current?.focus();
                }}
              >
                <AtSign className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => toast.info("Emoji picker coming soon!")}>
                <Smile className="h-4 w-4" />
              </Button>
              <span className="ml-auto text-sm text-muted-foreground">
                {content.length}/3000
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsComposerOpen(false);
              setIsEditMode(false);
              setEditingPost(null);
              setContent("");
            }}>
              Cancel
            </Button>
            <Button variant="linkedin" onClick={handlePost} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isEditMode ? "Update" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <CommentsDialog
        postId={commentsPostId}
        onClose={() => setCommentsPostId(null)}
      />

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
