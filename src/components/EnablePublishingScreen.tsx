import { useState } from "react";
import { Linkedin, Share2, BarChart3, AtSign, ArrowRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LinkedInAccountSelector } from "./LinkedInAccountSelector";

interface EnablePublishingScreenProps {
  onEnabled: () => void;
  onSignOut?: () => void;
  userEmail?: string;
  userName?: string;
}

export function EnablePublishingScreen({ 
  onEnabled, 
  onSignOut, 
  userEmail,
  userName 
}: EnablePublishingScreenProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);

  const handleEnablePublishing = async () => {
    setIsConnecting(true);
    try {
      // Step 1: Create or get profile from GetLate.dev
      const { data: profileData, error: profileError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "create-profile", name: "LinkedInUsers" },
      });

      if (profileError) throw profileError;
      if (!profileData?.success || !profileData?.data?.profileId) {
        throw new Error("Failed to create profile");
      }

      const profileId = profileData.data.profileId;
      localStorage.setItem("getlate_profile_id", profileId);

      // Step 2: Get the GetLate OAuth connect URL with callback
      const callbackUrl = `${window.location.origin}/connect/callback`;
      const { data: connectData, error: connectError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "get-connect-url", profileId, callbackUrl },
      });

      if (connectError) throw connectError;
      if (!connectData?.success || !connectData?.data?.connectUrl) {
        console.error("Connect data:", connectData);
        throw new Error("Failed to get connect URL");
      }

      // Step 3: Open OAuth in a centered popup window
      localStorage.setItem("getlate_enabling_publishing", "true");
      
      // Calculate popup position (centered)
      const popupWidth = 600;
      const popupHeight = 700;
      const left = Math.max(0, (window.screen.width - popupWidth) / 2);
      const top = Math.max(0, (window.screen.height - popupHeight) / 2);
      
      const popup = window.open(
        connectData.data.connectUrl,
        'linkedin_auth',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      
      if (!popup) {
        // Popup blocked - fall back to redirect
        toast.info("Opening LinkedIn authorization...");
        window.location.href = connectData.data.connectUrl;
        return;
      }

      toast.info("Complete authorization in the popup window. It will close automatically when done.", {
        duration: 8000,
      });
      
      // Focus the popup
      popup.focus();

      // Poll for connection while popup is open
      let attempts = 0;
      const maxAttempts = 90; // 3 minutes
      let pollIntervalMs = 2000;
      
      const checkConnection = async (): Promise<boolean> => {
        try {
          const { data } = await supabase.functions.invoke("linkedin-api", {
            body: { action: "get-accounts" },
          });

          const accounts = data?.data?.accounts || data?.data || [];
          const activeLinkedIn = Array.isArray(accounts)
            ? accounts.filter((a: any) => a?.platform === "linkedin" && a?.isActive !== false)
            : [];

          if (activeLinkedIn.length > 0) {
            localStorage.removeItem("getlate_enabling_publishing");
            
            // Close popup if still open
            if (popup && !popup.closed) {
              popup.close();
            }
            
            setIsConnecting(false);
            
            // If multiple accounts, show selector; otherwise auto-select
            if (activeLinkedIn.length > 1) {
              setShowAccountSelector(true);
            } else {
              // Single account - auto-select
              const account = activeLinkedIn[0];
              localStorage.setItem("getlate_account_id", account._id || account.id);
              toast.success("LinkedIn Connected!", {
                description: "You can now publish posts, mention people, and track analytics.",
              });
              onEnabled();
            }
            return true;
          }
        } catch (err) {
          console.log("Polling for connection...");
        }
        return false;
      };
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        // Check if popup was closed by user
        if (popup && popup.closed) {
          // Poll faster for a bit after popup closes (user may have completed auth)
          pollIntervalMs = 1000;
          
          // Do an immediate check
          const connected = await checkConnection();
          if (connected) {
            clearInterval(pollInterval);
            return;
          }
        }
        
        const connected = await checkConnection();
        if (connected) {
          clearInterval(pollInterval);
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setIsConnecting(false);
          localStorage.removeItem("getlate_enabling_publishing");
          toast.error("Connection timed out. Please try again.");
        }
      }, pollIntervalMs);
      
    } catch (error: any) {
      console.error("Enable publishing error:", error);
      toast.error(error.message || "Failed to start LinkedIn publishing setup");
      setIsConnecting(false);
    }
  };

  const features = [
    { icon: Share2, title: "Publish Posts", desc: "Post directly to LinkedIn" },
    { icon: AtSign, title: "@Mentions", desc: "Tag people and companies" },
    { icon: BarChart3, title: "Analytics", desc: "Track post performance" },
  ];

  // Show account selector after OAuth completes with multiple accounts
  if (showAccountSelector) {
    return (
      <LinkedInAccountSelector
        onAccountSelected={() => onEnabled()}
        onCancel={() => setShowAccountSelector(false)}
      />
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center animate-fade-in">
        {/* Welcome message */}
        <div className="mb-6">
          <p className="text-lg text-muted-foreground">
            Welcome{userName ? `, ${userName}` : ""}! 👋
          </p>
        </div>

        {/* Logo */}
        <div className="mb-8 inline-flex">
          <div className="w-20 h-20 rounded-2xl gradient-linkedin flex items-center justify-center shadow-glow animate-pulse-soft">
            <Linkedin className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
          Enable LinkedIn
          <br />
          <span className="text-primary">Publishing</span>
        </h1>

        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
          Connect your LinkedIn account to publish posts, mention people, and track analytics.
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-lg mx-auto">
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

        {/* Enable Button */}
        <Button
          variant="linkedin"
          size="xl"
          onClick={handleEnablePublishing}
          disabled={isConnecting}
          className="group"
        >
          {isConnecting ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Connecting...
            </span>
          ) : (
            <>
              <Linkedin className="h-5 w-5" />
              Enable Publishing
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          A secure popup will open for LinkedIn authorization
        </p>

        {userEmail && (
          <div className="mt-8 pt-6 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-2">
              Signed in as <span className="font-medium text-foreground">{userEmail}</span>
            </p>
            {onSignOut && (
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
