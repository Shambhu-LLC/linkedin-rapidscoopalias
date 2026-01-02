import { useState, useEffect } from "react";
import { Check, ChevronDown, Plus, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkedInAccount {
  id: string;
  getlate_account_id: string;
  profile_name: string | null;
  profile_picture_url: string | null;
  profile_headline: string | null;
  is_active: boolean;
}

interface AccountSwitcherProps {
  onAccountChange?: () => void;
  onSignOut?: () => void;
}

export function AccountSwitcher({ onAccountChange, onSignOut }: AccountSwitcherProps) {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<LinkedInAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);

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
      setActiveAccount(data?.find(a => a.is_active) || data?.[0] || null);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function switchAccount(accountId: string) {
    if (isSwitching) return;
    setIsSwitching(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Deactivate all accounts for this user
      await supabase
        .from("linkedin_accounts")
        .update({ is_active: false })
        .eq("user_id", session.user.id);

      // Activate the selected account
      await supabase
        .from("linkedin_accounts")
        .update({ is_active: true })
        .eq("id", accountId);

      await fetchAccounts();
      onAccountChange?.();
      
      toast.success("Account switched successfully");
    } catch (error: any) {
      console.error("Failed to switch account:", error);
      toast.error("Failed to switch account");
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleAddAccount() {
    setIsAddingAccount(true);
    try {
      // Get profile from GetLate
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

      // Get OAuth URL
      const callbackUrl = `${window.location.origin}/auth/linkedin/callback`;
      const { data: connectData, error: connectError } = await supabase.functions.invoke("linkedin-api", {
        body: { action: "get-connect-url", profileId, callbackUrl },
      });

      if (connectError) throw connectError;
      if (!connectData?.success || !connectData?.data?.connectUrl) {
        throw new Error("Failed to get authorization URL");
      }

      // Redirect to LinkedIn OAuth
      window.location.href = connectData.data.connectUrl;
      
    } catch (error: any) {
      console.error("Add account error:", error);
      toast.error(error.message || "Failed to add account");
      setIsAddingAccount(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddAccount}
        disabled={isAddingAccount}
      >
        {isAddingAccount ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        Connect LinkedIn
      </Button>
    );
  }

  const getInitials = (name: string | null) => {
    if (!name) return "LI";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-2" disabled={isSwitching}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={activeAccount.profile_picture_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(activeAccount.profile_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium truncate">{activeAccount.profile_name || "LinkedIn Account"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {activeAccount.profile_headline || "Connected"}
            </p>
          </div>
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {accounts.map((account) => (
          <DropdownMenuItem
            key={account.id}
            onClick={() => switchAccount(account.id)}
            className="flex items-center gap-2 p-2 cursor-pointer"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={account.profile_picture_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(account.profile_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{account.profile_name || "LinkedIn Account"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {account.profile_headline || "Connected"}
              </p>
            </div>
            {account.is_active && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={handleAddAccount}
          disabled={isAddingAccount}
          className="flex items-center gap-2 p-2 cursor-pointer"
        >
          {isAddingAccount ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span>Add another account</span>
        </DropdownMenuItem>

        {onSignOut && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="flex items-center gap-2 p-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
