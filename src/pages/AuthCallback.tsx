import { useEffect, useMemo, useState } from "react";
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

  const locationInfo = useMemo(() => {
    return {
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
    };
  }, []);

  useEffect(() => {
    const handleCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      const code = searchParams.get("code") ?? hashParams.get("code");
      const error = searchParams.get("error") ?? hashParams.get("error");
      const errorDescription =
        searchParams.get("error_description") ?? hashParams.get("error_description");

      if (error) {
        setStatus(`LinkedIn error: ${errorDescription || error}`);
        toast({
          title: "LinkedIn Error",
          description: errorDescription || error || "LinkedIn authentication was denied",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 800);
        return;
      }

      if (!code) {
        setStatus("No authorization code received");
        toast({
          title: "Error",
          description: "No authorization code received from LinkedIn",
          variant: "destructive",
        });
        // Stop here so user can copy the URL details below.
        return;
      }

      setStatus("Exchanging code...");

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;

        const { data: result, error: invokeError } = await supabase.functions.invoke(
          "linkedin-auth",
          { body: { action: "callback", code, redirectUri } }
        );

        if (invokeError) throw invokeError;
        if (!result?.success) throw new Error(result?.error || "Authentication failed");

        setStatus("Signing you in...");

        if (result.magicLink) {
          const magicLinkUrl = new URL(result.magicLink);
          const token = magicLinkUrl.searchParams.get("token");

          if (token) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: "magiclink",
            });

            if (verifyError) throw verifyError;

            toast({
              title: result.isNewUser ? "Account Created!" : "Welcome Back!",
              description: `Signed in as ${result.user.email}`,
            });

            localStorage.removeItem("linkedin_oauth_state");
            navigate("/");
            return;
          }
        }

        throw new Error("Invalid authentication response (missing token)");
      } catch (err: any) {
        setStatus(`Error: ${err?.message ?? "Unknown error"}`);
        toast({
          title: "Authentication Failed",
          description: err?.message || "Failed to complete LinkedIn sign in",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 1200);
      }
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
