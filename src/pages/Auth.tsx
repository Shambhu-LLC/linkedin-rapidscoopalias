import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Linkedin, Loader2, Share2, BarChart3, AtSign } from "lucide-react";

/**
 * Auth page - LinkedIn-only authentication via GetLate
 * Users authenticate by connecting their LinkedIn account
 */
const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

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

  const handleLinkedInLogin = async () => {
    setIsLoading(true);
    try {
      // Step 1: Create or get profile from GetLate.dev (backend-only)
      const { data: profileData, error: profileError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "create-profile", name: "LinkedInUsers" },
      });

      if (profileError) throw profileError;
      if (!profileData?.success || !profileData?.data?.profileId) {
        throw new Error("Failed to initialize connection");
      }

      const profileId = profileData.data.profileId;
      
      // Store profileId for callback (never exposed in UI)
      localStorage.setItem("getlate_profile_id", profileId);
      localStorage.setItem("linkedin_auth_mode", "login");

      // Step 2: Get the GetLate OAuth connect URL with callback
      const callbackUrl = `${window.location.origin}/auth/linkedin/callback`;
      const { data: connectData, error: connectError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "get-connect-url", profileId, callbackUrl },
      });

      if (connectError) throw connectError;
      if (!connectData?.success || !connectData?.data?.connectUrl) {
        console.error("Connect data:", connectData);
        throw new Error("Failed to get authorization URL");
      }

      // Step 3: Redirect to LinkedIn OAuth (via GetLate)
      window.location.href = connectData.data.connectUrl;
      
    } catch (error: any) {
      console.error("LinkedIn login error:", error);
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Share2, title: "Publish Posts", desc: "Post directly to LinkedIn" },
    { icon: AtSign, title: "@Mentions", desc: "Tag people and companies" },
    { icon: BarChart3, title: "Analytics", desc: "Track post performance" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl gradient-linkedin flex items-center justify-center shadow-glow">
            <Linkedin className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            LinkedIn Publisher
          </CardTitle>
          <CardDescription>
            Sign in with LinkedIn to manage your posts, mentions, and analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features */}
          <div className="grid grid-cols-3 gap-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-muted/50 border border-border text-center"
                >
                  <Icon className="h-5 w-5 text-primary mb-1 mx-auto" />
                  <p className="text-xs font-medium">{feature.title}</p>
                </div>
              );
            })}
          </div>

          {/* LinkedIn Sign In Button */}
          <Button
            onClick={handleLinkedInLogin}
            disabled={isLoading}
            variant="linkedin"
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting to LinkedIn...
              </>
            ) : (
              <>
                <Linkedin className="mr-2 h-5 w-5" />
                Continue with LinkedIn
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            You'll be redirected to LinkedIn to authorize access.
            <br />
            We never see your LinkedIn password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
