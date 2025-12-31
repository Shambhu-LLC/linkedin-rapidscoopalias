import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Processing LinkedIn login...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle LinkedIn error response
      if (error) {
        setStatus(`LinkedIn error: ${errorDescription || error}`);
        toast({
          title: "LinkedIn Error",
          description: errorDescription || error || "LinkedIn authentication was denied",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      if (!code) {
        setStatus("No authorization code received");
        toast({
          title: "Error",
          description: "No authorization code received from LinkedIn",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      setStatus("Exchanging code with LinkedIn...");

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;

        const response = await fetch(
          `https://dmtnwfdjcapiketfcrur.supabase.co/functions/v1/linkedin-auth`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdG53ZmRqY2FwaWtldGZjcnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzI5NDYsImV4cCI6MjA4MjU0ODk0Nn0.DXd0p-g6XieguHmEdkUlv2P3OlKfmUkC3T12UcBA8RE`,
            },
            body: JSON.stringify({ action: "callback", code, redirectUri }),
          }
        );

        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Authentication failed");
        }

        setStatus("Signing you in...");

        // Use the magic link to sign in
        if (result.magicLink) {
          const magicLinkUrl = new URL(result.magicLink);
          const token = magicLinkUrl.searchParams.get("token");

          if (token) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: "magiclink",
            });

            if (verifyError) {
              throw new Error("Failed to complete sign in: " + verifyError.message);
            }

            toast({
              title: result.isNewUser ? "Account Created!" : "Welcome Back!",
              description: `Signed in as ${result.user.email}`,
            });

            localStorage.removeItem("linkedin_oauth_state");
            navigate("/");
            return;
          }
        }

        throw new Error("Invalid authentication response - no magic link");
      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
        toast({
          title: "Authentication Failed",
          description: err.message || "Failed to complete LinkedIn sign in",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 3000);
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
            <p className="text-muted-foreground text-center">{status}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
