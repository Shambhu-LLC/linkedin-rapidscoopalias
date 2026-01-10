import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Processing LinkedIn login...");
  const processingRef = useRef(false);

  const locationInfo = useMemo(() => {
    return {
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
    };
  }, []);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double processing of the same callback
      if (processingRef.current) {
        console.log("Callback already being processed, skipping...");
        return;
      }
      
      // Check sessionStorage to prevent re-processing on page refresh
      const callbackProcessed = sessionStorage.getItem("linkedin_callback_processing");
      if (callbackProcessed) {
        console.log("Callback already processed in this session");
        setStatus("Authentication in progress...");
        return;
      }

      processingRef.current = true;
      sessionStorage.setItem("linkedin_callback_processing", "true");

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      const code = searchParams.get("code") ?? hashParams.get("code");
      const state = searchParams.get("state") ?? hashParams.get("state");
      const error = searchParams.get("error") ?? hashParams.get("error");
      const errorDescription =
        searchParams.get("error_description") ?? hashParams.get("error_description");

      // Validate OAuth state to prevent CSRF attacks
      const storedState = localStorage.getItem("linkedin_oauth_state");
      if (state && storedState && state !== storedState) {
        console.error("OAuth state mismatch - possible CSRF attack");
        setStatus("Security validation failed");
        toast({
          title: "Security Error",
          description: "OAuth state validation failed. Please try again.",
          variant: "destructive",
        });
        cleanupAndRedirect();
        return;
      }

      if (error) {
        console.error("LinkedIn OAuth error:", error, errorDescription);
        setStatus(`LinkedIn error: ${errorDescription || error}`);
        toast({
          title: "LinkedIn Error",
          description: errorDescription || error || "LinkedIn authentication was denied",
          variant: "destructive",
        });
        cleanupAndRedirect();
        return;
      }

      if (!code) {
        setStatus("No authorization code received");
        toast({
          title: "Error",
          description: "No authorization code received from LinkedIn",
          variant: "destructive",
        });
        processingRef.current = false;
        sessionStorage.removeItem("linkedin_callback_processing");
        // Stop here so user can copy the URL details below.
        return;
      }

      setStatus("Exchanging code...");

      try {
        // Use the stored redirect URI to ensure consistency
        const storedRedirectUri = localStorage.getItem("linkedin_redirect_uri");
        const projectId = "766d7c6b-1e28-4576-adc3-731a894fadda";
        const redirectUri = storedRedirectUri || `https://${projectId}.lovableproject.com/auth/callback`;

        console.log("Exchanging code with redirect URI:", redirectUri);

        const { data: result, error: invokeError } = await supabase.functions.invoke(
          "linkedin-auth",
          { body: { action: "callback", code, redirectUri } }
        );

        if (invokeError) throw invokeError;
        if (!result?.success) throw new Error(result?.error || "Authentication failed");

        setStatus("Signing you in...");

        if (result.magicLink) {
          // Store pending toast info before redirecting
          localStorage.setItem("linkedin_pending_toast", JSON.stringify({
            isNewUser: result.isNewUser,
            email: result.user.email,
          }));
          
          // Clean up OAuth state
          localStorage.removeItem("linkedin_oauth_state");
          localStorage.removeItem("linkedin_redirect_uri");
          sessionStorage.removeItem("linkedin_callback_processing");
          
          // Redirect to the magic link
          window.location.href = result.magicLink;
          return;
        }

        throw new Error("Invalid authentication response (missing token)");
      } catch (err: any) {
        console.error("LinkedIn callback error:", err);
        setStatus(`Error: ${err?.message ?? "Unknown error"}`);
        toast({
          title: "Authentication Failed",
          description: err?.message || "Failed to complete LinkedIn sign in",
          variant: "destructive",
        });
        cleanupAndRedirect();
      }
    };

    const cleanupAndRedirect = () => {
      localStorage.removeItem("linkedin_oauth_state");
      localStorage.removeItem("linkedin_redirect_uri");
      sessionStorage.removeItem("linkedin_callback_processing");
      processingRef.current = false;
      setTimeout(() => navigate("/auth"), 1200);
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <h1 className="sr-only">LinkedIn sign-in callback</h1>
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-center">{status}</p>

            {status === "No authorization code received" && (
              <div className="w-full space-y-2">
                <p className="text-xs text-muted-foreground break-all">
                  <span className="font-medium">URL:</span> {locationInfo.href}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      JSON.stringify(locationInfo, null, 2)
                    );
                    toast({
                      title: "Copied",
                      description: "Callback URL details copied.",
                    });
                  }}
                >
                  Copy callback URL details
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default AuthCallback;
