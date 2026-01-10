import { useState } from "react";
import { Key, ExternalLink, RefreshCw, LogOut, Shield, Bell, User, Linkedin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LinkedInAccountSwitcher } from "./LinkedInAccountSwitcher";

interface SettingsViewProps {
  isConnected: boolean;
  onDisconnect: () => void;
  onAddAccount?: () => void;
  hasGetLateConnection?: boolean;
}

export function SettingsView({ isConnected, onDisconnect, onAddAccount, hasGetLateConnection }: SettingsViewProps) {
  const [apiKey, setApiKey] = useState("");
  const [notifications, setNotifications] = useState({
    postEngagement: true,
    weeklyReport: true,
    mentions: true,
  });

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter a valid API key");
      return;
    }
    toast.success("API key saved successfully!");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your LinkedIn integration</p>
      </div>

      {/* API Configuration */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Configure your API key to manage LinkedIn posts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="linkedin" onClick={handleSaveApiKey}>
              Save API Key
            </Button>
            <Button variant="outline" asChild>
              <a href="https://getlate.dev" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Get API Key
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected LinkedIn Accounts */}
      {isConnected && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Linkedin className="h-5 w-5 text-primary" />
              LinkedIn Accounts
            </CardTitle>
            <CardDescription>
              Switch between your connected LinkedIn accounts and pages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LinkedInAccountSwitcher onAddAccount={onAddAccount} variant="full" />
          </CardContent>
        </Card>
      )}

      {/* Connection Status */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Manage your LinkedIn connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success' : 'bg-muted-foreground'}`} />
              <div>
                <p className="font-medium">
                  {isConnected ? "Connected" : "Not Connected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? "Your LinkedIn account is connected" : "Connect your account to get started"}
                </p>
              </div>
            </div>
            {isConnected && (
              <Button variant="destructive" size="sm" onClick={onDisconnect}>
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect All
              </Button>
            )}
          </div>
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
