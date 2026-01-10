import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ConnectLinkedInPosting } from "@/components/ConnectLinkedInPosting";
import { ConnectGetLate } from "@/components/ConnectGetLate";
import { LinkedInAccountSelector } from "@/components/LinkedInAccountSelector";
import { DashboardView } from "@/components/DashboardView";
import { PostsView } from "@/components/PostsView";
import { ScheduledPostsCalendar } from "@/components/ScheduledPostsCalendar";
import { AnalyticsView } from "@/components/AnalyticsView";
import { SettingsView } from "@/components/SettingsView";
import { supabase } from "@/integrations/supabase/client";
import { linkedinApi } from "@/lib/linkedin-api";
import { linkedinPostingApi } from "@/lib/linkedin-posting-api";
import { createPersonaFromProfile, getStoredPersona, clearStoredPersona } from "@/lib/persona-api";
import { toast } from "sonner";

import { PostingAccount } from "@/lib/linkedin-posting-api";

type ConnectionStep = "loading" | "connect-linkedin" | "connect-getlate" | "connected";

const Index = () => {
  const navigate = useNavigate();
  const [connectionStep, setConnectionStep] = useState<ConnectionStep>("loading");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [personaVersion, setPersonaVersion] = useState(0);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [hasGetLateConnection, setHasGetLateConnection] = useState(false);
  const [postingAccount, setPostingAccount] = useState<PostingAccount | null>(null);

  useEffect(() => {
    // Check for pending LinkedIn login toast
    const pendingToast = localStorage.getItem("linkedin_pending_toast");
    if (pendingToast) {
      try {
        const { isNewUser, email } = JSON.parse(pendingToast);
        toast.success(isNewUser ? "Account Created!" : "Welcome Back!", {
          description: `Signed in as ${email}`,
        });
      } catch {}
      localStorage.removeItem("linkedin_pending_toast");
    }

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // Check if we need to show account selector (redirected from GetLate callback)
      const shouldShowSelector = localStorage.getItem("show_account_selector");
      if (shouldShowSelector) {
        localStorage.removeItem("show_account_selector");
        setShowAccountSelector(true);
      }
      
      // Check connection status
      await checkConnectionStatus();
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
          // Avoid calling backend inside the auth callback
          setTimeout(() => {
            checkConnectionStatus();
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  async function checkConnectionStatus() {
    try {
      // Step 1: Check if LinkedIn posting is connected
      const { connected: hasPosting, account } = await linkedinPostingApi.getPostingAccount();
      
      if (!hasPosting) {
        setConnectionStep("connect-linkedin");
        return;
      }
      
      // Store posting account for GetLate auto-matching
      setPostingAccount(account);

      // Step 2: Check if GetLate is connected (optional)
      try {
        const accounts = await linkedinApi.getAccounts();
        const allAccounts = (accounts as any)?.accounts ?? accounts;
        const activeLinkedIn = Array.isArray(allAccounts)
          ? allAccounts.filter((a: any) => a?.platform === "linkedin" && a?.isActive !== false)
          : [];
        
        setHasGetLateConnection(activeLinkedIn.length > 0);
        
        // Check if user skipped GetLate before
        const skippedGetLate = localStorage.getItem("skipped_getlate_connection");
        
        if (activeLinkedIn.length === 0 && !skippedGetLate) {
          setConnectionStep("connect-getlate");
          return;
        }
      } catch (error) {
        // GetLate check failed, user might not have it connected - continue anyway
        console.log("GetLate check failed, continuing with posting only");
      }

      // Fully connected
      setConnectionStep("connected");
      
      // Auto-create persona if connected and no persona exists
      const existingPersona = await getStoredPersona();
      if (!existingPersona && account) {
        await createPersonaAutomatically();
      }
    } catch (error) {
      console.error("Connection check error:", error);
      setConnectionStep("connect-linkedin");
    }
  }

  async function createPersonaAutomatically() {
    setIsCreatingPersona(true);
    try {
      const profile = await linkedinApi.getProfile();
      await createPersonaFromProfile(profile);
      setPersonaVersion(v => v + 1);
      toast.success("AI Persona created from your LinkedIn profile!");
    } catch (error) {
      console.error("Failed to create persona:", error);
    } finally {
      setIsCreatingPersona(false);
    }
  }

  async function disconnectAllConnections() {
    // Disconnect LinkedIn posting
    try {
      await linkedinPostingApi.disconnect();
    } catch {}

    // Disconnect GetLate accounts
    try {
      const accounts = await linkedinApi.getAccounts();
      const allAccounts = (accounts as any)?.accounts ?? accounts;
      const linkedinAccounts = Array.isArray(allAccounts)
        ? allAccounts.filter((a: any) => a?.platform === "linkedin")
        : [];

      await Promise.all(
        linkedinAccounts.map((a: any) => linkedinApi.disconnectAccount(a?._id ?? a?.id))
      );
    } catch {}

    // Clear local storage
    localStorage.removeItem("linkedin_access_token");
    localStorage.removeItem("linkedin_oauth_state");
    localStorage.removeItem("skipped_getlate_connection");
    await clearStoredPersona();
  }

  const handleSignOut = async () => {
    try {
      await disconnectAllConnections();
    } catch {
      // Ignore disconnect errors on sign-out
    } finally {
      await supabase.auth.signOut();
      toast.info("Signed out successfully");
      navigate("/auth");
    }
  };

  const handleLinkedInConnected = async () => {
    // Check if should show GetLate connection
    const skippedGetLate = localStorage.getItem("skipped_getlate_connection");
    if (!skippedGetLate) {
      setConnectionStep("connect-getlate");
    } else {
      setConnectionStep("connected");
    }
  };

  const handleGetLateConnected = async () => {
    setHasGetLateConnection(true);
    setConnectionStep("connected");
    await createPersonaAutomatically();
  };

  const handleSkipGetLate = () => {
    localStorage.setItem("skipped_getlate_connection", "true");
    setConnectionStep("connected");
  };

  const handleDisconnect = async () => {
    try {
      await disconnectAllConnections();
      setConnectionStep("connect-linkedin");
      setActiveTab("dashboard");
      toast.success("LinkedIn disconnected");
    } catch (e: any) {
      toast.error(e?.message || "Failed to disconnect");
    }
  };

  const handleAddAccount = async () => {
    // For GetLate account addition
    try {
      const { data: profileData, error: profileError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "create-profile", name: "LinkedInUsers" },
      });

      if (profileError) throw profileError;
      if (!profileData?.success || !profileData?.data?.profileId) {
        throw new Error("Failed to get profile");
      }

      const profileId = profileData.data.profileId;
      const callbackUrl = `${window.location.origin}/connect/callback`;
      
      const { data: connectData, error: connectError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "get-connect-url", profileId, callbackUrl },
      });

      if (connectError) throw connectError;
      if (!connectData?.success || !connectData?.data?.connectUrl) {
        throw new Error("Failed to get connect URL");
      }

      const popupWidth = 600;
      const popupHeight = 700;
      const left = Math.max(0, (window.screen.width - popupWidth) / 2);
      const top = Math.max(0, (window.screen.height - popupHeight) / 2);
      
      const popup = window.open(
        connectData.data.connectUrl,
        'linkedin_auth',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      
      if (!popup) {
        toast.error("Popup blocked. Please allow popups and try again.");
        return;
      }
      
      toast.info("Complete authorization in the popup window", {
        description: "Select which LinkedIn account to add",
        duration: 8000,
      });
      
      const pollInterval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollInterval);
          await checkConnectionStatus();
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Add account error:", error);
      toast.error(error.message || "Failed to start account connection");
    }
  };

  // Show account selector if redirected from GetLate callback
  if (showAccountSelector) {
    return (
      <LinkedInAccountSelector
        onAccountSelected={() => {
          setShowAccountSelector(false);
          checkConnectionStatus();
        }}
        onCancel={() => setShowAccountSelector(false)}
      />
    );
  }

  // Show appropriate connection step
  if (connectionStep === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (connectionStep === "connect-linkedin") {
    return (
      <ConnectLinkedInPosting
        onConnected={handleLinkedInConnected}
        onSignOut={handleSignOut}
        userEmail={user?.email}
        userName={user?.user_metadata?.full_name || user?.user_metadata?.name}
      />
    );
  }

  if (connectionStep === "connect-getlate") {
    return (
      <ConnectGetLate
        onConnected={handleGetLateConnected}
        onSkip={handleSkipGetLate}
        onSignOut={handleSignOut}
        userEmail={user?.email}
        userName={user?.user_metadata?.full_name || user?.user_metadata?.name}
        postingAccount={postingAccount}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView personaVersion={personaVersion} />;
      case "posts":
        return <PostsView />;
      case "scheduled":
        return <ScheduledPostsCalendar />;
      case "analytics":
        return <AnalyticsView />;
      case "settings":
        return (
          <SettingsView 
            isConnected={true} 
            onDisconnect={handleDisconnect} 
            onAddAccount={handleAddAccount}
            hasGetLateConnection={hasGetLateConnection}
          />
        );
      default:
        return <DashboardView personaVersion={personaVersion} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={true}
        onSignOut={handleSignOut}
        onDisconnectLinkedIn={handleDisconnect}
        onAddAccount={handleAddAccount}
        userEmail={user?.email}
      />
      <main className="flex-1 lg:ml-0 p-6 lg:p-8 pt-16 lg:pt-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
