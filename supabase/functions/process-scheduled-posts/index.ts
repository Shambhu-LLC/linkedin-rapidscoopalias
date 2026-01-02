import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GETLATE_API_KEY = Deno.env.get("GETLATE_API_KEY");
const GETLATE_BASE_URL = "https://getlate.dev/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing scheduled posts...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending posts that are due
    const now = new Date().toISOString();
    const { data: pendingPosts, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now);

    if (fetchError) {
      console.error("Error fetching scheduled posts:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingPosts?.length || 0} posts to process`);

    if (!pendingPosts || pendingPosts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No posts to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const post of pendingPosts) {
      console.log(`Processing post ${post.id} scheduled for ${post.scheduled_at}`);

      try {
        // Get the user's LinkedIn account from GetLate.dev
        const accountsResponse = await fetch(`${GETLATE_BASE_URL}/accounts`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${GETLATE_API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (!accountsResponse.ok) {
          throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
        }

        const accountsData = await accountsResponse.json();
        const accounts = accountsData?.accounts || accountsData || [];
        const linkedInAccount = accounts.find((a: any) => a?.platform === "linkedin" && a?.isActive !== false);

        if (!linkedInAccount) {
          console.error(`No LinkedIn account found for post ${post.id}`);
          await supabase
            .from("scheduled_posts")
            .update({ status: "failed" })
            .eq("id", post.id);
          results.push({ id: post.id, status: "failed", error: "No LinkedIn account" });
          continue;
        }

        const accountId = linkedInAccount._id || linkedInAccount.id;
        console.log(`Using LinkedIn account ${accountId} for post ${post.id}`);

        // Create the post via GetLate.dev
        const createPostResponse = await fetch(`${GETLATE_BASE_URL}/posts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GETLATE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: post.content,
            accountId: accountId,
            ...(post.image_url ? { mediaUrl: post.image_url } : {}),
          }),
        });

        if (!createPostResponse.ok) {
          const errorText = await createPostResponse.text();
          console.error(`Failed to create post ${post.id}:`, errorText);
          await supabase
            .from("scheduled_posts")
            .update({ status: "failed" })
            .eq("id", post.id);
          results.push({ id: post.id, status: "failed", error: errorText });
          continue;
        }

        const postResult = await createPostResponse.json();
        console.log(`Successfully posted ${post.id}:`, postResult);

        // Mark as posted
        await supabase
          .from("scheduled_posts")
          .update({ status: "posted" })
          .eq("id", post.id);

        results.push({ id: post.id, status: "posted" });
      } catch (postError) {
        console.error(`Error processing post ${post.id}:`, postError);
        await supabase
          .from("scheduled_posts")
          .update({ status: "failed" })
          .eq("id", post.id);
        results.push({ id: post.id, status: "failed", error: String(postError) });
      }
    }

    console.log("Processing complete:", results);

    return new Response(
      JSON.stringify({ message: "Processing complete", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-scheduled-posts:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
