import { useState, useEffect } from "react";
import { ExternalLink, RefreshCw, Shield, Bell, Users, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { linkedinApi } from "@/lib/linkedin-api";

interface LinkedInAccount {
  id: string;
  getlate_account_id: string;
  profile_name: string | null;
  profile_picture_url: string | null;
  profile_headline: string | null;
  is_active: boolean;
}

interface SettingsViewProps {
  isConnected: boolean;
  onDisconnect: () => void;
}

export function SettingsView({ isConnected, onDisconnect }: SettingsViewProps) {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState({
    postEngagement: true,
    weeklyReport: true,
    mentions: true,
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("linkedin_accounts")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("publishing_enabled", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddAccount() {
    setIsAddingAccount(true);
    try {
      const { data: profileData, error: profileError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "create-profile", name: "LinkedInUsers" },
      });

      if (profileError) throw profileError;
      if (!profileData?.success || !profileData?.data?.profileId) {
        throw new Error("Failed to initialize connection");
      }

      const profileId = profileData.data.profileId;
      localStorage.setItem("getlate_profile_id", profileId);
      localStorage.setItem("linkedin_auth_mode", "add-account");

      const callbackUrl = `${window.location.origin}/auth/linkedin/callback`;
      const { data: connectData, error: connectError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "get-connect-url", profileId, callbackUrl },
      });

      if (connectError) throw connectError;
      if (!connectData?.success || !connectData?.data?.connectUrl) {
        throw new Error("Failed to get authorization URL");
      }

      window.location.href = connectData.data.connectUrl;
    } catch (error: any) {
      console.error("Add account error:", error);
      toast.error(error.message || "Failed to add account");
      setIsAddingAccount(false);
    }
  }

  async function handleDeleteAccount(account: LinkedInAccount) {
    if (accounts.length <= 1) {
      toast.error("You must have at least one LinkedIn account connected");
      return;
    }

    setDeletingAccountId(account.id);
    try {
      // Disconnect from GetLate
      if (account.getlate_account_id) {
        await linkedinApi.disconnectAccount(account.getlate_account_id);
      }

      // Remove from database
      await supabase
        .from("linkedin_accounts")
        .delete()
        .eq("id", account.id);

      // If this was the active account, activate another one
      if (account.is_active && accounts.length > 1) {
        const otherAccount = accounts.find(a => a.id !== account.id);
        if (otherAccount) {
          await supabase
            .from("linkedin_accounts")
            .update({ is_active: true })
            .eq("id", otherAccount.id);
        }
      }

      toast.success("Account removed successfully");
      fetchAccounts();
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast.error(error.message || "Failed to remove account");
    } finally {
      setDeletingAccountId(null);
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "LI";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your LinkedIn accounts and preferences</p>
      </div>

      {/* LinkedIn Accounts */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            LinkedIn Accounts
          </CardTitle>
          <CardDescription>
            Manage your connected LinkedIn accounts. Only the active account is used for posting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={account.profile_picture_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(account.profile_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{account.profile_name || "LinkedIn Account"}</p>
                        {account.is_active && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {account.profile_headline || "Connected"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAccount(account)}
                    disabled={deletingAccountId === account.id || accounts.length <= 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {deletingAccountId === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleAddAccount}
                disabled={isAddingAccount}
              >
                {isAddingAccount ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Another Account
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Your LinkedIn publishing connection status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success' : 'bg-muted-foreground'}`} />
              <div>
                <p className="font-medium">
                  {isConnected ? "Publishing Enabled" : "Not Connected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isConnected 
                    ? `${accounts.length} account${accounts.length !== 1 ? 's' : ''} connected`
                    : "Connect your account to get started"}
                </p>
              </div>
            </div>
          </div>
          {isConnected && (
            <Button variant="outline" className="w-full" onClick={() => toast.info("Refreshing connection...")}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Connection
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose what notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Post Engagement</p>
              <p className="text-sm text-muted-foreground">Get notified when your posts get reactions</p>
            </div>
            <Switch
              checked={notifications.postEngagement}
              onCheckedChange={(checked) => setNotifications({ ...notifications, postEngagement: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly Report</p>
              <p className="text-sm text-muted-foreground">Receive a weekly summary of your analytics</p>
            </div>
            <Switch
              checked={notifications.weeklyReport}
              onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyReport: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mentions</p>
              <p className="text-sm text-muted-foreground">Get notified when someone mentions you</p>
            </div>
            <Switch
              checked={notifications.mentions}
              onCheckedChange={(checked) => setNotifications({ ...notifications, mentions: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
