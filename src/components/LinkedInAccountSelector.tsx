import { useState, useEffect } from "react";
import { Check, Linkedin, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LinkedInAccount {
  _id?: string;
  id?: string;
  platform: string;
  displayName?: string;
  profilePicture?: string;
  metadata?: {
    headline?: string;
    profilePicture?: string;
  };
  isActive?: boolean;
}

interface LinkedInAccountSelectorProps {
  onAccountSelected: (account: LinkedInAccount) => void;
  onCancel?: () => void;
}

export function LinkedInAccountSelector({ onAccountSelected, onCancel }: LinkedInAccountSelectorProps) {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LinkedInAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

  const fetchAccounts = async () => {
    setIsLoading(true);
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

      // Auto-select if only one account
      if (linkedInAccounts.length === 1) {
        setSelectedAccount(linkedInAccounts[0]);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
      toast.error("Failed to load LinkedIn accounts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleConfirm = async () => {
    if (!selectedAccount) return;

    setIsConfirming(true);
    try {
      // Store the selected account
      const accountId = selectedAccount._id || selectedAccount.id;
      if (accountId) {
        localStorage.setItem("getlate_account_id", accountId);
      }

      toast.success("LinkedIn account connected!", {
        description: `Connected as ${selectedAccount.displayName || "LinkedIn User"}`,
      });

      onAccountSelected(selectedAccount);
    } catch (err) {
      console.error("Failed to confirm account:", err);
      toast.error("Failed to connect account");
    } finally {
      setIsConfirming(false);
    }
  };

  const getAccountId = (account: LinkedInAccount) => account._id || account.id || "";

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading LinkedIn accounts...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl gradient-linkedin flex items-center justify-center">
              <Linkedin className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle>No LinkedIn Accounts Found</CardTitle>
            <CardDescription>
              We couldn't find any LinkedIn accounts connected. Please try the authorization again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={fetchAccounts} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {onCancel && (
              <Button onClick={onCancel} variant="ghost" className="w-full">
                Go Back
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl gradient-linkedin flex items-center justify-center">
            <Linkedin className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle>Select LinkedIn Account</CardTitle>
          <CardDescription>
            Choose which LinkedIn account you'd like to use for publishing posts
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            {accounts.map((account) => {
              const accountId = getAccountId(account);
              const isSelected = selectedAccount && getAccountId(selectedAccount) === accountId;
              const profilePic = account.profilePicture || account.metadata?.profilePicture;
              const headline = account.metadata?.headline;

              return (
                <button
                  key={accountId}
                  onClick={() => setSelectedAccount(account)}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 transition-all duration-200 text-left",
                    "hover:border-primary/50 hover:bg-accent/50",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                      <AvatarImage src={profilePic} alt={account.displayName || "LinkedIn"} />
                      <AvatarFallback className="bg-primary/10">
                        <User className="h-6 w-6 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {account.displayName || "LinkedIn User"}
                      </p>
                      {headline && (
                        <p className="text-sm text-muted-foreground truncate">{headline}</p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleConfirm}
              disabled={!selectedAccount || isConfirming}
              className="w-full"
              variant="linkedin"
              size="lg"
            >
              {isConfirming ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Use This Account
                </>
              )}
            </Button>
            {onCancel && (
              <Button onClick={onCancel} variant="ghost" className="w-full">
                Cancel
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can change this later in Settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
}