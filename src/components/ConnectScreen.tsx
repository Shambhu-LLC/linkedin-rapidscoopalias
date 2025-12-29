import { Linkedin, ArrowRight, Zap, BarChart3, MessageSquare, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConnectScreenProps {
  onConnect: () => void;
  isLoading: boolean;
}

export function ConnectScreen({ onConnect, isLoading }: ConnectScreenProps) {
  const features = [
    { icon: Edit, title: "Create & Schedule", desc: "Compose posts with @mentions" },
    { icon: MessageSquare, title: "Engage", desc: "Comment and interact easily" },
    { icon: BarChart3, title: "Analytics", desc: "Track your performance" },
    { icon: Zap, title: "Fast Actions", desc: "Edit and delete posts quickly" },
  ];

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center animate-fade-in">
        {/* Logo */}
        <div className="mb-8 inline-flex">
          <div className="w-20 h-20 rounded-2xl gradient-linkedin flex items-center justify-center shadow-glow animate-pulse-soft">
            <Linkedin className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
          Manage Your LinkedIn
          <br />
          <span className="text-primary">Like a Pro</span>
        </h1>

        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
          Connect your LinkedIn account via GetLate.dev API to unlock powerful posting, 
          commenting, and analytics features.
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="p-4 rounded-xl bg-card shadow-sm border border-border animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <Icon className="h-6 w-6 text-primary mb-2 mx-auto" />
                <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Connect Button */}
        <Button
          variant="linkedin"
          size="xl"
          onClick={onConnect}
          disabled={isLoading}
          className="group"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Connecting...
            </span>
          ) : (
            <>
              <Linkedin className="h-5 w-5" />
              Connect LinkedIn
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Powered by GetLate.dev API • Secure OAuth connection
        </p>
      </div>
    </div>
  );
}
