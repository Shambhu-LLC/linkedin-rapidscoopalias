import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [personaVersion, setPersonaVersion] = useState(0);

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
          setTimeout(() => {
            refreshLinkedInConnection();
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  async function refreshLinkedInConnection() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      // Check local database for active LinkedIn accounts
      const { data: accounts, error } = await supabase
        .from("linkedin_accounts")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("publishing_enabled", true);

      if (error) {
        console.error("Error fetching accounts:", error);
        return false;
      }

      const connected = (accounts?.length || 0) > 0;
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
      setPersonaVersion(v => v + 1);
      toast.success("AI Persona created from your LinkedIn profile!");
    } catch (error) {
      console.error("Failed to create persona:", error);
    } finally {
      setIsCreatingPersona(false);
    }
  }

  async function disconnectAllLinkedInAccounts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { disconnected: 0 };

      // Get all accounts for this user
      const { data: accounts } = await supabase
        .from("linkedin_accounts")
        .select("getlate_account_id")
        .eq("user_id", session.user.id);

      if (accounts && accounts.length > 0) {
        // Disconnect from GetLate
        await Promise.all(
          accounts.map(a => a.getlate_account_id && linkedinApi.disconnectAccount(a.getlate_account_id))
        );

        // Remove from local database
        await supabase
          .from("linkedin_accounts")
          .delete()
          .eq("user_id", session.user.id);
      }

      await clearStoredPersona();
      localStorage.removeItem("getlate_account_id");

      return { disconnected: accounts?.length || 0 };
    } catch (error) {
      console.error("Error disconnecting accounts:", error);
      return { disconnected: 0 };
    }
  }

  const handleSignOut = async () => {
    try {
      await disconnectAllLinkedInAccounts();
    } catch {
      // Ignore disconnect errors on sign-out
    } finally {
      await supabase.auth.signOut();
      toast.info("Signed out successfully");
      navigate("/auth");
    }
  };

  const handleDisconnect = async () => {
    try {
      const { disconnected } = await disconnectAllLinkedInAccounts();
      await refreshLinkedInConnection();
      setActiveTab("dashboard");
      toast.success(
        disconnected > 0
          ? "LinkedIn accounts disconnected"
          : "No LinkedIn account found to disconnect"
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to disconnect LinkedIn");
    }
  };

  const handleAccountChange = () => {
    // Refresh data when account is switched
    refreshLinkedInConnection();
    setPersonaVersion(v => v + 1);
  };

  // If not connected, redirect to auth (they need to connect a LinkedIn account)
  if (!isConnected && user) {
    // User is logged in but has no LinkedIn accounts - show connect prompt
    navigate("/auth");
    return null;
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
        onAccountChange={handleAccountChange}
      />
      <main className="flex-1 lg:ml-0 p-6 lg:p-8 pt-16 lg:pt-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
