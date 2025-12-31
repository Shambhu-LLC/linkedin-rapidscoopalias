import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const debugKey = "linkedin_oauth_debug";
    const saveDebug = (partial: Record<string, any>) => {
      try {
        const existingRaw = localStorage.getItem(debugKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem(
          debugKey,
          JSON.stringify({ ...existing, ...partial, updatedAt: new Date().toISOString() })
        );
      } catch {
        // ignore
      }
    };

    const serializeError = (err: any) => {
      if (!err) return null;
      return {
        name: err?.name,
        message: err?.message ?? String(err),
        stack: err?.stack,
      };
    };

    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      const state = searchParams.get("state");
      const storedState = localStorage.getItem("linkedin_oauth_state");

      saveDebug({
        stage: "callback_loaded",
        href: window.location.href,
        params: { code: !!code, error, errorDescription, state, storedState },
      });

      console.log("AuthCallback - Full URL:", window.location.href);
      console.log("AuthCallback - URL params:", { code: !!code, error, state, storedState });
      console.log("AuthCallback - URL params:", { code: !!code, error, state, storedState });

      // Handle LinkedIn error response
      if (error) {
        console.error("LinkedIn returned error:", error, errorDescription);
        saveDebug({ stage: "linkedin_error_param", error: { message: errorDescription || error } });
        toast({
          title: "LinkedIn Error",
          description: errorDescription || error || "LinkedIn authentication was denied",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (!code) {
        console.error("No code in URL params");
        saveDebug({ stage: "no_code", error: { message: "No authorization code received" } });
        toast({
          title: "Error",
          description: "No authorization code received from LinkedIn",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Only block if we DO have a storedState (same browser context) and it mismatches.
      if (storedState && state && state !== storedState) {
        console.error("State mismatch:", { received: state, stored: storedState });
        saveDebug({
          stage: "state_mismatch",
          error: { message: "OAuth state mismatch" },
        });
        toast({
          title: "Security Error",
          description: "OAuth state mismatch. Please try again.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (!storedState) {
        console.warn("No stored OAuth state found; continuing (likely new tab).", { state });
        saveDebug({ stage: "no_stored_state", note: "Continuing without stored state" });
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        console.log("Calling linkedin-auth callback with redirectUri:", redirectUri);
        saveDebug({ stage: "invoking_backend", redirectUri });

        const { data, error: invokeError } = await supabase.functions.invoke(
          "linkedin-auth",
          { body: { action: "callback", code, redirectUri } }
        );

        if (invokeError) {
          console.error("LinkedIn callback invoke error:", invokeError);
          saveDebug({ stage: "invoke_error", error: serializeError(invokeError) });
          throw new Error(invokeError.message || "Authentication failed");
        }

        const result: any = data;
        console.log("Edge function result:", result);
        saveDebug({ stage: "backend_result", result });

        if (!result || !result.success) {
          throw new Error(result?.error || "Authentication failed");
        }

        // Use the magic link to sign in
        if (result.magicLink) {
          const magicLinkUrl = new URL(result.magicLink);
          const token = magicLinkUrl.searchParams.get("token");
          const type = magicLinkUrl.searchParams.get("type");

          console.log("Processing magic link, token exists:", !!token);

          if (token) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: (type as "magiclink") || "magiclink",
            });

            if (verifyError) {
              console.error("OTP verification error:", verifyError);
              throw new Error("Failed to complete sign in");
            }

            toast({
              title: result.isNewUser ? "Account Created!" : "Welcome Back!",
              description: `Signed in as ${result.user.email}`,
            });

            // Clear OAuth state
            localStorage.removeItem("linkedin_oauth_state");
            navigate("/");
            return;
          }
        }

        throw new Error("Invalid authentication response");
      } catch (error: any) {
        console.error("LinkedIn callback error:", error);
        saveDebug({ stage: "callback_error", error: serializeError(error) });
        toast({
          title: "Authentication Failed",
          description: error.message || "Failed to complete LinkedIn sign in",
          variant: "destructive",
        });
        navigate("/auth");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Completing sign in...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
