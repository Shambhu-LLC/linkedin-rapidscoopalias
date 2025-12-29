import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GETLATE_API_KEY = Deno.env.get('GETLATE_API_KEY');
const GETLATE_BASE_URL = 'https://api.getlate.dev/v1';

interface RequestBody {
  content?: string;
  visibility?: string;
  postId?: string;
  text?: string;
  commentId?: string;
  query?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GETLATE_API_KEY) {
      throw new Error('GETLATE_API_KEY is not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    let body: RequestBody = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      body = await req.json();
    }

    console.log(`LinkedIn API action: ${action}`, body);

    let endpoint = '';
    let method = 'GET';
    let requestBody: Record<string, unknown> | null = null;

    switch (action) {
      // Profile & Analytics
      case 'get-profile':
        endpoint = '/linkedin/profile';
        break;
      case 'get-analytics':
        endpoint = '/linkedin/analytics';
        break;
      case 'get-followers':
        endpoint = '/linkedin/followers';
        break;
      
      // Posts
      case 'get-posts':
        endpoint = '/linkedin/posts';
        break;
      case 'create-post':
        endpoint = '/linkedin/posts';
        method = 'POST';
        requestBody = {
          content: body.content,
          visibility: body.visibility || 'PUBLIC',
        };
        break;
      case 'update-post':
        endpoint = `/linkedin/posts/${body.postId}`;
        method = 'PUT';
        requestBody = {
          content: body.content,
        };
        break;
      case 'delete-post':
        endpoint = `/linkedin/posts/${body.postId}`;
        method = 'DELETE';
        break;
      case 'get-post-analytics':
        endpoint = `/linkedin/posts/${body.postId}/analytics`;
        break;
      
      // Comments
      case 'get-comments':
        endpoint = `/linkedin/posts/${body.postId}/comments`;
        break;
      case 'create-comment':
        endpoint = `/linkedin/posts/${body.postId}/comments`;
        method = 'POST';
        requestBody = {
          text: body.text,
        };
        break;
      case 'delete-comment':
        endpoint = `/linkedin/posts/${body.postId}/comments/${body.commentId}`;
        method = 'DELETE';
        break;
      
      // Mentions
      case 'search-users':
        endpoint = `/linkedin/search/users?q=${encodeURIComponent(body.query || '')}`;
        break;
      
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
    console.log(`Response body: ${responseText}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || `API error: ${response.status}`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('LinkedIn API error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
