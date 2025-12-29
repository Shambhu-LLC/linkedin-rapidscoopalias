import { useState, useRef, useCallback } from "react";
import { Plus, Send, Image, AtSign, Smile, MoreHorizontal, Edit2, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Post {
  id: string;
  content: string;
  createdAt: Date;
  impressions: number;
  reactions: number;
  comments: number;
}

const mockPosts: Post[] = [
  {
    id: "1",
    content: "Excited to announce our new product launch! 🚀 Check it out and let me know your thoughts. @JohnDoe @JaneSmith",
    createdAt: new Date(Date.now() - 86400000),
    impressions: 4520,
    reactions: 234,
    comments: 45,
  },
  {
    id: "2",
    content: "5 Tips for Better LinkedIn Engagement:\n\n1. Post consistently\n2. Engage with others\n3. Use relevant hashtags\n4. Share valuable insights\n5. Be authentic",
    createdAt: new Date(Date.now() - 172800000),
    impressions: 3210,
    reactions: 189,
    comments: 28,
  },
  {
    id: "3",
    content: "Had an amazing time at the tech conference yesterday! Great insights from @SarahConnor and the team. #TechConference2024",
    createdAt: new Date(Date.now() - 259200000),
    impressions: 2890,
    reactions: 156,
    comments: 32,
  },
];

const mentionSuggestions = [
  { name: "John Doe", username: "johndoe", avatar: "JD" },
  { name: "Jane Smith", username: "janesmith", avatar: "JS" },
  { name: "Sarah Connor", username: "sarahconnor", avatar: "SC" },
  { name: "Mike Johnson", username: "mikej", avatar: "MJ" },
];

export function PostsView() {
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setContent(value);
    setCursorPosition(position);

    // Check for @ mention
    const textBeforeCursor = value.substring(0, position);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1 && !textBeforeCursor.substring(atIndex).includes(" ")) {
      const search = textBeforeCursor.substring(atIndex + 1);
      setMentionSearch(search);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username: string) => {
    const textBeforeCursor = content.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const textBeforeAt = content.substring(0, atIndex);
    const textAfterCursor = content.substring(cursorPosition);
    
    const newContent = `${textBeforeAt}@${username} ${textAfterCursor}`;
    setContent(newContent);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handlePost = () => {
    if (!content.trim()) {
      toast.error("Please enter some content");
      return;
    }

    if (isEditMode && editingPost) {
      setPosts(posts.map(p => 
        p.id === editingPost.id ? { ...p, content } : p
      ));
      toast.success("Post updated successfully!");
    } else {
      const newPost: Post = {
        id: Date.now().toString(),
        content,
        createdAt: new Date(),
        impressions: 0,
        reactions: 0,
        comments: 0,
      };
      setPosts([newPost, ...posts]);
      toast.success("Post created successfully!");
    }

    setContent("");
    setIsComposerOpen(false);
    setIsEditMode(false);
    setEditingPost(null);
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setContent(post.content);
    setIsEditMode(true);
    setIsComposerOpen(true);
  };

  const handleDelete = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
    toast.success("Post deleted successfully!");
  };

  const filteredMentions = mentionSuggestions.filter(m =>
    m.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    m.username.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const formatDate = (date: Date) => {
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
    return text.split(/(@\w+)/g).map((part, i) => {
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
        <Button variant="linkedin" onClick={() => setIsComposerOpen(true)}>
          <Plus className="h-4 w-4" />
          New Post
        </Button>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {posts.map((post, i) => (
          <Card
            key={post.id}
            className="border-border/50 animate-slide-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="whitespace-pre-wrap mb-4">{highlightMentions(post.content)}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatDate(post.createdAt)}</span>
                    <span>•</span>
                    <span>{post.impressions.toLocaleString()} impressions</span>
                    <span>•</span>
                    <span>{post.reactions} reactions</span>
                    <span>•</span>
                    <span>{post.comments} comments</span>
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
                    <DropdownMenuItem onClick={() => toast.info("Comment feature coming soon!")}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Comment
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
        ))}
      </div>

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
                placeholder="What do you want to share? Use @ to mention someone..."
                className="min-h-[200px] resize-none"
              />
              
              {/* Mention Suggestions */}
              {showMentions && filteredMentions.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  {filteredMentions.map((mention) => (
                    <button
                      key={mention.username}
                      onClick={() => insertMention(mention.username)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                        {mention.avatar}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{mention.name}</p>
                        <p className="text-xs text-muted-foreground">@{mention.username}</p>
                      </div>
                    </button>
                  ))}
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
            <Button variant="linkedin" onClick={handlePost}>
              <Send className="h-4 w-4" />
              {isEditMode ? "Update" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
