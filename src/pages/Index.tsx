import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { EnablePublishingScreen } from "@/components/EnablePublishingScreen";
import { LinkedInAccountSelector } from "@/components/LinkedInAccountSelector";
import { DashboardView } from "@/components/DashboardView";
import { PostsView } from "@/components/PostsView";
import { ScheduledPostsCalendar } from "@/components/ScheduledPostsCalendar";
import { AnalyticsView } from "@/components/AnalyticsView";
import { SettingsView } from "@/components/SettingsView";
import { supabase } from "@/integrations/supabase/client";
import { linkedinApi } from "@/lib/linkedin-api";
import { createPersonaFromProfile, getStoredPersona, clearStoredPersona } from "@/lib/persona-api";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [personaVersion, setPersonaVersion] = useState(0); // Increment to force refresh
  const [showAccountSelector, setShowAccountSelector] = useState(false);

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
      
      // Sync LinkedIn connection state from backend
      setTimeout(() => {
        refreshLinkedInConnection();
      }, 0);
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
            refreshLinkedInConnection();
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  async function getLinkedInAccounts() {
    const data = await linkedinApi.getAccounts();
    const accounts = (data as any)?.accounts ?? data;
    return Array.isArray(accounts) ? accounts : [];
  }

  async function refreshLinkedInConnection() {
    try {
      const list = await getLinkedInAccounts();
      const activeLinkedIn = list.filter(
        (a: any) => a?.platform === "linkedin" && a?.isActive !== false
      );
      const connected = activeLinkedIn.length > 0;
      setIsConnected(connected);
      
      // Auto-create persona if connected and no persona exists
      if (connected) {
        const existingPersona = await getStoredPersona();
        if (!existingPersona) {
          await createPersonaAutomatically();
        }
      }
      
      return connected;
    } catch {
      setIsConnected(false);
      return false;
    }
  }

  async function createPersonaAutomatically() {
    setIsCreatingPersona(true);
    try {
      const profile = await linkedinApi.getProfile();
      await createPersonaFromProfile(profile);
      setPersonaVersion(v => v + 1); // Trigger refresh in PostComposer
      toast.success("AI Persona created from your LinkedIn profile!");
    } catch (error) {
      console.error("Failed to create persona:", error);
      // Don't show error toast - persona creation is optional
    } finally {
      setIsCreatingPersona(false);
    }
  }

  async function disconnectAllLinkedInAccounts() {
    const list = await getLinkedInAccounts();
    const linkedinAccounts = list.filter((a: any) => a?.platform === "linkedin");

    if (linkedinAccounts.length === 0) {
      return { disconnected: 0 };
    }

    await Promise.all(
      linkedinAccounts.map((a: any) => linkedinApi.disconnectAccount(a?._id ?? a?.id))
    );

    // Clear any legacy/local connection flags and persona
    localStorage.removeItem("linkedin_access_token");
    localStorage.removeItem("linkedin_oauth_state");
    await clearStoredPersona();

    return { disconnected: linkedinAccounts.length };
  }

  const handleSignOut = async () => {
    try {
      // User expectation: signing out should also remove the linked LinkedIn account(s).
      await disconnectAllLinkedInAccounts();
    } catch {
      // Ignore disconnect errors on sign-out
    } finally {
      await supabase.auth.signOut();
      toast.info("Signed out successfully");
      navigate("/auth");
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connected = await refreshLinkedInConnection();
      if (connected) {
        toast.success("LinkedIn account connected successfully!");
      } else {
        toast.info(
          "No LinkedIn account found. Please ensure your LinkedIn is connected in your API dashboard."
        );
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAddAccount = async () => {
    // Trigger the OAuth flow to add a new account (same as EnablePublishingScreen flow)
    try {
      // Get or create profile
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

      // Open OAuth popup
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
      
      // Poll for new account
      const pollInterval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollInterval);
          // Check if a new account was added
          await refreshLinkedInConnection();
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Add account error:", error);
      toast.error(error.message || "Failed to start account connection");
    }
  };

  const handleDisconnect = async () => {
    try {
      const { disconnected } = await disconnectAllLinkedInAccounts();
      await refreshLinkedInConnection();
      setActiveTab("dashboard");
      toast.success(
        disconnected > 0
          ? "LinkedIn account disconnected"
          : "No LinkedIn account found to disconnect"
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to disconnect LinkedIn");
    }
  };

  // Show account selector if redirected from GetLate callback
  if (showAccountSelector) {
    return (
      <LinkedInAccountSelector
        onAccountSelected={() => {
          setShowAccountSelector(false);
          handleConnect();
        }}
        onCancel={() => setShowAccountSelector(false)}
      />
    );
  }

  if (!isConnected) {
    return (
      <EnablePublishingScreen 
        onEnabled={handleConnect} 
        onSignOut={handleSignOut} 
        userEmail={user?.email}
        userName={user?.user_metadata?.full_name || user?.user_metadata?.name}
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
        return <SettingsView isConnected={isConnected} onDisconnect={handleDisconnect} onAddAccount={handleAddAccount} />;
      default:
        return <DashboardView personaVersion={personaVersion} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
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
