import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID")!;
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  console.log(`LinkedIn Auth - Action: ${action}`);

  try {
    // Generate authorization URL
    if (action === "authorize") {
      const { redirectUri } = await req.json();
      
      if (!redirectUri) {
        throw new Error("redirectUri is required");
      }

      const state = crypto.randomUUID();
      const scope = "openid profile email";
      
      const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("scope", scope);

      console.log(`Generated auth URL for redirect: ${redirectUri}`);

      return new Response(
        JSON.stringify({ url: authUrl.toString(), state }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for token and create/sign in user
    if (action === "callback") {
      const { code, redirectUri } = await req.json();

      if (!code || !redirectUri) {
        throw new Error("code and redirectUri are required");
      }

      console.log("Exchanging code for access token...");

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
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokenData);
        throw new Error(tokenData.error_description || "Failed to exchange code for token");
      }

      console.log("Access token obtained, fetching user info...");

      // Fetch user info from LinkedIn
      const userInfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const userInfo = await userInfoResponse.json();

      if (!userInfoResponse.ok) {
        console.error("Failed to fetch user info:", userInfo);
        throw new Error("Failed to fetch LinkedIn user info");
      }

      console.log(`User info fetched for: ${userInfo.email}`);

      // Create Supabase admin client
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === userInfo.email);

      let session;

      if (existingUser) {
        // Sign in existing user by generating a session
        console.log(`Signing in existing user: ${userInfo.email}`);
        
        const { data, error } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: userInfo.email,
        });

        if (error) {
          console.error("Failed to generate magic link:", error);
          throw new Error("Failed to sign in user");
        }

        // Extract token from the link and use it to create session
        const tokenHash = new URL(data.properties.action_link).searchParams.get("token");
        
        // Use the admin API to create a session directly
        const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: userInfo.email,
          options: {
            redirectTo: redirectUri.replace("/auth/callback", "/"),
          },
        });

        if (sessionError) throw sessionError;

        // Return magic link for the client to use
        return new Response(
          JSON.stringify({ 
            success: true, 
            magicLink: sessionData.properties.action_link,
            user: {
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Create new user
        console.log(`Creating new user: ${userInfo.email}`);
        
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userInfo.email,
          email_confirm: true,
          user_metadata: {
            full_name: userInfo.name,
            avatar_url: userInfo.picture,
            linkedin_sub: userInfo.sub,
          },
        });

        if (createError) {
          console.error("Failed to create user:", createError);
          throw new Error("Failed to create user account");
        }

        // Generate magic link for the new user
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: userInfo.email,
        });

        if (linkError) throw linkError;

        return new Response(
          JSON.stringify({ 
            success: true, 
            magicLink: linkData.properties.action_link,
            user: {
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
            },
            isNewUser: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("LinkedIn Auth Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
