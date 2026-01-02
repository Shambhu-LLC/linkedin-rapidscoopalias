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

    // Build a comprehensive profile object for the Lambda
    const profileData = {
      // Basic info
      name: `${linkedinProfile.firstName || ''} ${linkedinProfile.lastName || ''}`.trim(),
      firstName: linkedinProfile.firstName,
      lastName: linkedinProfile.lastName,
      headline: linkedinProfile.headline || '',
      profilePicture: linkedinProfile.profilePicture,
      vanityName: linkedinProfile.vanityName,
      id: linkedinProfile.id,
      
      // Additional fields that might be present
      summary: linkedinProfile.summary || linkedinProfile.bio || '',
      industry: linkedinProfile.industry || '',
      location: linkedinProfile.location || '',
      connections: linkedinProfile.connections || 0,
      
      // Experience and skills if available
      experience: linkedinProfile.experience || [],
      skills: linkedinProfile.skills || [],
      education: linkedinProfile.education || [],
    };

    console.log("Calling Lambda to create persona for:", profileData.name);
    console.log("Profile data being sent:", JSON.stringify(profileData));

    // Call the AWS Lambda function
    const lambdaResponse = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile: profileData,
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
    console.log("Persona created successfully:", JSON.stringify(personaData));

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
