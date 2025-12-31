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
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.info("Signed out successfully");
    navigate("/auth");
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsConnected(true);
    setIsConnecting(false);
    toast.success("Successfully connected to LinkedIn!");
  };

  const handleDisconnect = async () => {
    try {
      const accounts = await linkedinApi.getAccounts();
      const linkedinAccounts = (accounts ?? []).filter((a: any) => a?.platform === "linkedin");

      if (linkedinAccounts.length === 0) {
        toast.info("No LinkedIn account found to disconnect");
      } else {
        await Promise.all(
          linkedinAccounts.map((a: any) => linkedinApi.disconnectAccount(a?._id ?? a?.id))
        );
        toast.success("LinkedIn account disconnected");
      }

      setIsConnected(false);
      setActiveTab("dashboard");
    } catch (e: any) {
      toast.error(e?.message || "Failed to disconnect LinkedIn");
    } finally {
      // Clear any legacy/local connection flags
      localStorage.removeItem("linkedin_access_token");
      localStorage.removeItem("linkedin_oauth_state");
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
