import { useState, useEffect } from "react";
import { Check, ChevronDown, Linkedin, Plus, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface LinkedInAccount {
  _id?: string;
  id?: string;
  platform: string;
  displayName?: string;
  profilePictureUrl?: string;
  profilePicture?: string;
  metadata?: {
    headline?: string;
    profilePicture?: string;
  };
  isActive?: boolean;
}

interface LinkedInAccountSwitcherProps {
  onAddAccount?: () => void;
  variant?: "compact" | "full";
  className?: string;
}

export function LinkedInAccountSwitcher({ 
  onAddAccount, 
  variant = "full",
  className 
}: LinkedInAccountSwitcherProps) {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAccounts = async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "get-accounts" },
      });

      if (error) throw error;

      const allAccounts = data?.data?.accounts || data?.data || [];
      const linkedInAccounts = Array.isArray(allAccounts)
        ? allAccounts.filter((a: LinkedInAccount) => a?.platform === "linkedin")
        : [];

      setAccounts(linkedInAccounts);

      // Get stored active account ID
      const storedId = localStorage.getItem("getlate_account_id");
      if (storedId && linkedInAccounts.some((a: LinkedInAccount) => getAccountId(a) === storedId)) {
        setActiveAccountId(storedId);
      } else if (linkedInAccounts.length > 0) {
        // Default to first account if none stored
        const firstId = getAccountId(linkedInAccounts[0]);
        setActiveAccountId(firstId);
        localStorage.setItem("getlate_account_id", firstId);
      }

      if (showToast) toast.success("Accounts refreshed");
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
      if (showToast) toast.error("Failed to refresh accounts");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const getAccountId = (account: LinkedInAccount) => account._id || account.id || "";

  const getProfilePicture = (account: LinkedInAccount) => 
    account.profilePictureUrl || account.profilePicture || account.metadata?.profilePicture;

  const activeAccount = accounts.find(a => getAccountId(a) === activeAccountId);

  const handleSelectAccount = (account: LinkedInAccount) => {
    const accountId = getAccountId(account);
    setActiveAccountId(accountId);
    localStorage.setItem("getlate_account_id", accountId);
    toast.success(`Switched to ${account.displayName || "LinkedIn Account"}`);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 p-2", className)}>
        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-secondary/50", className)}>
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Linkedin className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">No accounts</p>
          <p className="text-xs text-muted-foreground">Connect LinkedIn to get started</p>
        </div>
        {onAddAccount && (
          <Button variant="outline" size="sm" onClick={onAddAccount}>
            <Plus className="h-4 w-4 mr-1" />
            Connect
          </Button>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors",
            className
          )}>
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={activeAccount ? getProfilePicture(activeAccount) : undefined} />
              <AvatarFallback className="bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accounts.map((account) => {
            const accountId = getAccountId(account);
            const isActive = accountId === activeAccountId;
            return (
              <DropdownMenuItem
                key={accountId}
                onClick={() => handleSelectAccount(account)}
                className="flex items-center gap-3 p-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getProfilePicture(account)} />
                  <AvatarFallback className="bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{account.displayName || "LinkedIn User"}</p>
                  {account.metadata?.headline && (
                    <p className="text-xs text-muted-foreground truncate">{account.metadata.headline}</p>
                  )}
                </div>
                {isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
              </DropdownMenuItem>
            );
          })}
          {onAddAccount && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onAddAccount}>
                <Plus className="h-4 w-4 mr-2" />
                Add another account
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Full variant - shows all accounts in a list
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Connected Accounts</p>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => fetchAccounts(true)}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>
      <div className="space-y-2">
        {accounts.map((account) => {
          const accountId = getAccountId(account);
          const isActive = accountId === activeAccountId;
          return (
            <button
              key={accountId}
              onClick={() => handleSelectAccount(account)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left",
                "hover:border-primary/50 hover:bg-accent/50",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                <AvatarImage src={getProfilePicture(account)} alt={account.displayName || "LinkedIn"} />
                <AvatarFallback className="bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {account.displayName || "LinkedIn User"}
                </p>
                {account.metadata?.headline && (
                  <p className="text-sm text-muted-foreground truncate">{account.metadata.headline}</p>
                )}
              </div>
              {isActive && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-primary font-medium">Active</span>
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {onAddAccount && (
        <Button variant="outline" className="w-full" onClick={onAddAccount}>
          <Plus className="h-4 w-4 mr-2" />
          Add Another Account
        </Button>
      )}
    </div>
  );
}
