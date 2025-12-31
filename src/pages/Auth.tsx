import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = sessionStorage.getItem("linkedin_oauth_state");

    if (code && state) {
      if (state !== storedState) {
        toast({
          title: "Security Error",
          description: "OAuth state mismatch. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setIsProcessingCallback(true);
      handleLinkedInCallback(code);
    }
  }, [searchParams]);

  const handleLinkedInCallback = async (code: string) => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      const response = await supabase.functions.invoke("linkedin-auth", {
        body: { code, redirectUri },
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Handle the function invoke response properly
      const result = response.data;
      
      if (!result || !result.success) {
        throw new Error(result?.error || response.error?.message || "Authentication failed");
      }

      // Use the magic link to sign in
      if (result.magicLink) {
        // Extract the token from magic link and verify it
        const magicLinkUrl = new URL(result.magicLink);
        const token = magicLinkUrl.searchParams.get("token");
        const type = magicLinkUrl.searchParams.get("type");
        
        if (token) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as "magiclink" || "magiclink",
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
          sessionStorage.removeItem("linkedin_oauth_state");
          navigate("/");
        }
      }
    } catch (error: any) {
      console.error("LinkedIn callback error:", error);
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to complete LinkedIn sign in",
        variant: "destructive",
      });
    } finally {
      setIsProcessingCallback(false);
    }
  };

  const handleLinkedInLogin = async () => {
    setIsLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-auth?action=authorize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ redirectUri }),
        }
      );

      const result = await response.json();
      
      if (!result || result.error) {
        throw new Error(result?.error || "Failed to initiate LinkedIn login");
      }

      // Store state for verification
      sessionStorage.setItem("linkedin_oauth_state", result.state);

      // Redirect to LinkedIn
      window.location.href = result.url;
    } catch (error: any) {
      console.error("LinkedIn login error:", error);
      toast({
        title: "Login Error",
        description: error.message || "Failed to initiate LinkedIn login",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  if (isProcessingCallback) {
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
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
          <CardDescription>
            Sign in with your LinkedIn account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLinkedInLogin}
            disabled={isLoading}
            className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg
                  className="mr-2 h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Sign in with LinkedIn
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
