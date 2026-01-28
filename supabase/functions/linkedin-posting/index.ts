import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LINKEDIN_POSTING_CLIENT_ID = Deno.env.get("LINKEDIN_POSTING_CLIENT_ID")!;
const LINKEDIN_POSTING_CLIENT_SECRET = Deno.env.get("LINKEDIN_POSTING_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const action = url.searchParams.get("action") ?? body?.action;

  console.log(`LinkedIn Posting - Action: ${action}`);

  try {
    // Generate authorization URL for posting permissions
    if (action === "authorize") {
      const redirectUri = body?.redirectUri;

      if (!redirectUri) {
        throw new Error("redirectUri is required");
      }

      const state = crypto.randomUUID();
      // Request posting scopes: r_basicprofile for profile info, w_member_social for posting
      const scope = "r_basicprofile w_member_social";

      const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", LINKEDIN_POSTING_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("scope", scope);

      console.log(`Generated posting auth URL for redirect: ${redirectUri}`);

      return new Response(
        JSON.stringify({ success: true, url: authUrl.toString(), state }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Exchange code for token and store for posting
    if (action === "callback") {
      const code = body?.code;
      const redirectUri = body?.redirectUri;
      const userId = body?.userId;

      if (!code || !redirectUri) {
        console.error("Missing required parameters:", { hasCode: !!code, hasRedirectUri: !!redirectUri });
        throw new Error("code and redirectUri are required");
      }

      console.log(`Exchanging code for posting access token with redirect URI: ${redirectUri}`);

      // Exchange authorization code for access token
      const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: LINKEDIN_POSTING_CLIENT_ID,
          client_secret: LINKEDIN_POSTING_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", JSON.stringify(tokenData));
        throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange code for token");
      }

      console.log("Posting access token obtained, fetching user info...");

      // Fetch user info from LinkedIn using v2 API (for r_basicprofile scope)
      const userInfoResponse = await fetch("https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~digitalmediaAsset:playableStreams))", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const profileData = await userInfoResponse.json();

      if (!userInfoResponse.ok) {
        console.error("Failed to fetch user info:", profileData);
        throw new Error("Failed to fetch LinkedIn user info");
      }

      // Extract profile picture URL from the response
      let pictureUrl: string | null = null;
      try {
        const elements = profileData.profilePicture?.["displayImage~"]?.elements;
        if (elements && elements.length > 0) {
          // Get the largest image
          const largestImage = elements[elements.length - 1];
          pictureUrl = largestImage?.identifiers?.[0]?.identifier || null;
        }
      } catch (e) {
        console.log("Could not extract profile picture:", e);
      }

      const userInfo = {
        sub: profileData.id,
        name: `${profileData.localizedFirstName || ''} ${profileData.localizedLastName || ''}`.trim(),
        picture: pictureUrl,
      };

      console.log(`User info fetched for posting: ${userInfo.name} (${userInfo.sub})`);

      // Create Supabase admin client
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Get current user from auth header if not provided
      let currentUserId = userId;
      const authHeader = req.headers.get("Authorization");
      console.log(`Callback - Auth header present: ${!!authHeader}, userId provided: ${!!userId}`);
      
      if (!currentUserId) {
        if (authHeader) {
          const token = authHeader.replace("Bearer ", "");
          console.log("Callback - Decoding JWT to get user ID");
          try {
            // Decode JWT payload (base64url encoded, second part of token)
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
            currentUserId = payload.sub;
            console.log(`Callback - User ID from JWT claims: ${currentUserId || 'none'}`);
          } catch (e) {
            console.error("Callback - Failed to decode JWT:", e);
          }
        } else {
          console.error("Callback - No authorization header provided");
        }
      }

      if (!currentUserId) {
        console.error("Callback - Failed to authenticate user. No valid session found.");
        throw new Error("User not authenticated - please ensure you are signed in");
      }

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString();

      // Check if posting account already exists for this user
      const { data: existingAccount } = await supabase
        .from("linkedin_accounts")
        .select("*")
        .eq("user_id", currentUserId)
        .eq("connection_type", "posting")
        .single();

      if (existingAccount) {
        // Update existing posting account
        const { error: updateError } = await supabase
          .from("linkedin_accounts")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            token_expires_at: expiresAt,
            linkedin_id: userInfo.sub,
            profile_name: userInfo.name,
            profile_picture_url: userInfo.picture,
            profile_data: userInfo,
            is_active: true,
            publishing_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAccount.id);

        if (updateError) throw updateError;
      } else {
        // Create new posting account
        const { error: insertError } = await supabase
          .from("linkedin_accounts")
          .insert({
            user_id: currentUserId,
            linkedin_id: userInfo.sub,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            token_expires_at: expiresAt,
            profile_name: userInfo.name,
            profile_picture_url: userInfo.picture,
            profile_data: userInfo,
            is_active: true,
            publishing_enabled: true,
            connection_type: "posting",
          });

        if (insertError) throw insertError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            name: userInfo.name,
            picture: userInfo.picture,
            sub: userInfo.sub,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get posting connection status
    if (action === "get-posting-account") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Not authenticated");
      }

      const token = authHeader.replace("Bearer ", "");
      
      // Decode JWT to get user ID from claims
      let userId: string;
      try {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        userId = payload.sub;
      } catch (e) {
        throw new Error("Invalid token");
      }
      
      if (!userId) {
        throw new Error("Not authenticated");
      }
      const user = { id: userId };

      const { data: account, error } = await supabase
        .from("linkedin_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("connection_type", "posting")
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          connected: !!account,
          account: account ? {
            id: account.id,
            linkedinId: account.linkedin_id,
            name: account.profile_name,
            picture: account.profile_picture_url,
            publishingEnabled: account.publishing_enabled,
          } : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create post directly on LinkedIn
    if (action === "create-post") {
      const content = body?.content;
      const visibility = body?.visibility || "PUBLIC";

      if (!content) {
        throw new Error("Content is required");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Not authenticated");
      }

      const token = authHeader.replace("Bearer ", "");
      
      // Decode JWT to get user ID from claims
      let userId: string;
      try {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        userId = payload.sub;
      } catch (e) {
        throw new Error("Invalid token");
      }
      
      if (!userId) {
        throw new Error("Not authenticated");
      }
      const user = { id: userId };

      // Get posting account
      const { data: account, error: accountError } = await supabase
        .from("linkedin_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("connection_type", "posting")
        .eq("is_active", true)
        .single();

      if (accountError || !account) {
        throw new Error("No LinkedIn posting account connected. Please connect your LinkedIn account first.");
      }

      console.log(`Creating post for LinkedIn user: ${account.linkedin_id}`);

      // Create post using LinkedIn API
      const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: `urn:li:person:${account.linkedin_id}`,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: {
                text: content,
              },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": visibility,
          },
        }),
      });

      if (!postResponse.ok) {
        const errorData = await postResponse.json();
        console.error("LinkedIn post error:", JSON.stringify(errorData));
        throw new Error(errorData.message || "Failed to create post on LinkedIn");
      }

      const postData = await postResponse.json();
      console.log("Post created successfully:", postData.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: postData.id,
            content,
            visibility,
            createdAt: new Date().toISOString(),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Link GetLate account ID to posting account
    if (action === "link-getlate-account") {
      const getlateAccountId = body?.getlateAccountId;

      if (!getlateAccountId) {
        throw new Error("getlateAccountId is required");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Not authenticated");
      }

      const token = authHeader.replace("Bearer ", "");
      
      // Decode JWT to get user ID from claims
      let userId: string;
      try {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        userId = payload.sub;
      } catch (e) {
        throw new Error("Invalid token");
      }
      
      if (!userId) {
        throw new Error("Not authenticated");
      }
      const user = { id: userId };

      const { error } = await supabase
        .from("linkedin_accounts")
        .update({ getlate_account_id: getlateAccountId })
        .eq("user_id", user.id)
        .eq("connection_type", "posting")
        .eq("is_active", true);

      if (error) throw error;

      console.log(`Linked GetLate account ${getlateAccountId} to posting account for user ${user.id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Disconnect posting account
    if (action === "disconnect") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("Not authenticated");
      }

      const token = authHeader.replace("Bearer ", "");
      
      // Decode JWT to get user ID from claims
      let userId: string;
      try {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        userId = payload.sub;
      } catch (e) {
        throw new Error("Invalid token");
      }
      
      if (!userId) {
        throw new Error("Not authenticated");
      }
      const user = { id: userId };

      const { error } = await supabase
        .from("linkedin_accounts")
        .update({ is_active: false, publishing_enabled: false })
        .eq("user_id", user.id)
        .eq("connection_type", "posting");

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("LinkedIn Posting Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
