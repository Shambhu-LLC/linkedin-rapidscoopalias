import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Callback page for LinkedIn OAuth via GetLate
 * Handles both login (new user creation) and account linking flows
 */
const LinkedInCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing LinkedIn authentication...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for errors from GetLate/LinkedIn
        const error = searchParams.get("error");
        if (error) {
          throw new Error(searchParams.get("error_description") || error);
        }

        const authMode = localStorage.getItem("linkedin_auth_mode");
        
        // Poll for connected accounts to verify the connection succeeded
        setMessage("Verifying LinkedIn connection...");
        
        let attempts = 0;
        const maxAttempts = 10;
        let linkedInAccount: any = null;

        while (attempts < maxAttempts && !linkedInAccount) {
          const { data, error: apiError } = await supabase.functions.invoke("linkedin-api", {
            body: { action: "get-accounts" },
          });

          if (apiError) throw apiError;

          const accounts = data?.data?.accounts || data?.data || [];
          const activeLinkedIn = Array.isArray(accounts) 
            ? accounts.filter((a: any) => a?.platform === "linkedin" && a?.isActive !== false)
            : [];

          if (activeLinkedIn.length > 0) {
            linkedInAccount = activeLinkedIn[activeLinkedIn.length - 1]; // Get the most recently added
            break;
          }

          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (!linkedInAccount) {
          throw new Error("LinkedIn connection could not be verified. Please try again.");
        }

        // Check if user is already logged in (adding account) or needs to login/signup
        const { data: { session } } = await supabase.auth.getSession();
        
        if (authMode === "login" && !session) {
          // Create or sign in user based on LinkedIn account
          setMessage("Setting up your account...");
          
          const { data: authData, error: authError } = await supabase.functions.invoke("linkedin-api", {
            body: { 
              action: "authenticate-user",
              linkedInAccountId: linkedInAccount._id || linkedInAccount.id,
              displayName: linkedInAccount.displayName,
              platformUserId: linkedInAccount.platformUserId,
              profilePicture: linkedInAccount.metadata?.profilePicture,
            },
          });

          if (authError) throw authError;
          if (!authData?.success || !authData?.data?.token) {
            throw new Error("Failed to authenticate user");
          }

          // Sign in with the custom token
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: authData.data.email,
            password: authData.data.password,
          });

          if (signInError) {
            // If user doesn't exist, create them
            if (signInError.message.includes("Invalid login credentials")) {
              const { error: signUpError } = await supabase.auth.signUp({
                email: authData.data.email,
                password: authData.data.password,
                options: {
                  data: {
                    full_name: linkedInAccount.displayName,
                    avatar_url: linkedInAccount.metadata?.profilePicture,
                    linkedin_id: linkedInAccount.platformUserId,
                  },
                },
              });
              if (signUpError) throw signUpError;
            } else {
              throw signInError;
            }
          }
        }

        // Sync the LinkedIn account to our database
        setMessage("Syncing LinkedIn account...");
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          await supabase.functions.invoke("linkedin-api", {
            body: { 
              action: "sync-account",
              linkedInAccountId: linkedInAccount._id || linkedInAccount.id,
              userId: currentSession.user.id,
              displayName: linkedInAccount.displayName,
              platformUserId: linkedInAccount.platformUserId,
              profilePicture: linkedInAccount.metadata?.profilePicture,
              headline: linkedInAccount.metadata?.headline,
              setActive: authMode === "add-account" ? false : true,
            },
          });
        }

        // Clean up
        localStorage.removeItem("linkedin_auth_mode");
        localStorage.removeItem("getlate_profile_id");
        localStorage.setItem("getlate_account_id", linkedInAccount._id || linkedInAccount.id);
        
        setStatus("success");
        setMessage(authMode === "add-account" 
          ? "LinkedIn account added successfully!"
          : "Welcome! LinkedIn connected successfully!");
        
        toast.success(authMode === "add-account" ? "Account Added!" : "Welcome!", {
          description: `Connected as ${linkedInAccount.displayName}`,
        });

        setTimeout(() => navigate("/"), 1500);
        
      } catch (err: any) {
        console.error("LinkedIn callback error:", err);
        setStatus("error");
        setMessage(err.message || "Failed to complete LinkedIn connection");
        localStorage.removeItem("linkedin_auth_mode");
        localStorage.removeItem("getlate_profile_id");
        
        toast.error("Connection Failed", {
          description: err.message || "Please try again",
        });

        setTimeout(() => navigate("/auth"), 3000);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">{message}</p>
            </>
          )}
          
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium text-green-600">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
            </>
          )}
          
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium text-destructive">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkedInCallback;
