import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const imageGenerationSystemPrompt = `You are The Anti-Sci-Fi Prop Master for a gritty, realistic drama set in the present day. Your job is to ensure every object looks tangible, used, and ordinary. You aggressively reject any 'futuristic', 'holographic', or 'glowing' aesthetics.

THE "IRON MAN" KILL SWITCH (CRITICAL PROTOCOL)
Image models often default to sci-fi when they see words like "Data," "AI," or "Analytics." You must ACTIVELY fight this tendency.

1. FORBIDDEN VISUALS (Negative constraints):
   - NO holographic displays, floating screens, or Heads-Up Displays (HUDs).
   - NO glowing blue/green data streams or circuit patterns in the air.
   - NO transparent monitors or futuristic interfaces.
   - NO "cyberpunk" lighting (neon pink/purple).

2. MUNDANE TRANSLATION RULE:
   - If text implies "Analytics/Data" → You MUST visualize: A messy whiteboard with marker pen, printed spreadsheets on a clipboard, or a standard, thick-bezel monitor showing a boring Excel sheet.
   - If text implies "AI/Technology" → You MUST visualize: A normal laptop (e.g., a silver MacBook or black Dell) sitting on a wooden desk, perhaps slightly dusty.

TRANSLATION PROTOCOL
1. Scene Extraction: Identify the human moment and anchor it in a physical, non-futuristic reality.

2. Style Definition (Three Variations):

   STYLE A: The Gritty Documentary Photo (Tangible Reality)
   - Goal: A realistic photo emphasizing texture and imperfection.
   - Keywords: 35mm film grain, natural window light, messy desk, paper documents, coffee stains, tangible objects, shallow depth of field, candid expression.

   STYLE B: The Tactile 3D Render (Matte Finish)
   - Goal: A clean illustration that feels like physical toys or clay, not digital light.
   - Keywords: Clay render, matte finish plastic, wooden desk texture, soft pastel colors, natural lighting, isometric view, no glowing elements.

   STYLE C: The Analog Sketch (Paper & Ink)
   - Goal: A physical drawing on real paper.
   - Keywords: Black ink pen on textured notebook paper, hand-drawn lines, rough sketch, visual metaphor.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postContent, style = "human_enhanced" } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // First, generate image prompts based on post content
    const promptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: imageGenerationSystemPrompt },
          { 
            role: "user", 
            content: `Generate image prompts based on this post content. Apply the "Iron Man" Kill Switch strictly.

INPUT DATA
[GENERATED_POST_CONTENT]:
"${postContent}"

Output strictly in valid JSON format:
{
  "scenario_summary": "String (The grounded, physical scene description)",
  "prompts": {
    "human_enhanced": "String (Focus on film grain, natural light, printed paper, standard monitors)",
    "avatar_3d": "String (Focus on clay/wood textures, matte finish, no glow)",
    "stick_figure": "String (Focus on ink on physical paper)"
  }
}`
          },
        ],
      }),
    });

    if (!promptResponse.ok) {
      if (promptResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate image prompts");
    }

    const promptData = await promptResponse.json();
    const promptsText = promptData.choices?.[0]?.message?.content;
    
    // Parse the JSON from the response
    let prompts;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = promptsText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        promptsText.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, promptsText];
      prompts = JSON.parse(jsonMatch[1] || promptsText);
    } catch {
      console.error("Failed to parse prompts:", promptsText);
      prompts = {
        prompts: {
          human_enhanced: `Professional photograph of a person working at a desk with papers and laptop, natural lighting, 35mm film grain`,
          avatar_3d: `Clay render of office scene, matte finish, soft pastel colors`,
          stick_figure: `Black ink sketch on notebook paper of business concept`
        }
      };
    }

    const selectedPrompt = prompts.prompts?.[style] || prompts.prompts?.human_enhanced;

    // Generate the actual image using the image model
    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          { role: "user", content: selectedPrompt }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!imageResponse.ok) {
      if (imageResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate image");
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    return new Response(JSON.stringify({ 
      imageUrl,
      prompts: prompts.prompts,
      selectedPrompt,
      scenarioSummary: prompts.scenario_summary
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-image function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
