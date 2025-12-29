import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GETLATE_API_KEY = Deno.env.get('GETLATE_API_KEY');
const GETLATE_BASE_URL = 'https://getlate.dev/api/v1';

interface RequestBody {
  content?: string;
  visibility?: string;
  postId?: string;
  text?: string;
  commentId?: string;
  query?: string;
  accountId?: string;
  profileId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GETLATE_API_KEY) {
      throw new Error('GETLATE_API_KEY is not configured. Please add your GetLate.dev API key in Settings.');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    let body: RequestBody = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    console.log(`GetLate API action: ${action}`, body);

    let endpoint = '';
    let method = 'GET';
    let requestBody: Record<string, unknown> | null = null;

    switch (action) {
      // Profile & Accounts
      case 'get-profile':
        endpoint = '/profiles';
        break;
      case 'get-accounts':
        endpoint = '/accounts';
        break;
      case 'get-analytics':
        // Analytics requires premium - return demo data
        return new Response(JSON.stringify({ 
          success: true, 
          data: {
            profileViews: 2847,
            profileViewsChange: 12.5,
            impressions: 18400,
            impressionsChange: 8.2,
            reactions: 1234,
            reactionsChange: 15.3,
            comments: 391,
            commentsChange: -2.1,
            shares: 218,
            sharesChange: 5.7,
            followers: 3421,
            followersChange: 3.2,
            _demo: true,
            _message: "Analytics requires GetLate.dev premium plan. Showing demo data."
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      // Posts - using GetLate.dev API structure
      case 'get-posts':
        endpoint = '/posts';
        break;
      case 'create-post':
        endpoint = '/posts';
        method = 'POST';
        requestBody = {
          text: body.content,
          accounts: body.accountId ? [body.accountId] : undefined,
          status: 'published',
        };
        break;
      case 'update-post':
        endpoint = `/posts/${body.postId}`;
        method = 'PATCH';
        requestBody = {
          text: body.content,
        };
        break;
      case 'delete-post':
        endpoint = `/posts/${body.postId}`;
        method = 'DELETE';
        break;
      
      // Comments - Note: GetLate may not support direct comment management
      case 'get-comments':
        // Return demo comments as GetLate doesn't support this
        return new Response(JSON.stringify({ 
          success: true, 
          data: [
            { id: "c1", text: "Great post! Really insightful.", createdAt: new Date().toISOString(), author: { name: "John Doe" } },
            { id: "c2", text: "Thanks for sharing this!", createdAt: new Date(Date.now() - 3600000).toISOString(), author: { name: "Jane Smith" } },
          ],
          _demo: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      case 'create-comment':
        // Simulate comment creation
        return new Response(JSON.stringify({ 
          success: true, 
          data: {
            id: `c-${Date.now()}`,
            text: body.text,
            createdAt: new Date().toISOString(),
            author: { name: "You" }
          },
          _demo: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      case 'delete-comment':
        return new Response(JSON.stringify({ success: true, data: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Making request to: ${GETLATE_BASE_URL}${endpoint}`);

    const response = await fetch(`${GETLATE_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${GETLATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      ...(requestBody && { body: JSON.stringify(requestBody) }),
    });

    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);
    console.log(`Response body: ${responseText.substring(0, 500)}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || data.error || `API error: ${response.status}`;
      throw new Error(errorMsg);
    }

    // Transform GetLate.dev response to our format
    let transformedData = data;
    
    if (action === 'get-posts' && data.posts) {
      // Transform GetLate posts to our format
      transformedData = data.posts.map((post: any) => ({
        id: post._id,
        content: post.content || post.text || '',
        createdAt: post.createdAt || post.scheduledAt || new Date().toISOString(),
        visibility: 'PUBLIC',
        impressions: post.analytics?.impressions || 0,
        reactions: post.analytics?.reactions || 0,
        comments: post.analytics?.comments || 0,
        shares: post.analytics?.shares || 0,
        status: post.status,
        platforms: post.platforms,
      }));
    }

    return new Response(JSON.stringify({ success: true, data: transformedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('GetLate API error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
