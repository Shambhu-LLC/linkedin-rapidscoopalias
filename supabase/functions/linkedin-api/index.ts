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
  displayName?: string;
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
      case 'disconnect-account':
        if (!body.accountId) {
          throw new Error('Missing accountId');
        }
        endpoint = `/accounts/${body.accountId}`;
        method = 'DELETE';
        break;
      case 'get-analytics':
        // Analytics requires premium - return null to indicate no data available
        return new Response(JSON.stringify({ 
          success: true, 
          data: null,
          _message: "Analytics requires GetLate.dev premium plan."
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
          content: body.content,
          platforms: body.accountId 
            ? [{ platform: 'linkedin', accountId: body.accountId }] 
            : undefined,
          publishNow: true,
        };
        break;
      case 'update-post':
        endpoint = `/posts/${body.postId}`;
        method = 'PATCH';
        requestBody = {
          content: body.content,
        };
        break;
      case 'delete-post':
        endpoint = `/posts/${body.postId}`;
        method = 'DELETE';
        break;
      
      // Comments - Note: GetLate may not support direct comment management
      case 'get-comments':
        // Comments not supported by GetLate - return empty array
        return new Response(JSON.stringify({ 
          success: true, 
          data: [],
          _message: "Comments not available via GetLate.dev API."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      case 'create-comment':
        // Comments not supported
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Comment creation not available via GetLate.dev API."
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      case 'delete-comment':
        return new Response(JSON.stringify({ success: true, data: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      
      // User search / @mentions resolver
      // Uses GetLate.dev: GET /v1/accounts/{accountId}/linkedin-mentions?url={vanityOrUrl}&displayName={name}
      // IMPORTANT: For person mentions to be clickable, displayName must match exactly what appears on their LinkedIn profile.
      case 'search-users': {
        let query = (body.query || '').toString().trim();
        const accountId = (body.accountId || '').toString().trim();
        const displayName = (body.displayName || '').toString().trim();

        if (!query || !accountId) {
          return new Response(JSON.stringify({
            success: true,
            data: [],
            _message: "Missing accountId. Connect/select a LinkedIn account first."
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Normalize LinkedIn URLs:
        // - https://www.linkedin.com/in/{vanity}/ -> vanity
        // - https://www.linkedin.com/company/{vanity}/ -> vanity
        // - https://www.linkedin.com/school/{vanity}/ -> vanity
        const inMatch = query.match(/linkedin\.com\/in\/([^\/\?\#]+)/i);
        const companyMatch = query.match(/linkedin\.com\/company\/([^\/\?\#]+)/i);
        const schoolMatch = query.match(/linkedin\.com\/school\/([^\/\?\#]+)/i);
        if (inMatch) query = inMatch[1];
        else if (companyMatch) query = companyMatch[1];
        else if (schoolMatch) query = schoolMatch[1];

        console.log(`Resolving LinkedIn mention for: ${query} (displayName: ${displayName || 'auto'}) using account: ${accountId}`);

        try {
          // Build URL with optional displayName parameter
          let mentionEndpoint = `${GETLATE_BASE_URL}/accounts/${accountId}/linkedin-mentions?url=${encodeURIComponent(query)}`;
          if (displayName) {
            mentionEndpoint += `&displayName=${encodeURIComponent(displayName)}`;
          }
          
          console.log(`Calling: ${mentionEndpoint}`);
          const mentionRes = await fetch(mentionEndpoint, {
            headers: {
              'Authorization': `Bearer ${GETLATE_API_KEY}`,
              'Content-Type': 'application/json',
            },
          });

          const mentionText = await mentionRes.text();
          let mentionData: any;
          try {
            mentionData = JSON.parse(mentionText);
          } catch {
            mentionData = { error: mentionText };
          }

          console.log('GetLate mention response:', mentionData);

          if (!mentionRes.ok) {
            return new Response(JSON.stringify({
              success: true,
              data: [],
              _message: mentionData?.error || `Mention not found for: ${query}`,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const resolvedDisplayName = mentionData.displayName || displayName || query;
          const urn = mentionData.urn || query;
          const mentionFormat = mentionData.mentionFormat || `@[${resolvedDisplayName}](${urn})`;

          return new Response(JSON.stringify({
            success: true,
            data: [
              {
                id: urn,
                name: resolvedDisplayName,
                vanityName: query,
                mentionFormat,
              },
            ],
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          console.error('LinkedIn mention resolve error:', e?.message || e);
          return new Response(JSON.stringify({
            success: true,
            data: [],
            _message: "Unable to resolve mention right now."
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
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
