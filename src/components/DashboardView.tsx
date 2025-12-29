import { useState, useEffect } from "react";
import { TrendingUp, Eye, ThumbsUp, MessageSquare, Share2, Users, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { linkedinApi, LinkedInAnalytics, LinkedInPost } from "@/lib/linkedin-api";

export function DashboardView() {
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<LinkedInAnalytics | null>(null);
  const [recentPosts, setRecentPosts] = useState<LinkedInPost[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [analyticsData, postsData] = await Promise.all([
        linkedinApi.getAnalytics(),
        linkedinApi.getPosts(),
      ]);
      setAnalytics(analyticsData);
      setRecentPosts(postsData.slice(0, 3));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error("Failed to fetch data. Using demo data.");
      // Fallback data
      setAnalytics({
        profileViews: 2847,
        profileViewsChange: 12.5,
        impressions: 18400,
        impressionsChange: 8.2,
        reactions: 1234,
        reactionsChange: 15.3,
        comments: 156,
        commentsChange: -2.1,
        shares: 89,
        sharesChange: 5.7,
        followers: 3421,
        followersChange: 3.2,
      });
      setRecentPosts([
        { id: "1", content: "Excited to announce our new product launch! 🚀", createdAt: new Date().toISOString(), visibility: "PUBLIC", impressions: 4520, reactions: 234, comments: 45 },
        { id: "2", content: "5 Tips for Better LinkedIn Engagement...", createdAt: new Date().toISOString(), visibility: "PUBLIC", impressions: 3210, reactions: 189, comments: 28 },
        { id: "3", content: "Had an amazing time at the tech conference...", createdAt: new Date().toISOString(), visibility: "PUBLIC", impressions: 2890, reactions: 156, comments: 32 },
      ]);
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
    <div className="space-y-6 animate-fade-in">
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
      ) : (
        <>
          {/* Stats Grid */}
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

          {/* Recent Posts */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Posts Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPosts.map((post, i) => (
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
