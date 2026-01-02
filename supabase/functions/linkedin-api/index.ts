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
  name?: string;
  description?: string;
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

    let body: RequestBody = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const action = url.searchParams.get('action') ?? (body as any)?.action;


    console.log(`GetLate API action: ${action}`, body);

    let endpoint = '';
    let method = 'GET';
    let requestBody: Record<string, unknown> | null = null;

    switch (action) {
      // Profile & Accounts
      case 'get-profile': {
        // Fetch accounts to get profile info since /profiles doesn't return user details
        const accountsResponse = await fetch(`${GETLATE_BASE_URL}/accounts`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${GETLATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!accountsResponse.ok) {
          throw new Error('Failed to fetch profile data');
        }
        
        const accountsData = await accountsResponse.json();
        const accounts = accountsData.accounts || accountsData;
        const linkedinAccount = Array.isArray(accounts) 
          ? accounts.find((a: any) => a.platform === 'linkedin' && a.isActive)
          : null;
        
        if (linkedinAccount) {
          // Parse displayName into firstName and lastName
          const displayName = linkedinAccount.displayName || '';
          const nameParts = displayName.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              id: linkedinAccount.platformUserId || linkedinAccount._id,
              firstName,
              lastName,
              displayName,
              headline: linkedinAccount.metadata?.headline || '',
              profilePicture: linkedinAccount.metadata?.profilePicture || linkedinAccount.profilePicture,
              vanityName: linkedinAccount.metadata?.vanityName || '',
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Fallback to profiles endpoint
        endpoint = '/profiles';
        break;
      }
      case 'get-accounts': {
        const profileId = body.profileId || url.searchParams.get('profileId');
        endpoint = profileId ? `/accounts?profileId=${profileId}` : '/accounts';
        break;
      }
      
      // Create or get profile for LinkedIn connection
      case 'create-profile': {
        const profileName = body.name || 'LinkedInUsers';
        const description = body.description || 'LinkedIn connected accounts';
        
        // First check if profile exists
        const profilesRes = await fetch(`${GETLATE_BASE_URL}/profiles`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${GETLATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (profilesRes.ok) {
          const profilesData = await profilesRes.json();
          const profiles = profilesData.profiles || profilesData || [];
          const existingProfile = profiles.find((p: any) => p.name === profileName);
          
          if (existingProfile) {
            return new Response(JSON.stringify({
              success: true,
              data: { profileId: existingProfile._id || existingProfile.id },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        // Create new profile
        const createRes = await fetch(`${GETLATE_BASE_URL}/profiles`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GETLATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: profileName, description }),
        });
        
        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(`Failed to create profile: ${errText}`);
        }
        
        const createData = await createRes.json();
        return new Response(JSON.stringify({
          success: true,
          data: { profileId: createData._id || createData.id || createData.profileId },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Get LinkedIn connect URL - calls GetLate API to get actual OAuth redirect
      case 'get-connect-url': {
        const profileId = body.profileId;
        if (!profileId) {
          throw new Error('Missing profileId for connect URL');
        }
        
        // Call GetLate API to get the actual OAuth redirect URL
        const connectRes = await fetch(`${GETLATE_BASE_URL}/connect/linkedin?profileId=${encodeURIComponent(profileId)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${GETLATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          redirect: 'manual', // Don't follow redirects, we want the URL
        });
        
        console.log('GetLate connect response status:', connectRes.status);
        console.log('GetLate connect response headers:', JSON.stringify(Object.fromEntries(connectRes.headers.entries())));
        
        // If it's a redirect, get the location header
        if (connectRes.status >= 300 && connectRes.status < 400) {
          const redirectUrl = connectRes.headers.get('location');
          if (redirectUrl) {
            return new Response(JSON.stringify({
              success: true,
              data: { connectUrl: redirectUrl, profileId },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        // Otherwise parse response body
        const connectText = await connectRes.text();
        console.log('GetLate connect response body:', connectText.substring(0, 500));
        
        let connectData: any;
        try {
          connectData = JSON.parse(connectText);
        } catch {
          connectData = { message: connectText };
        }
        
        if (!connectRes.ok) {
          throw new Error(connectData.error || connectData.message || `Connect API error: ${connectRes.status}`);
        }
        
        // Return the OAuth URL from the response
        const oauthUrl = connectData.url || connectData.redirectUrl || connectData.authUrl;
        if (oauthUrl) {
          return new Response(JSON.stringify({
            success: true,
            data: { connectUrl: oauthUrl, profileId },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // If we got here, return the full response for debugging
        return new Response(JSON.stringify({
          success: true,
          data: { connectUrl: null, profileId, _debug: connectData },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'disconnect-account':
        if (!body.accountId) {
          throw new Error('Missing accountId');
        }
        endpoint = `/accounts/${body.accountId}`;
        method = 'DELETE';
        break;
      case 'get-analytics': {
        // Fetch analytics from GetLate.dev
        try {
          const analyticsResponse = await fetch(`${GETLATE_BASE_URL}/analytics`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${GETLATE_API_KEY}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!analyticsResponse.ok) {
            const errorText = await analyticsResponse.text();
            console.error('Analytics API error:', analyticsResponse.status, errorText);
            
            // Return empty analytics if not available
            return new Response(JSON.stringify({ 
              success: true, 
              data: {
                profileViews: 0,
                profileViewsChange: 0,
                impressions: 0,
                impressionsChange: 0,
                reactions: 0,
                reactionsChange: 0,
                comments: 0,
                commentsChange: 0,
                shares: 0,
                sharesChange: 0,
                followers: 0,
                followersChange: 0,
              },
              _message: "Analytics data not available."
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          const analyticsData = await analyticsResponse.json();
          console.log('GetLate analytics response:', JSON.stringify(analyticsData).substring(0, 500));
          
          // Transform GetLate.dev analytics response to our format
          const transformedAnalytics = {
            profileViews: analyticsData.profileViews ?? analyticsData.profile_views ?? 0,
            profileViewsChange: analyticsData.profileViewsChange ?? analyticsData.profile_views_change ?? 0,
            impressions: analyticsData.impressions ?? analyticsData.total_impressions ?? 0,
            impressionsChange: analyticsData.impressionsChange ?? analyticsData.impressions_change ?? 0,
            reactions: analyticsData.reactions ?? analyticsData.total_reactions ?? 0,
            reactionsChange: analyticsData.reactionsChange ?? analyticsData.reactions_change ?? 0,
            comments: analyticsData.comments ?? analyticsData.total_comments ?? 0,
            commentsChange: analyticsData.commentsChange ?? analyticsData.comments_change ?? 0,
            shares: analyticsData.shares ?? analyticsData.total_shares ?? 0,
            sharesChange: analyticsData.sharesChange ?? analyticsData.shares_change ?? 0,
            followers: analyticsData.followers ?? analyticsData.follower_count ?? 0,
            followersChange: analyticsData.followersChange ?? analyticsData.followers_change ?? 0,
          };
          
          return new Response(JSON.stringify({ 
            success: true, 
            data: transformedAnalytics,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Analytics fetch error:', errorMessage);
          return new Response(JSON.stringify({ 
            success: true, 
            data: null,
            _message: `Analytics error: ${errorMessage}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
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
