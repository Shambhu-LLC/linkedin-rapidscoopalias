import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isLinkedInLoading, setIsLinkedInLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          navigate("/");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred during authentication",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkedInLogin = async () => {
    setIsLinkedInLoading(true);

    try {
      const redirectUri = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.functions.invoke("linkedin-auth", {
        body: { action: "authorize", redirectUri },
      });

      if (error) throw error;
      if (!data?.url || !data?.state) {
        throw new Error(data?.error || "Failed to initiate LinkedIn login");
      }

      // Store state and redirect URI for validation in callback
      localStorage.setItem("linkedin_oauth_state", data.state);
      localStorage.setItem("linkedin_redirect_uri", redirectUri);

      // Open LinkedIn OAuth in a popup (same pattern as posting flow)
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.url,
        "linkedin-auth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      // Listen for postMessage from the popup
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "linkedin-auth-callback") return;

        window.removeEventListener("message", handleMessage);

        if (!event.data.success) {
          toast({
            title: "LinkedIn Login Failed",
            description: event.data.error || "Authentication was denied",
            variant: "destructive",
          });
          setIsLinkedInLoading(false);
          return;
        }

        try {
          // Exchange code for session (parent window makes the API call)
          const { data: result, error: invokeError } = await supabase.functions.invoke(
            "linkedin-auth",
            { body: { action: "callback", code: event.data.code, redirectUri: event.data.redirectUri } }
          );

          if (invokeError) throw invokeError;
          if (!result?.success) throw new Error(result?.error || "Authentication failed");

          if (result.magicLink) {
            // Follow the magic link to establish session
            window.location.href = result.magicLink;
            return;
          }

          throw new Error("Invalid authentication response");
        } catch (err: any) {
          console.error("LinkedIn auth error:", err);
          toast({
            title: "Authentication Failed",
            description: err?.message || "Failed to complete LinkedIn sign in",
            variant: "destructive",
          });
          setIsLinkedInLoading(false);
        }
      };

      window.addEventListener("message", handleMessage);

      // Reset loading if popup is closed without completing
      const checkClosed = setInterval(() => {
        // We can't easily check popup.closed with the current pattern,
        // so just set a timeout fallback
      }, 1000);
      setTimeout(() => {
        clearInterval(checkClosed);
        setIsLinkedInLoading(false);
      }, 120000); // 2 min timeout
    } catch (error: any) {
      console.error("LinkedIn login error:", error);
      toast({
        title: "Login Error",
        description: error.message || "Failed to initiate LinkedIn login",
        variant: "destructive",
      });
      setIsLinkedInLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </CardTitle>
          <CardDescription>
            {isSignUp ? "Sign up to get started" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            onClick={handleLinkedInLogin}
            disabled={isLinkedInLoading}
            variant="outline"
            className="w-full"
            size="lg"
          >
            {isLinkedInLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" fill="#0A66C2" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Continue with LinkedIn
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
