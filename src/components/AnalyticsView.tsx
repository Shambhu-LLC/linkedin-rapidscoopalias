import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Eye, ThumbsUp, MessageSquare, Share2, Users, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { linkedinApi, LinkedInAnalytics } from "@/lib/linkedin-api";

const periods = ["7 days", "30 days", "90 days"];

export function AnalyticsView() {
  const [selectedPeriod, setSelectedPeriod] = useState("7 days");
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<LinkedInAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await linkedinApi.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError("Failed to fetch analytics. Please try again.");
      toast.error("Failed to fetch analytics");
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  const metrics = analytics ? [
    { label: "Profile Views", value: analytics.profileViews.toLocaleString(), change: `${analytics.profileViewsChange > 0 ? '+' : ''}${analytics.profileViewsChange}%`, icon: Eye, positive: analytics.profileViewsChange > 0 },
    { label: "Impressions", value: analytics.impressions >= 1000 ? `${(analytics.impressions / 1000).toFixed(1)}K` : analytics.impressions.toString(), change: `${analytics.impressionsChange > 0 ? '+' : ''}${analytics.impressionsChange}%`, icon: TrendingUp, positive: analytics.impressionsChange > 0 },
    { label: "Reactions", value: analytics.reactions.toLocaleString(), change: `${analytics.reactionsChange > 0 ? '+' : ''}${analytics.reactionsChange}%`, icon: ThumbsUp, positive: analytics.reactionsChange > 0 },
    { label: "Comments", value: analytics.comments.toLocaleString(), change: `${analytics.commentsChange > 0 ? '+' : ''}${analytics.commentsChange}%`, icon: MessageSquare, positive: analytics.commentsChange > 0 },
    { label: "Shares", value: analytics.shares.toLocaleString(), change: `${analytics.sharesChange > 0 ? '+' : ''}${analytics.sharesChange}%`, icon: Share2, positive: analytics.sharesChange > 0 },
    { label: "Followers", value: analytics.followers.toLocaleString(), change: `${analytics.followersChange > 0 ? '+' : ''}${analytics.followersChange}%`, icon: Users, positive: analytics.followersChange > 0 },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your LinkedIn performance over time</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchAnalytics} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="flex items-center gap-2 bg-secondary rounded-lg p-1">
            {periods.map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
              >
                {period}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Unable to load analytics</p>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchAnalytics}>Try Again</Button>
          </CardContent>
        </Card>
      ) : metrics.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No analytics data available</p>
            <p className="text-muted-foreground">Start posting to see your performance metrics here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <Card
                key={i}
                className="border-border/50 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                      <Icon className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${metric.positive ? 'text-success' : 'text-destructive'}`}>
                      {metric.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {metric.change}
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
