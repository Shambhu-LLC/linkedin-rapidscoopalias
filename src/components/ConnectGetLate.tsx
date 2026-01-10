import { useState } from "react";
import { AtSign, BarChart3, Users, ArrowRight, LogOut, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LinkedInAccountSelector } from "./LinkedInAccountSelector";
import { linkedinPostingApi, PostingAccount } from "@/lib/linkedin-posting-api";

interface ConnectGetLateProps {
  onConnected: () => void;
  onSkip: () => void;
  onSignOut?: () => void;
  userEmail?: string;
  userName?: string;
  postingAccount?: PostingAccount | null;
}

export function ConnectGetLate({
  onConnected,
  onSkip,
  onSignOut,
  userEmail,
  userName,
  postingAccount,
}: ConnectGetLateProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);

  const handleConnectGetLate = async () => {
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
        throw new Error("Failed to get connect URL");
      }

      // Step 3: Open OAuth in a centered popup window
      const popupWidth = 600;
      const popupHeight = 700;
      const left = Math.max(0, (window.screen.width - popupWidth) / 2);
      const top = Math.max(0, (window.screen.height - popupHeight) / 2);

      const popup = window.open(
        connectData.data.connectUrl,
        "getlate_auth",
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        toast.error("Popup blocked. Please allow popups and try again.");
        setIsConnecting(false);
        return;
      }

      toast.info("Complete authorization in the popup window", {
        description: "Connect GetLate for @mentions and analytics",
        duration: 8000,
      });

      // Poll for connection
      let popupClosedAt: number | null = null;
      const maxAttempts = 120;
      let attempts = 0;

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
            if (popup && !popup.closed) {
              popup.close();
            }
            setIsConnecting(false);
            
            // Try to auto-match with posting account
            if (postingAccount) {
              const matchingAccount = activeLinkedIn.find(
                (a: any) => a?.platformUserId === postingAccount.linkedinId
              );

              if (matchingAccount) {
                // Found matching account - auto-link and proceed
                const getlateAccountId = matchingAccount._id || matchingAccount.id;
                localStorage.setItem("getlate_account_id", getlateAccountId);
                
                // Link in database
                try {
                  await linkedinPostingApi.linkGetLateAccount(getlateAccountId);
                } catch (e) {
                  console.log("Failed to link GetLate account in DB:", e);
                }
                
                toast.success(`Connected as ${matchingAccount.displayName || postingAccount.name}!`, {
                  description: "You can now use @mentions and analytics",
                });
                
                onConnected();
                return true;
              }
            }
            
            // No matching account found - show selector
            const accountName = activeLinkedIn[0]?.displayName || "LinkedIn";
            toast.success(`GetLate connected as ${accountName}!`, {
              description: "You can now use @mentions and analytics",
            });
            
            setShowAccountSelector(true);
            return true;
          }
        } catch (err) {
          console.log("Polling for GetLate connection...");
        }
        return false;
      };

      const pollInterval = setInterval(async () => {
        attempts++;

        if (popup && popup.closed && !popupClosedAt) {
          popupClosedAt = Date.now();
        }

        const connected = await checkConnection();
        if (connected) {
          clearInterval(pollInterval);
          return;
        }

        if (popupClosedAt && Date.now() - popupClosedAt > 15000) {
          clearInterval(pollInterval);
          setIsConnecting(false);
          toast.error("Connection not detected", {
            description: "Please try again or skip this step.",
          });
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setIsConnecting(false);
          toast.error("Connection timed out. Please try again.");
        }
      }, 1000);
    } catch (error: any) {
      console.error("Connect GetLate error:", error);
      toast.error(error.message || "Failed to start GetLate connection");
      setIsConnecting(false);
    }
  };

  if (showAccountSelector) {
    return (
      <LinkedInAccountSelector
        onAccountSelected={() => onConnected()}
        onCancel={() => onConnected()}
      />
    );
  }

  const features = [
    { icon: AtSign, title: "@Mentions", desc: "Tag people and companies" },
    { icon: BarChart3, title: "Analytics", desc: "Track post performance" },
    { icon: Users, title: "Multi-Account", desc: "Manage multiple LinkedIn accounts" },
  ];

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center animate-fade-in">
        {/* Welcome message */}
        <div className="mb-6">
          <p className="text-lg text-muted-foreground">
            Almost there{userName ? `, ${userName}` : ""}! 🎉
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              ✓
            </div>
            <span className="text-sm text-muted-foreground">Signed In</span>
          </div>
          <div className="w-8 h-0.5 bg-primary" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              ✓
            </div>
            <span className="text-sm text-muted-foreground">LinkedIn Connected</span>
          </div>
          <div className="w-8 h-0.5 bg-primary" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium animate-pulse">
              3
            </div>
            <span className="text-sm font-medium">Enable Features</span>
          </div>
        </div>

        {/* Logo */}
        <div className="mb-8 inline-flex">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-glow animate-pulse-soft">
            <AtSign className="h-10 w-10 text-white" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
          Enable
          <br />
          <span className="text-primary">Advanced Features</span>
        </h1>

        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
          Connect to unlock @mentions, analytics, and multi-account management.
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

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4">
          <Button
            variant="default"
            size="xl"
            onClick={handleConnectGetLate}
            disabled={isConnecting}
            className="group"
          >
            {isConnecting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </span>
            ) : (
              <>
                <AtSign className="h-5 w-5" />
                Enable Features
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="lg"
            onClick={onSkip}
            disabled={isConnecting}
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip for now
          </Button>

          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You can always enable these features later in Settings.
          </p>
        </div>

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
