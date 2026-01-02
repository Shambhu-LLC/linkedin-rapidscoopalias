import { useState, useEffect } from "react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Trash2, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ScheduledPost {
  id: string;
  content: string;
  image_url: string | null;
  scheduled_at: string;
  status: string;
  created_at: string;
}

export function ScheduledPostsCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchScheduledPosts();
  }, []);

  const fetchScheduledPosts = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setScheduledPosts(data || []);
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      toast.error("Failed to load scheduled posts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .delete()
        .eq("id", selectedPost.id);

      if (error) throw error;
      
      setScheduledPosts(posts => posts.filter(p => p.id !== selectedPost.id));
      toast.success("Scheduled post deleted");
      setIsDeleteDialogOpen(false);
      setSelectedPost(null);
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getPostsForDay = (day: Date) => {
    return scheduledPosts.filter(post => 
      isSameDay(new Date(post.scheduled_at), day) && post.status === 'pending'
    );
  };

  const postsForSelectedDate = selectedDate ? getPostsForDay(selectedDate) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      case 'posted': return 'bg-green-500/20 text-green-600 border-green-500/30';
      case 'failed': return 'bg-red-500/20 text-red-600 border-red-500/30';
      case 'cancelled': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Scheduled Posts</h1>
          <p className="text-muted-foreground">View and manage your scheduled LinkedIn posts</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {calendarDays.map((day, idx) => {
                  const dayPosts = getPostsForDay(day);
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        relative aspect-square p-1 rounded-lg transition-colors text-sm
                        ${isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"}
                        ${isToday ? "bg-primary/10 font-semibold" : ""}
                        ${isSelected ? "ring-2 ring-primary" : ""}
                        ${dayPosts.length > 0 ? "bg-primary/5" : "hover:bg-muted"}
                      `}
                    >
                      <span className={isToday ? "text-primary" : ""}>
                        {format(day, "d")}
                      </span>
                      {dayPosts.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayPosts.slice(0, 3).map((_, i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-primary"
                            />
                          ))}
                          {dayPosts.length > 3 && (
                            <span className="text-[8px] text-primary font-medium">+{dayPosts.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Posts for selected date */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">
              {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Click on a date to see scheduled posts
              </p>
            ) : postsForSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No posts scheduled for this date
              </p>
            ) : (
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-3">
                  {postsForSelectedDate.map(post => (
                    <div
                      key={post.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPost(post)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(post.scheduled_at), "h:mm a")}
                        </div>
                        <Badge variant="outline" className={getStatusColor(post.status)}>
                          {post.status}
                        </Badge>
                      </div>
                      <p className="text-sm line-clamp-3">{post.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Posts List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Upcoming Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledPosts.filter(p => p.status === 'pending' && new Date(p.scheduled_at) > new Date()).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No upcoming scheduled posts
            </p>
          ) : (
            <div className="space-y-3">
              {scheduledPosts
                .filter(p => p.status === 'pending' && new Date(p.scheduled_at) > new Date())
                .slice(0, 5)
                .map(post => (
                  <div
                    key={post.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPost(post)}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary">
                      <span className="text-xs font-medium">{format(new Date(post.scheduled_at), "MMM")}</span>
                      <span className="text-lg font-bold leading-none">{format(new Date(post.scheduled_at), "d")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(post.scheduled_at), "EEEE 'at' h:mm a")}
                      </div>
                      <p className="text-sm line-clamp-2">{post.content}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPost(post);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost && !isDeleteDialogOpen} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Scheduled Post</DialogTitle>
            <DialogDescription>
              Scheduled for {selectedPost && format(new Date(selectedPost.scheduled_at), "PPP 'at' p")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm whitespace-pre-wrap">{selectedPost?.content}</p>
            </div>
            {selectedPost?.image_url && (
              <img src={selectedPost.image_url} alt="Post" className="w-full rounded-lg" />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Scheduled Post?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The post will not be published.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePost} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
