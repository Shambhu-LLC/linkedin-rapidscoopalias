import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ConnectScreen } from "@/components/ConnectScreen";
import { DashboardView } from "@/components/DashboardView";
import { PostsView } from "@/components/PostsView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { SettingsView } from "@/components/SettingsView";
import { toast } from "sonner";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate API connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsConnected(true);
    setIsConnecting(false);
    toast.success("Successfully connected to LinkedIn!");
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setActiveTab("dashboard");
    toast.info("Disconnected from LinkedIn");
  };

  if (!isConnected) {
    return <ConnectScreen onConnect={handleConnect} isLoading={isConnecting} />;
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
      />
      <main className="flex-1 lg:ml-0 p-6 lg:p-8 pt-16 lg:pt-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
