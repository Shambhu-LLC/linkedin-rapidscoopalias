import { TrendingUp, Eye, ThumbsUp, MessageSquare, Share2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Profile Views", value: "2,847", change: "+12.5%", icon: Eye, positive: true },
  { label: "Post Impressions", value: "18.4K", change: "+8.2%", icon: TrendingUp, positive: true },
  { label: "Reactions", value: "1,234", change: "+15.3%", icon: ThumbsUp, positive: true },
  { label: "Comments", value: "156", change: "-2.1%", icon: MessageSquare, positive: false },
  { label: "Shares", value: "89", change: "+5.7%", icon: Share2, positive: true },
  { label: "Followers", value: "3,421", change: "+3.2%", icon: Users, positive: true },
];

const recentPosts = [
  { title: "Excited to announce our new product launch! 🚀", impressions: 4520, reactions: 234, comments: 45 },
  { title: "5 Tips for Better LinkedIn Engagement...", impressions: 3210, reactions: 189, comments: 28 },
  { title: "Had an amazing time at the tech conference...", impressions: 2890, reactions: 156, comments: 32 },
];

export function DashboardView() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your LinkedIn performance at a glance</p>
      </div>

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
                key={i}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-secondary/50 gap-4"
              >
                <p className="font-medium flex-1 line-clamp-1">{post.title}</p>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" /> {post.impressions.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" /> {post.reactions}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" /> {post.comments}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
