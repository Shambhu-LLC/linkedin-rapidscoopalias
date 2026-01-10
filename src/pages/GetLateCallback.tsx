import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Callback page for GetLate OAuth flow
 * GetLate redirects back here after the user authorizes LinkedIn publishing
 * 
 * This page should:
 * 1. Verify the connection succeeded
 * 2. Auto-close the popup window if opened as popup
 * 3. Redirect to main app to show account selector
 */
const GetLateCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing LinkedIn connection...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we're in a popup window
        const isPopup = window.opener !== null;

        // Check if we have auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus("error");
          setMessage("You must be signed in to complete this action.");
          
          if (isPopup) {
            // Signal the parent window about the error
            try {
              window.opener?.postMessage({ type: "linkedin_auth_error", error: "not_signed_in" }, "*");
            } catch {}
            setTimeout(() => window.close(), 2000);
          } else {
            setTimeout(() => navigate("/auth"), 2000);
          }
          return;
        }

        // GetLate may pass accountId or other params - check for errors first
        const error = searchParams.get("error");
        if (error) {
          throw new Error(searchParams.get("error_description") || error);
        }

        // Poll for connected accounts to verify the connection succeeded
        setMessage("Verifying LinkedIn connection...");
        
        let attempts = 0;
        const maxAttempts = 15;
        let connected = false;
        let connectedAccounts: any[] = [];

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
            connectedAccounts = activeLinkedIn;
            
            // Set flag to show account selector on the main page
            localStorage.removeItem("getlate_enabling_publishing");
            localStorage.setItem("show_account_selector", "true");
            
            setStatus("success");
            const accountName = activeLinkedIn[0]?.displayName || "LinkedIn";
            setMessage(`Connected as ${accountName}!`);

            if (isPopup) {
              // Signal the parent window about success
              try {
                window.opener?.postMessage({ 
                  type: "linkedin_auth_success", 
                  accounts: activeLinkedIn.length 
                }, "*");
              } catch {}
              
              // Close popup after short delay
              setTimeout(() => window.close(), 1500);
            } else {
              setTimeout(() => navigate("/"), 1000);
            }
            return;
          }

          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!connected) {
          throw new Error("LinkedIn connection could not be verified. Please try again.");
        }

      } catch (err: any) {
        console.error("GetLate callback error:", err);
        setStatus("error");
        setMessage(err.message || "Failed to complete LinkedIn connection");
        localStorage.removeItem("getlate_enabling_publishing");

        const isPopup = window.opener !== null;
        
        toast.error("Connection Failed", {
          description: err.message || "Please try again",
        });

        if (isPopup) {
          try {
            window.opener?.postMessage({ type: "linkedin_auth_error", error: err.message }, "*");
          } catch {}
          setTimeout(() => window.close(), 3000);
        } else {
          setTimeout(() => navigate("/"), 3000);
        }
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
              <p className="text-sm text-muted-foreground mt-2">
                This window will close automatically...
              </p>
            </>
          )}
          
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium text-green-600">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {window.opener ? "Closing window..." : "Redirecting..."}
              </p>
            </>
          )}
          
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium text-destructive">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {window.opener ? "Closing window..." : "Redirecting..."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GetLateCallback;
