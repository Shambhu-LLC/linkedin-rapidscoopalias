import { Linkedin, Menu, X, LayoutDashboard, FileText, BarChart3, Settings, LogOut, Unplug, CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LinkedInAccountSwitcher } from "./LinkedInAccountSwitcher";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
  onSignOut?: () => void;
  onDisconnectLinkedIn?: () => void;
  onAddAccount?: () => void;
  userEmail?: string;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "scheduled", label: "Scheduled", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeTab, setActiveTab, isConnected, onSignOut, onDisconnectLinkedIn, onAddAccount, userEmail }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card shadow-md"
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-linkedin flex items-center justify-center shadow-glow">
                <Linkedin className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">LinkedHub</h1>
                <p className="text-xs text-muted-foreground">LinkedIn Manager</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isDisabled = !isConnected && item.id !== "settings";

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (!isDisabled) {
                      setActiveTab(item.id);
                      setIsMobileOpen(false);
                    }
                  }}
                  disabled={isDisabled}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Account Switcher */}
          {isConnected && (
            <div className="p-4 border-t border-border">
              <LinkedInAccountSwitcher 
                variant="compact" 
                onAddAccount={onAddAccount}
              />
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-border space-y-2">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-success" : "bg-muted-foreground"
              )} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? "Connected" : "Not connected"}
              </span>
            </div>
            {userEmail && (
              <p className="px-4 text-xs text-muted-foreground truncate">{userEmail}</p>
            )}
            {isConnected && onDisconnectLinkedIn && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                onClick={onDisconnectLinkedIn}
              >
                <Unplug className="h-4 w-4" />
                Disconnect LinkedIn
              </Button>
            )}
            {onSignOut && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                onClick={onSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
