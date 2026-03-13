import { useState, useEffect } from "react";
import { Eye, ThumbsUp, MessageSquare, Share2, MousePointerClick, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { linkedinApi, PostAnalyticsData } from "@/lib/linkedin-api";
import { linkedinPostingApi } from "@/lib/linkedin-posting-api";

interface PostAnalyticsDialogProps {
  postId: string | null;
  postContent?: string;
  onClose: () => void;
}

interface LinkedInDirectAnalytics {
  source: string;
  likes: number;
  comments: number;
  shares: number;
}

export function PostAnalyticsDialog({ postId, postContent, onClose }: PostAnalyticsDialogProps) {
  const [getlateData, setGetlateData] = useState<PostAnalyticsData | null>(null);
  const [linkedinData, setLinkedinData] = useState<LinkedInDirectAnalytics | null>(null);
  const [isLoadingGetlate, setIsLoadingGetlate] = useState(false);
  const [isLoadingLinkedin, setIsLoadingLinkedin] = useState(false);
  const [getlateError, setGetlateError] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;

    // Fetch GetLate analytics
    setIsLoadingGetlate(true);
    setGetlateError(null);
    linkedinApi.getPostAnalytics(postId)
      .then((data) => setGetlateData(data))
      .catch((err) => {
        console.error("GetLate post analytics error:", err);
        setGetlateError("Not available");
      })
      .finally(() => setIsLoadingGetlate(false));

    // Fetch LinkedIn direct analytics (using postId as URN)
    setIsLoadingLinkedin(true);
    setLinkedinError(null);
    linkedinPostingApi.getPostAnalytics(postId)
      .then((data) => setLinkedinData(data))
      .catch((err) => {
        console.error("LinkedIn direct post analytics error:", err);
        setLinkedinError("Not available");
      })
      .finally(() => setIsLoadingLinkedin(false));
  }, [postId]);

  const renderMetricCard = (
    icon: React.ReactNode,
    label: string,
    value: number | undefined,
  ) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold">{(value ?? 0).toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={!!postId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post Analytics</DialogTitle>
        </DialogHeader>

        {postContent && (
          <div className="rounded-lg border border-border p-3 mb-4">
            <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{postContent}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* GetLate Analytics */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-sm">GetLate Analytics</h3>
                <Badge variant="outline" className="text-xs">via GetLate API</Badge>
              </div>

              {isLoadingGetlate ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : getlateError ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <AlertCircle className="h-4 w-4" />
                  <span>{getlateError}</span>
                </div>
              ) : getlateData ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {renderMetricCard(<Eye className="h-4 w-4 text-accent-foreground" />, "Impressions", getlateData.impressions)}
                  {renderMetricCard(<ThumbsUp className="h-4 w-4 text-accent-foreground" />, "Reactions", getlateData.reactions)}
                  {renderMetricCard(<MessageSquare className="h-4 w-4 text-accent-foreground" />, "Comments", getlateData.comments)}
                  {renderMetricCard(<Share2 className="h-4 w-4 text-accent-foreground" />, "Shares", getlateData.shares)}
                  {renderMetricCard(<MousePointerClick className="h-4 w-4 text-accent-foreground" />, "Clicks", getlateData.clicks)}
                  {renderMetricCard(<TrendingUp className="h-4 w-4 text-accent-foreground" />, "Engagement", getlateData.engagement)}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* LinkedIn Direct Analytics */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-sm">LinkedIn Direct Analytics</h3>
                <Badge variant="outline" className="text-xs">via LinkedIn API</Badge>
              </div>

              {isLoadingLinkedin ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : linkedinError ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <AlertCircle className="h-4 w-4" />
                  <span>{linkedinError}</span>
                </div>
              ) : linkedinData ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {renderMetricCard(<ThumbsUp className="h-4 w-4 text-accent-foreground" />, "Likes", linkedinData.likes)}
                  {renderMetricCard(<MessageSquare className="h-4 w-4 text-accent-foreground" />, "Comments", linkedinData.comments)}
                  {renderMetricCard(<Share2 className="h-4 w-4 text-accent-foreground" />, "Shares", linkedinData.shares)}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
