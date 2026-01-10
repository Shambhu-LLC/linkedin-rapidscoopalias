import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LinkedInPostingCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Processing LinkedIn authorization...");
  const processingRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          setStatus(`Error: ${errorDescription || error}`);
          setTimeout(() => window.close(), 3000);
          return;
        }

        if (!code) {
          setStatus("No authorization code received");
          setTimeout(() => window.close(), 3000);
          return;
        }

        // Verify state
        const savedState = localStorage.getItem("linkedin_posting_oauth_state");
        if (state && savedState && state !== savedState) {
          setStatus("State mismatch - possible security issue");
          setTimeout(() => window.close(), 3000);
          return;
        }

        setStatus("Sending authorization to main window...");

        // Get the redirect URI that was used
        const redirectUri = localStorage.getItem("linkedin_posting_redirect_uri") || 
          `${window.location.origin}/linkedin-posting/callback`;

        // Send the code to the parent window via postMessage
        // The parent window has the authenticated session and will make the API call
        if (window.opener) {
          window.opener.postMessage({
            type: 'linkedin-posting-callback',
            code,
            redirectUri,
            success: true
          }, window.location.origin);
          
          setStatus("Authorization sent! Closing...");
          setTimeout(() => window.close(), 1000);
        } else {
          throw new Error("Parent window not found. Please try again.");
        }

        // Clean up
        localStorage.removeItem("linkedin_posting_oauth_state");
        localStorage.removeItem("linkedin_posting_redirect_uri");

      } catch (error: any) {
        console.error("Callback error:", error);
        
        // Notify parent of error
        if (window.opener) {
          window.opener.postMessage({
            type: 'linkedin-posting-callback',
            success: false,
            error: error.message || "Failed to complete authorization"
          }, window.location.origin);
        }
        
        setStatus(`Error: ${error.message || "Failed to complete authorization"}`);
        setTimeout(() => window.close(), 3000);
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-center text-muted-foreground">{status}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
