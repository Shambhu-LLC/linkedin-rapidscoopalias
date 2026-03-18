import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Processing LinkedIn login...");
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      setStatus(`Error: ${errorDescription || error}`);
      if (window.opener) {
        window.opener.postMessage(
          { type: "linkedin-auth-callback", success: false, error: errorDescription || error },
          window.location.origin
        );
      }
      setTimeout(() => window.close(), 3000);
      return;
    }

    if (!code) {
      setStatus("No authorization code received");
      setTimeout(() => window.close(), 3000);
      return;
    }

    // Verify state
    const savedState = localStorage.getItem("linkedin_oauth_state");
    if (state && savedState && state !== savedState) {
      setStatus("State mismatch - possible security issue");
      if (window.opener) {
        window.opener.postMessage(
          { type: "linkedin-auth-callback", success: false, error: "State mismatch" },
          window.location.origin
        );
      }
      setTimeout(() => window.close(), 3000);
      return;
    }

    // Send code back to parent window via postMessage
    const redirectUri =
      localStorage.getItem("linkedin_redirect_uri") ||
      `${window.location.origin}/auth/callback`;

    if (window.opener) {
      window.opener.postMessage(
        { type: "linkedin-auth-callback", code, redirectUri, success: true },
        window.location.origin
      );
      setStatus("Authorization sent! Closing...");
      setTimeout(() => window.close(), 1000);
    } else {
      setStatus("Parent window not found. Please close this window and try again.");
    }

    // Clean up
    localStorage.removeItem("linkedin_oauth_state");
    localStorage.removeItem("linkedin_redirect_uri");
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <h1 className="sr-only">LinkedIn sign-in callback</h1>
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-center">{status}</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default AuthCallback;
