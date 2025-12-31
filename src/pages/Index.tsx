import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ConnectScreen } from "@/components/ConnectScreen";
import { DashboardView } from "@/components/DashboardView";
import { PostsView } from "@/components/PostsView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { SettingsView } from "@/components/SettingsView";
import { supabase } from "@/integrations/supabase/client";
import { linkedinApi } from "@/lib/linkedin-api";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<any>(null);

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
      return connected;
    } catch {
      setIsConnected(false);
      return false;
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

    // Clear any legacy/local connection flags
    localStorage.removeItem("linkedin_access_token");
    localStorage.removeItem("linkedin_oauth_state");

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
      if (!connected) {
        toast.info(
          "No LinkedIn account found. Please connect an account in GetLate.dev first."
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
        return <DashboardView />;
      case "posts":
        return <PostsView />;
      case "analytics":
        return <AnalyticsView />;
      case "settings":
        return <SettingsView isConnected={isConnected} onDisconnect={handleDisconnect} />;
      default:
        return <DashboardView />;
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
