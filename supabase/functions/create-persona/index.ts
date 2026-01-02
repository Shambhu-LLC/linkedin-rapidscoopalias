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
      name: `${linkedinProfile.firstName || ''} ${linkedinProfile.lastName || ''}`.trim(),
      firstName: linkedinProfile.firstName,
      lastName: linkedinProfile.lastName,
      headline: linkedinProfile.headline || '',
      profilePicture: linkedinProfile.profilePicture,
      vanityName: linkedinProfile.vanityName,
      id: linkedinProfile.id,
      summary: linkedinProfile.summary || linkedinProfile.bio || '',
      industry: linkedinProfile.industry || '',
      location: linkedinProfile.location || '',
    };

    // Create a prompt for the Lambda to generate a persona
    const prompt = `Based on this LinkedIn profile, create a detailed AI writing persona in JSON format:

Name: ${profileData.name}
Headline: ${profileData.headline}
Industry: ${profileData.industry || 'Not specified'}
Location: ${profileData.location || 'Not specified'}
Summary: ${profileData.summary || 'Not specified'}

Please respond with ONLY a valid JSON object (no markdown, no explanation) with these fields:
{
  "name": "Full name",
  "headline": "Professional headline",
  "tone": "Writing tone description (e.g., professional, friendly, inspirational)",
  "style": "Writing style description",
  "topics": ["array", "of", "expertise", "topics"],
  "summary": "Brief persona summary for content generation"
}`;

    console.log("Calling Lambda to create persona for:", profileData.name);

    // Call the AWS Lambda function with the prompt
    const lambdaResponse = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile: profileData,
        prompt: prompt,
        message: prompt,
        content: prompt,
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

    let personaData = await lambdaResponse.json();
    console.log("Lambda raw response:", JSON.stringify(personaData));

    // Handle case where Lambda returns a string or object with indexed characters
    if (typeof personaData === 'string') {
      try {
        personaData = JSON.parse(personaData);
      } catch {
        // If it's a chat response, create a basic persona from profile
        console.log("Lambda returned non-JSON, creating persona from profile");
        personaData = {
          name: profileData.name,
          headline: profileData.headline,
          tone: "Professional and engaging",
          style: "Clear, concise, and value-driven",
          topics: profileData.headline ? profileData.headline.split(/[|,·]/).map((t: string) => t.trim()).filter(Boolean) : [],
          summary: `AI persona for ${profileData.name}`,
        };
      }
    } else if (personaData && typeof personaData === 'object' && personaData['0']) {
      // Handle indexed character object (string serialized as object)
      const chars = Object.keys(personaData)
        .filter(k => !isNaN(Number(k)))
        .sort((a, b) => Number(a) - Number(b))
        .map(k => personaData[k])
        .join('');
      
      console.log("Reconstructed string from Lambda:", chars);
      
      try {
        // Try to extract JSON from the response
        const jsonMatch = chars.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          personaData = JSON.parse(jsonMatch[0]);
        } else {
          // Create persona from profile data
          personaData = {
            name: profileData.name,
            headline: profileData.headline,
            tone: "Professional and engaging",
            style: "Clear, concise, and value-driven",
            topics: profileData.headline ? profileData.headline.split(/[|,·]/).map((t: string) => t.trim()).filter(Boolean) : [],
            summary: `AI persona for ${profileData.name}`,
          };
        }
      } catch {
        personaData = {
          name: profileData.name,
          headline: profileData.headline,
          tone: "Professional and engaging",
          style: "Clear, concise, and value-driven",
          topics: [],
          summary: `AI persona for ${profileData.name}`,
        };
      }
    }

    console.log("Final persona data:", JSON.stringify(personaData));

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
