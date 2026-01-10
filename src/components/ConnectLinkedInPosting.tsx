import { useState, useEffect, useRef } from "react";
import { Linkedin, Share2, ArrowRight, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { linkedinPostingApi } from "@/lib/linkedin-posting-api";

interface ConnectLinkedInPostingProps {
  onConnected: () => void;
  onSignOut?: () => void;
  userEmail?: string;
  userName?: string;
}

export function ConnectLinkedInPosting({
  onConnected,
  onSignOut,
  userEmail,
  userName,
}: ConnectLinkedInPostingProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for messages from the OAuth popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'linkedin-posting-callback') {
        console.log("Received callback message:", event.data);
        
        // Clear the polling interval
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        if (event.data.success && event.data.code) {
          try {
            toast.info("Exchanging authorization code...");
            
            // Make the API call from this window (which has the authenticated session)
            const user = await linkedinPostingApi.handleCallback(
              event.data.code,
              event.data.redirectUri
            );
            
            toast.success(`Connected as ${user.name}!`);
            onConnected();
          } catch (error: any) {
            console.error("Callback handling error:", error);
            toast.error(error.message || "Failed to complete LinkedIn connection");
          }
        } else if (!event.data.success) {
          toast.error(event.data.error || "LinkedIn connection failed");
        }
        
        setIsConnecting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConnected]);

  const handleConnectLinkedIn = async () => {
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/linkedin-posting/callback`;
      
      // Get authorization URL
      const { url, state } = await linkedinPostingApi.getAuthUrl(redirectUri);
      
      // Store state for verification
      localStorage.setItem("linkedin_posting_oauth_state", state);
      localStorage.setItem("linkedin_posting_redirect_uri", redirectUri);
      
      // Open OAuth popup
      const popupWidth = 600;
      const popupHeight = 700;
      const left = Math.max(0, (window.screen.width - popupWidth) / 2);
      const top = Math.max(0, (window.screen.height - popupHeight) / 2);
      
      const popup = window.open(
        url,
        "linkedin_posting_auth",
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      
      if (!popup) {
        toast.error("Popup blocked. Please allow popups and try again.");
        setIsConnecting(false);
        return;
      }
      
      popupRef.current = popup;
      
      toast.info("Complete authorization in the popup window", {
        description: "Connect your LinkedIn account for posting",
        duration: 8000,
      });
      
      // Poll for popup closure (as backup in case message isn't received)
      pollIntervalRef.current = setInterval(async () => {
        if (popup.closed) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          // Give a moment for message to be processed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if still connecting (message handler didn't fire)
          if (isConnecting) {
            // Check if connection was successful anyway
            const { connected } = await linkedinPostingApi.getPostingAccount();
            
            if (connected) {
              toast.success("LinkedIn connected for posting!");
              onConnected();
            } else {
              toast.error("Connection was not completed. Please try again.");
            }
            
            setIsConnecting(false);
          }
        }
      }, 1000);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        setIsConnecting(false);
      }, 300000);
      
    } catch (error: any) {
      console.error("Connect LinkedIn error:", error);
      toast.error(error.message || "Failed to start LinkedIn connection");
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center animate-fade-in">
        {/* Welcome message */}
        <div className="mb-6">
          <p className="text-lg text-muted-foreground">
            Welcome{userName ? `, ${userName}` : ""}! 👋
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
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium animate-pulse">
              2
            </div>
            <span className="text-sm font-medium">Connect LinkedIn</span>
          </div>
          <div className="w-8 h-0.5 bg-muted" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-sm text-muted-foreground">Enable Features</span>
          </div>
        </div>

        {/* Logo */}
        <div className="mb-8 inline-flex">
          <div className="w-20 h-20 rounded-2xl gradient-linkedin flex items-center justify-center shadow-glow animate-pulse-soft">
            <Linkedin className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
          Connect LinkedIn
          <br />
          <span className="text-primary">for Posting</span>
        </h1>

        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
          Connect your LinkedIn account to publish posts directly from this app.
        </p>

        {/* Feature highlight */}
        <div className="inline-flex items-center gap-3 p-4 rounded-xl bg-card shadow-sm border border-border mb-8">
          <Share2 className="h-6 w-6 text-primary" />
          <div className="text-left">
            <h3 className="font-semibold text-sm">Direct Posting</h3>
            <p className="text-xs text-muted-foreground">Post to LinkedIn without leaving the app</p>
          </div>
        </div>

        {/* Connect Button */}
        <div className="space-y-4">
          <Button
            variant="linkedin"
            size="xl"
            onClick={handleConnectLinkedIn}
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
                <Linkedin className="h-5 w-5" />
                Connect LinkedIn
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            A popup will open for LinkedIn authorization. We only request permissions needed for posting.
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
