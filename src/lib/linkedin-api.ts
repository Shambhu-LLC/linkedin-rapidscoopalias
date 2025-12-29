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
}

async function callLinkedInAPI(action: string, body?: Record<string, unknown>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/linkedin-api?action=${action}`,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        ...(body && { body: JSON.stringify(body) }),
      }
    );

    const result = await response.json();
    
    if (!result.success) {
      console.warn(`API warning for ${action}:`, result.error);
      throw new Error(result.error || 'API request failed');
    }

    return result.data;
  } catch (error) {
    console.error(`API error for ${action}:`, error);
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

  // Posts
  async getPosts(): Promise<LinkedInPost[]> {
    return callLinkedInAPI('get-posts');
  },

  async createPost(content: string, visibility: string = 'PUBLIC'): Promise<LinkedInPost> {
    return callLinkedInAPI('create-post', { content, visibility });
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

  // User Search (for mentions)
  async searchUsers(query: string): Promise<SearchUser[]> {
    return callLinkedInAPI('search-users', { query });
  },
};
