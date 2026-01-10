import { useState } from "react";
import { Globe, MoreHorizontal, ThumbsUp, MessageCircle, Repeat2, Send, Loader2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { linkedinPostingApi } from "@/lib/linkedin-posting-api";
import { supabase } from "@/integrations/supabase/client";
import { MentionInput } from "./MentionInput";

interface LinkedInPostPreviewProps {
  content: string;
  imageUrl?: string | null;
  profileName?: string;
  profileHeadline?: string;
  profilePicture?: string;
  onContentChange?: (content: string) => void;
  accountId?: string;
}

export function LinkedInPostPreview({
  content,
  imageUrl,
  profileName = "Your Name",
  profileHeadline = "Your headline",
  profilePicture,
  onContentChange,
  accountId,
}: LinkedInPostPreviewProps) {
  const [isPosting, setIsPosting] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handlePost = async () => {
    if (!content.trim()) {
      toast.error("No content to post");
      return;
    }

    setIsPosting(true);
    try {
      // Use the new direct LinkedIn posting API
      await linkedinPostingApi.createPost(content);
      toast.success("Posted to LinkedIn!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast.error("Please select date and time");
      return;
    }

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledDateTime <= new Date()) {
      toast.error("Please select a future date and time");
      return;
    }

    setIsScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to schedule posts");
        return;
      }

      const { error } = await supabase.from("scheduled_posts").insert({
        user_id: user.id,
        content: content,
        image_url: imageUrl || null,
        scheduled_at: scheduledDateTime.toISOString(),
        status: "pending",
      });

      if (error) throw error;

      toast.success(`Post scheduled for ${scheduledDateTime.toLocaleString()}`);
      setIsScheduleOpen(false);
      setScheduleDate("");
      setScheduleTime("");
    } catch (error) {
      console.error("Error scheduling post:", error);
      toast.error("Failed to schedule post");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSaveEdit = () => {
    if (onContentChange) {
      onContentChange(editContent);
    }
    setIsEditing(false);
  };

  const initials = profileName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Render content with clickable mention links
  const renderContentWithMentions = (text: string) => {
    const mentionRegex = /\[([^\]]+)\]\(https:\/\/www\.linkedin\.com\/in\/([^)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      // Add the clickable link
      const displayName = match[1];
      const vanityName = match[2];
      parts.push(
        <a
          key={`${vanityName}-${match.index}`}
          href={`https://www.linkedin.com/in/${vanityName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          @{displayName}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="space-y-4">
      {/* LinkedIn Post Card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        {/* Post Header */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profilePicture} alt={profileName} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-foreground leading-tight">
                  {profileName}
                </h4>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {profileHeadline}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <span>Just now</span>
                  <span>•</span>
                  <Globe className="h-3 w-3" />
                </div>
              </div>
            </div>
            <button className="p-1 hover:bg-muted rounded-full transition-colors">
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Post Content */}
        <div className="px-4 pb-3">
          {isEditing ? (
            <div className="space-y-2">
              <MentionInput
                value={editContent}
                onChange={setEditContent}
                placeholder="Edit your post... Type @ to mention someone"
                className="w-full min-h-[150px] text-sm bg-muted/50 resize-none"
                accountId={accountId}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="text-sm text-foreground whitespace-pre-wrap cursor-pointer hover:bg-muted/30 rounded p-1 -m-1 transition-colors"
              onClick={() => {
                setEditContent(content);
                setIsEditing(true);
              }}
              title="Click to edit"
            >
              {renderContentWithMentions(content)}
            </div>
          )}
        </div>

        {/* Post Image */}
        {imageUrl && (
          <div className="border-t border-border">
            <img src={imageUrl} alt="Post" className="w-full h-auto" />
          </div>
        )}

        {/* Engagement Stats (Mockup) */}
        <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              <span className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white">👍</span>
              <span className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-white">❤️</span>
            </div>
            <span className="ml-1">Preview</span>
          </div>
        </div>

        {/* Action Buttons (Mockup) */}
        <div className="px-4 py-1 flex items-center justify-around border-t border-border">
          <button className="flex items-center gap-2 py-3 px-4 text-muted-foreground hover:bg-muted rounded transition-colors">
            <ThumbsUp className="h-5 w-5" />
            <span className="text-sm font-medium">Like</span>
          </button>
          <button className="flex items-center gap-2 py-3 px-4 text-muted-foreground hover:bg-muted rounded transition-colors">
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Comment</span>
          </button>
          <button className="flex items-center gap-2 py-3 px-4 text-muted-foreground hover:bg-muted rounded transition-colors">
            <Repeat2 className="h-5 w-5" />
            <span className="text-sm font-medium">Repost</span>
          </button>
          <button className="flex items-center gap-2 py-3 px-4 text-muted-foreground hover:bg-muted rounded transition-colors">
            <Send className="h-5 w-5" />
            <span className="text-sm font-medium">Send</span>
          </button>
        </div>
      </div>

      {/* Post & Schedule Buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          variant="linkedin"
          size="lg"
          onClick={handlePost}
          disabled={isPosting || !content.trim()}
          className="min-w-[140px]"
        >
          {isPosting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Post to LinkedIn
            </>
          )}
        </Button>

        <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="lg" disabled={!content.trim()}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Schedule Post</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Choose when to publish your post
                  </p>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleDate">Date</Label>
                <Input
                  id="scheduleDate"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduleTime">Time</Label>
                <Input
                  id="scheduleTime"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setIsScheduleOpen(false)} disabled={isScheduling}>
                  Cancel
                </Button>
                <Button onClick={handleSchedule} disabled={isScheduling}>
                  {isScheduling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  {isScheduling ? "Scheduling..." : "Schedule Post"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
