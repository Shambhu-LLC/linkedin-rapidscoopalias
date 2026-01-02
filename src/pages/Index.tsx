import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ConnectScreen } from "@/components/ConnectScreen";
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

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
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

  if (!isConnected) {
    return <ConnectScreen onConnect={handleConnect} isLoading={isConnecting} onSignOut={handleSignOut} userEmail={user?.email} />;
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
        return <SettingsView isConnected={isConnected} onDisconnect={handleDisconnect} />;
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
        userEmail={user?.email}
      />
      <main className="flex-1 lg:ml-0 p-6 lg:p-8 pt-16 lg:pt-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
