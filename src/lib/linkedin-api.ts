import { supabase } from "@/integrations/supabase/client";

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
  vanityName?: string;
}

export interface LinkedInPost {
  id: string;
  content: string;
  createdAt: string;
  visibility: string;
  impressions?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
}

export interface LinkedInComment {
  id: string;
  text: string;
  createdAt: string;
  author: {
    name: string;
    profilePicture?: string;
  };
}

export interface LinkedInAnalytics {
  profileViews: number;
  profileViewsChange: number;
  impressions: number;
  impressionsChange: number;
  reactions: number;
  reactionsChange: number;
  comments: number;
  commentsChange: number;
  shares: number;
  sharesChange: number;
  followers: number;
  followersChange: number;
}

export interface SearchUser {
  id: string;
  name: string;
  vanityName: string;
  profilePicture?: string;
  /** When present, insert this string directly into the post content (e.g. "@[Name](urn:li:person:...)" ) */
  mentionFormat?: string;
}

async function callLinkedInAPI(action: string, body?: Record<string, unknown>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Prefer the current user session token when available.
  const { data: { session } } = await supabase.auth.getSession();
  const bearer = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${supabaseKey}`;

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/linkedin-api?action=${encodeURIComponent(action)}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: bearer,
          "Content-Type": "application/json",
        },
        ...(body && { body: JSON.stringify(body) }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "API request failed");
    }

    return result.data;
  } catch (error) {
    throw error;
  }
}

export const linkedinApi = {
  // Profile
  async getProfile(): Promise<LinkedInProfile> {
    return callLinkedInAPI('get-profile');
  },

  // Analytics
  async getAnalytics(): Promise<LinkedInAnalytics> {
    return callLinkedInAPI('get-analytics');
  },

  async getFollowers(): Promise<{ count: number; recent: unknown[] }> {
    return callLinkedInAPI('get-followers');
  },

  // Accounts
  async getAccounts(): Promise<any> {
    return callLinkedInAPI("get-accounts");
  },

  async disconnectAccount(accountId: string): Promise<void> {
    await callLinkedInAPI("disconnect-account", { accountId });
  },

  // Posts
  async getPosts(): Promise<LinkedInPost[]> {
    return callLinkedInAPI('get-posts');
  },

  async createPost(content: string, options?: { visibility?: string; accountId?: string }): Promise<LinkedInPost> {
    return callLinkedInAPI('create-post', { 
      content, 
      visibility: options?.visibility ?? 'PUBLIC',
      accountId: options?.accountId,
    });
  },

  async updatePost(postId: string, content: string): Promise<LinkedInPost> {
    return callLinkedInAPI('update-post', { postId, content });
  },

  async deletePost(postId: string): Promise<void> {
    return callLinkedInAPI('delete-post', { postId });
  },

  async getPostAnalytics(postId: string): Promise<unknown> {
    return callLinkedInAPI('get-post-analytics', { postId });
  },

  // Comments
  async getComments(postId: string): Promise<LinkedInComment[]> {
    return callLinkedInAPI('get-comments', { postId });
  },

  async createComment(postId: string, text: string): Promise<LinkedInComment> {
    return callLinkedInAPI('create-comment', { postId, text });
  },

  async deleteComment(postId: string, commentId: string): Promise<void> {
    return callLinkedInAPI('delete-comment', { postId, commentId });
  },

  // User Search / Mention resolver
  async searchUsers(query: string, options?: { accountId?: string; displayName?: string }): Promise<SearchUser[]> {
    return callLinkedInAPI('search-users', { query, ...(options ?? {}) });
  },
};
