import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Callback page for GetLate OAuth flow
 * GetLate redirects back here after the user authorizes LinkedIn publishing
 */
const GetLateCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing LinkedIn connection...");
  const [canRetry, setCanRetry] = useState(false);

  const verifyConnection = async () => {
    setStatus("loading");
    setMessage("Verifying LinkedIn connection...");
    setCanRetry(false);
    
    try {
      // Check if we have auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("error");
        setMessage("You must be signed in to complete this action.");
        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      // Check for errors from GetLate
      const error = searchParams.get("error");
      if (error) {
        throw new Error(searchParams.get("error_description") || error);
      }

      // Poll for connected accounts to verify the connection succeeded
      let attempts = 0;
      const maxAttempts = 10;
      let connected = false;

      while (attempts < maxAttempts && !connected) {
        const { data, error: apiError } = await supabase.functions.invoke("linkedin-api", {
          body: { action: "get-accounts" },
        });

        if (apiError) throw apiError;

        const accounts = data?.data?.accounts || data?.data || [];
        const activeLinkedIn = Array.isArray(accounts) 
          ? accounts.filter((a: any) => a?.platform === "linkedin" && a?.isActive !== false)
          : [];

        if (activeLinkedIn.length > 0) {
          connected = true;
          
          // Store the account info and mark publishing as enabled
          const account = activeLinkedIn[0];
          localStorage.setItem("getlate_account_id", account._id || account.id);
          localStorage.removeItem("getlate_enabling_publishing");
          localStorage.removeItem("getlate_callback_origin");
          
          setStatus("success");
          setMessage("LinkedIn publishing enabled successfully!");
          
          toast.success("LinkedIn Connected!", {
            description: "You can now publish posts, mention people, and track analytics.",
          });

          setTimeout(() => navigate("/"), 1500);
          return;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (!connected) {
        throw new Error("LinkedIn connection could not be verified. Please try again.");
      }

    } catch (err: any) {
      console.error("GetLate callback error:", err);
      setStatus("error");
      setMessage(err.message || "Failed to complete LinkedIn connection");
      setCanRetry(true);
      localStorage.removeItem("getlate_enabling_publishing");
      
      toast.error("Connection Failed", {
        description: err.message || "Please try again",
      });
    }
  };

  useEffect(() => {
    verifyConnection();
  }, [navigate, searchParams]);

  const handleRetry = () => {
    navigate("/");
  };

  const handleGoHome = () => {
    localStorage.removeItem("getlate_enabling_publishing");
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">This may take a few seconds...</p>
            </>
          )}
          
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium text-green-600">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting to dashboard...</p>
            </>
          )}
          
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium text-destructive">{message}</p>
              
              {canRetry && (
                <div className="mt-6 space-y-3">
                  <Button onClick={handleRetry} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button variant="ghost" onClick={handleGoHome} className="w-full">
                    Go to Dashboard
                  </Button>
                </div>
              )}
              
              {!canRetry && (
                <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GetLateCallback;
