import { supabase } from "@/integrations/supabase/client";

export interface PostingAccount {
  id: string;
  linkedinId: string;
  name: string;
  picture?: string;
  publishingEnabled: boolean;
}

export interface CreatePostResult {
  id: string;
  content: string;
  visibility: string;
  createdAt: string;
}

async function callPostingAPI(action: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("linkedin-posting", {
    body: {
      action,
      ...(body ?? {}),
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "API request failed");
  }

  return data;
}

export const linkedinPostingApi = {
  // Get authorization URL
  async getAuthUrl(redirectUri: string): Promise<{ url: string; state: string }> {
    const result = await callPostingAPI("authorize", { redirectUri });
    return { url: result.url, state: result.state };
  },

  // Exchange code for token (callback)
  async handleCallback(code: string, redirectUri: string): Promise<{ email: string; name: string; picture?: string }> {
    const result = await callPostingAPI("callback", { code, redirectUri });
    return result.user;
  },

  // Get posting account status
  async getPostingAccount(): Promise<{ connected: boolean; account: PostingAccount | null }> {
    const result = await callPostingAPI("get-posting-account");
    return { connected: result.connected, account: result.account };
  },

  // Create a post directly on LinkedIn
  async createPost(content: string, options?: { visibility?: string }): Promise<CreatePostResult> {
    const result = await callPostingAPI("create-post", {
      content,
      visibility: options?.visibility ?? "PUBLIC",
    });
    return result.data;
  },

  // Disconnect posting account
  async disconnect(): Promise<void> {
    await callPostingAPI("disconnect");
  },
};
