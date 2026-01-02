import { useState, useEffect } from "react";
import { TrendingUp, Eye, ThumbsUp, MessageSquare, Share2, Users, Loader2, RefreshCw, AlertCircle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { linkedinApi, LinkedInAnalytics, LinkedInPost } from "@/lib/linkedin-api";
import { PostComposer } from "./PostComposer";

interface DashboardViewProps {
  personaVersion?: number;
}

export function DashboardView({ personaVersion = 0 }: DashboardViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<LinkedInAnalytics | null>(null);
  const [recentPosts, setRecentPosts] = useState<LinkedInPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [analyticsData, postsData] = await Promise.all([
        linkedinApi.getAnalytics(),
        linkedinApi.getPosts(),
      ]);
      setAnalytics(analyticsData);
      // Handle both array and object responses for posts
      let postsArray: LinkedInPost[] = [];
      if (Array.isArray(postsData)) {
        postsArray = postsData;
      } else if (postsData && typeof postsData === 'object' && 'posts' in postsData) {
        postsArray = (postsData as { posts: LinkedInPost[] }).posts || [];
      }
      setRecentPosts(postsArray.slice(0, 3));
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError("Failed to fetch dashboard data. Please try again.");
      toast.error("Failed to fetch data");
      setAnalytics(null);
      setRecentPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = analytics ? [
    { label: "Profile Views", value: analytics.profileViews.toLocaleString(), change: `${analytics.profileViewsChange > 0 ? '+' : ''}${analytics.profileViewsChange}%`, icon: Eye, positive: analytics.profileViewsChange > 0 },
    { label: "Post Impressions", value: analytics.impressions >= 1000 ? `${(analytics.impressions / 1000).toFixed(1)}K` : analytics.impressions.toString(), change: `${analytics.impressionsChange > 0 ? '+' : ''}${analytics.impressionsChange}%`, icon: TrendingUp, positive: analytics.impressionsChange > 0 },
    { label: "Reactions", value: analytics.reactions.toLocaleString(), change: `${analytics.reactionsChange > 0 ? '+' : ''}${analytics.reactionsChange}%`, icon: ThumbsUp, positive: analytics.reactionsChange > 0 },
    { label: "Comments", value: analytics.comments.toLocaleString(), change: `${analytics.commentsChange > 0 ? '+' : ''}${analytics.commentsChange}%`, icon: MessageSquare, positive: analytics.commentsChange > 0 },
    { label: "Shares", value: analytics.shares.toLocaleString(), change: `${analytics.sharesChange > 0 ? '+' : ''}${analytics.sharesChange}%`, icon: Share2, positive: analytics.sharesChange > 0 },
    { label: "Followers", value: analytics.followers.toLocaleString(), change: `${analytics.followersChange > 0 ? '+' : ''}${analytics.followersChange}%`, icon: Users, positive: analytics.followersChange > 0 },
  ] : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Post Composer */}
      <PostComposer key={`composer-${personaVersion}`} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your LinkedIn performance at a glance</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Unable to load dashboard</p>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchData}>Try Again</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Grid */}
          {stats.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <Card
                    key={i}
                    className="animate-slide-up border-border/50"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className={`text-xs font-medium ${stat.positive ? 'text-success' : 'text-destructive'}`}>
                          {stat.change}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No analytics data available</p>
                <p className="text-muted-foreground">Start posting to see your performance metrics here.</p>
              </CardContent>
            </Card>
          )}

          {/* Recent Posts */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Posts Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {recentPosts.length > 0 ? (
                <div className="space-y-4">
                  {recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-secondary/50 gap-4"
                    >
                      <p className="font-medium flex-1 line-clamp-1">{post.content}</p>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-4 w-4" /> {(post.impressions || 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-4 w-4" /> {post.reactions || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" /> {post.comments || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No posts yet. Create your first post to see performance here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
