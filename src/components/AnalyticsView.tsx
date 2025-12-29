import { TrendingUp, TrendingDown, Eye, ThumbsUp, MessageSquare, Share2, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const impressionsData = [
  { name: "Mon", value: 2400 },
  { name: "Tue", value: 1398 },
  { name: "Wed", value: 9800 },
  { name: "Thu", value: 3908 },
  { name: "Fri", value: 4800 },
  { name: "Sat", value: 3800 },
  { name: "Sun", value: 4300 },
];

const engagementData = [
  { name: "Mon", reactions: 120, comments: 45, shares: 23 },
  { name: "Tue", reactions: 89, comments: 32, shares: 15 },
  { name: "Wed", reactions: 234, comments: 78, shares: 45 },
  { name: "Thu", reactions: 156, comments: 56, shares: 34 },
  { name: "Fri", reactions: 189, comments: 67, shares: 38 },
  { name: "Sat", reactions: 145, comments: 52, shares: 28 },
  { name: "Sun", reactions: 178, comments: 61, shares: 35 },
];

const metrics = [
  { label: "Total Impressions", value: "28.4K", change: "+18.2%", icon: Eye, positive: true },
  { label: "Total Reactions", value: "1,111", change: "+12.5%", icon: ThumbsUp, positive: true },
  { label: "Total Comments", value: "391", change: "+8.3%", icon: MessageSquare, positive: true },
  { label: "Total Shares", value: "218", change: "-3.1%", icon: Share2, positive: false },
  { label: "Follower Growth", value: "+127", change: "+5.7%", icon: Users, positive: true },
];

const periods = ["7 days", "30 days", "90 days"];

export function AnalyticsView() {
  const [selectedPeriod, setSelectedPeriod] = useState("7 days");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your LinkedIn performance over time</p>
        </div>
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

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Impressions Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Impressions Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={impressionsData}>
                  <defs>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(201 90% 36%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(201 90% 36%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(201 90% 36%)"
                    fillOpacity={1}
                    fill="url(#colorImpressions)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Chart */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-primary" />
              Engagement Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="reactions" fill="hsl(201 90% 36%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comments" fill="hsl(201 70% 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="shares" fill="hsl(201 50% 65%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-linkedin" />
                <span className="text-sm text-muted-foreground">Reactions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(201 70% 50%)" }} />
                <span className="text-sm text-muted-foreground">Comments</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(201 50% 65%)" }} />
                <span className="text-sm text-muted-foreground">Shares</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
