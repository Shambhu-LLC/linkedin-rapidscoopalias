import { useState, useEffect } from "react";
import { Loader2, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { linkedinApi, LinkedInComment } from "@/lib/linkedin-api";

interface CommentsDialogProps {
  postId: string | null;
  onClose: () => void;
}

export function CommentsDialog({ postId, onClose }: CommentsDialogProps) {
  const [comments, setComments] = useState<LinkedInComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = async () => {
    if (!postId) return;
    
    setIsLoading(true);
    try {
      const data = await linkedinApi.getComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error("Failed to fetch comments");
      // Demo data
      setComments([
        {
          id: "c1",
          text: "Great post! Really insightful.",
          createdAt: new Date().toISOString(),
          author: { name: "John Doe" },
        },
        {
          id: "c2",
          text: "Thanks for sharing this!",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          author: { name: "Jane Smith" },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      fetchComments();
    }
  }, [postId]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !postId) return;

    setIsSubmitting(true);
    try {
      const comment = await linkedinApi.createComment(postId, newComment);
      setComments([...comments, comment]);
      setNewComment("");
      toast.success("Comment added!");
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!postId) return;
    
    try {
      await linkedinApi.deleteComment(postId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      toast.success("Comment deleted!");
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error("Failed to delete comment");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={!!postId} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No comments yet</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">
                  {comment.author.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{comment.author.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm mt-1">{comment.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="min-h-[60px] resize-none"
          />
          <Button
            variant="linkedin"
            size="icon"
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
