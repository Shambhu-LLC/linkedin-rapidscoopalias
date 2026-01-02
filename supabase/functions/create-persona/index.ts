import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAMBDA_URL = "https://3qqwzzavpu54fx7vzcdla7vute0rmqrr.lambda-url.ap-south-1.on.aws/";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { linkedinProfile } = await req.json();

    if (!linkedinProfile) {
      console.error("Missing linkedinProfile in request body");
      return new Response(
        JSON.stringify({ error: "LinkedIn profile data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Lambda to create persona for:", linkedinProfile.firstName, linkedinProfile.lastName);

    // Call the AWS Lambda function
    const lambdaResponse = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile: linkedinProfile,
      }),
    });

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text();
      console.error("Lambda error:", lambdaResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create persona", details: errorText }),
        { status: lambdaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const personaData = await lambdaResponse.json();
    console.log("Persona created successfully");

    return new Response(
      JSON.stringify({ success: true, persona: personaData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in create-persona function:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
