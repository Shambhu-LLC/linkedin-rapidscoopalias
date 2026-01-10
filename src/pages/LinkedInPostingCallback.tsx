import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { linkedinPostingApi } from "@/lib/linkedin-posting-api";

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

        setStatus("Exchanging authorization code...");

        // Get the redirect URI that was used
        const redirectUri = localStorage.getItem("linkedin_posting_redirect_uri") || 
          `${window.location.origin}/linkedin-posting/callback`;

        // Exchange code for token
        const user = await linkedinPostingApi.handleCallback(code, redirectUri);

        setStatus(`Connected as ${user.name}! Closing...`);

        // Clean up
        localStorage.removeItem("linkedin_posting_oauth_state");
        localStorage.removeItem("linkedin_posting_redirect_uri");

        // Close popup
        setTimeout(() => window.close(), 1500);
      } catch (error: any) {
        console.error("Callback error:", error);
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
