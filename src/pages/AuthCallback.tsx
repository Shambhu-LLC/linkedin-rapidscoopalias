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
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      const state = searchParams.get("state");
      const storedState = localStorage.getItem("linkedin_oauth_state");

      console.log("AuthCallback - URL params:", { code: !!code, error, state, storedState });

      // Handle LinkedIn error response
      if (error) {
        console.error("LinkedIn returned error:", error, errorDescription);
        toast({
          title: "LinkedIn Error",
          description: errorDescription || error || "LinkedIn authentication was denied",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (!code) {
        toast({
          title: "Error",
          description: "No authorization code received from LinkedIn",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (state !== storedState) {
        console.error("State mismatch:", { received: state, stored: storedState });
        toast({
          title: "Security Error",
          description: "OAuth state mismatch. Please try again.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;
        console.log("Calling linkedin-auth callback with redirectUri:", redirectUri);

        const { data, error: invokeError } = await supabase.functions.invoke(
          "linkedin-auth",
          { body: { action: "callback", code, redirectUri } }
        );

        if (invokeError) {
          console.error("LinkedIn callback invoke error:", invokeError);
          throw new Error(invokeError.message || "Authentication failed");
        }

        const result: any = data;
        console.log("Edge function result:", result);

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
