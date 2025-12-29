import { useState, useRef, useEffect } from "react";
import { Plus, Send, Image, AtSign, Smile, MoreHorizontal, Edit2, Trash2, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
    linkedinApi.getAccounts().then((accounts) => {
      const list = Array.isArray(accounts) ? accounts : [];
      const firstLinkedIn = list.find((a: any) => (a?.platform ?? a?.accountId?.platform) === 'linkedin');
      const id = firstLinkedIn?._id ?? firstLinkedIn?.id;
      if (typeof id === 'string' && id.length > 0) setDefaultAccountId(id);
    }).catch(() => {
      // No blocking: mentions will still allow freeform text
      setDefaultAccountId(null);
    });
  }, []);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setMentionSuggestions([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const users = await linkedinApi.searchUsers(query, {
        accountId: defaultAccountId ?? undefined,
      });
      setMentionSuggestions(users);
    } catch (error) {
      console.error('Error searching users:', error);
      setMentionSuggestions([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setContent(value);
    setCursorPosition(position);

    const textBeforeCursor = value.substring(0, position);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1 && !textBeforeCursor.substring(atIndex).includes(" ")) {
      const search = textBeforeCursor.substring(atIndex + 1);
      setMentionSearch(search);
      setShowMentions(true);
      searchUsers(search);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: SearchUser) => {
    const textBeforeCursor = content.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const textBeforeAt = content.substring(0, atIndex);
    const textAfterCursor = content.substring(cursorPosition);

    const mentionText = user.mentionFormat ?? `@${user.vanityName}`;

    const newContent = `${textBeforeAt}${mentionText} ${textAfterCursor}`;
    setContent(newContent);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handlePost = async () => {
    if (!content.trim()) {
      toast.error("Please enter some content");
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
        const newPost = await linkedinApi.createPost(content);
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

  const highlightMentions = (text: string) => {
    // Clean up GetLate.dev mention format: @[Name](urn:li:person:xxx) -> @Name
    const cleanedText = text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
    
    return cleanedText.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith("@")) {
        return <span key={i} className="text-primary font-medium">{part}</span>;
      }
      return part;
    });
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
                placeholder="What do you want to share? Type @ then a LinkedIn profile URL or vanity name..."
                className="min-h-[200px] resize-none"
              />
              
              {/* Mention Suggestions */}
              {showMentions && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  {isSearchingUsers ? (
                    <div className="p-4 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : mentionSuggestions.length > 0 ? (
                    mentionSuggestions.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => insertMention(user)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">@{user.vanityName}</p>
                        </div>
                      </button>
                    ))
                  ) : mentionSearch && (
                    <div className="p-4 text-sm text-muted-foreground">
                      Not found. Try the full LinkedIn URL (linkedin.com/in/...) or the exact vanity name.
                    </div>
                  )}
                </div>
              )}
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
    </div>
  );
}
