import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform-specific instructions
const platformInstructions: Record<string, string> = {
  linkedin: `The post rewritten is for LinkedIn.
Post can have a maximum of 2600 characters(including spaces, punctuations and everything), this should be followed strictly(no exemptions).`,
  twitter: `The post rewritten is for X(formerly called as Twitter).
Post can have a maximum of 200 characters(including spaces, punctuations and everything), this should be followed strictly(no exemptions).`,
  facebook: `The post rewritten is for Facebook.
Post can have a maximum of 5000 characters(including spaces, punctuations and everything), this should be followed strictly(no exemptions).`,
  instagram: `The post rewritten is for Instagram.
Post can have a maximum of 2200 characters(including spaces, punctuations and everything), this should be followed strictly(no exemptions).`,
};

// Interest pillar system prompts
const interestPillarsSystemPrompts: Record<string, string> = {
  inspire: `TASK: Convert this News/Fact into an Inspirational Story.
FRAMEWORK:
1. THE CONTEXT: Briefly state the new discovery/event.
2. THE STRUGGLE/SHIFT: Highlight the human effort or the paradigm shift it represents.
3. THE LESSON: Connect it to a universal truth about growth or resilience.`,
  educate: `TASK: Convert this News/Fact into an Educational Insight.
FRAMEWORK:
1. THE CONCEPT: What happened? (The News).
2. THE EXPLANATION: How does it work? (Simple analogy).
3. THE TAKEAWAY: Why does this matter to the future?`,
  sell: `TASK: Convert this News/Fact into a Market Opportunity/Pitch.
FRAMEWORK:
1. THE SHIFT: The world just changed because of this news.
2. THE GAP: Most people aren't ready.
3. THE SOLUTION: How we (the user) help navigate this shift.`,
  proof: `TASK: Convert this News/Fact into Evidence/Validation.
FRAMEWORK:
1. THE DATA: Cite the specific number or result from the news.
2. THE VALIDATION: This proves a core theory we believe in.
3. THE FUTURE: What this data predicts next.`,
};

// LinkedIn optimizer system prompt
const linkedinOptimizerSystemPrompt = `ACT AS: A LinkedIn Growth Hacker & Visual Editor.

STRICT FORMATTING MANDATES:
1. NO BLOCKS OF TEXT: Every single sentence must have a blank line after it. Zero exceptions.
2. 6-SECOND VALUE: The reader must grasp the full insight instantly. Cut ALL filler words.
3. BULLET POINTS: Convert the core insights into a punchy bullet list (don't use emojis like 🔹, 🚀, or ✅).
4. RUTHLESS BREVITY: Total post must be UNDER 100 words. If it doesn't add value, delete it.
5. THE HOOK: The first line must be under 10 words and stop the scroll.

CONSTRAINT: Keep the core meaning, but strip the weight. Make it visual.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      action, 
      content, 
      platform = "linkedin", 
      pillar = "inspire",
      topics = [],
      persona = null,
      userLinks = []
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Parse persona if it's a string
    let personaData = null;
    if (persona) {
      try {
        personaData = typeof persona === 'string' ? JSON.parse(persona) : persona;
      } catch {
        personaData = null;
      }
    }

    const personaContext = personaData 
      ? `Write as ${personaData.name || 'a professional'}. Tone: ${personaData.tone || 'professional and engaging'}. Style: ${personaData.style || 'clear and concise'}.`
      : '';

    let systemPrompt = "";
    let userPrompt = "";

    // Base instruction for all actions
    const outputInstruction = `

CRITICAL: Output ONLY the final post text. No explanations, no headers, no "Here's your post:", no markdown formatting. Just the raw post content ready to copy and paste.`;

    if (action === "rewrite") {
      systemPrompt = `You are an expert social media content writer. ${personaContext}${outputInstruction}`;
      
      userPrompt = `Rewrite this content for ${platform}:

${content}

${platformInstructions[platform] || platformInstructions.linkedin}`;

    } else if (action === "surprise") {
      const topicNames = topics.map((t: { name: string }) => t.name).join(", ");
      const topicPerspectives = topics
        .filter((t: { perspective?: string }) => t.perspective)
        .map((t: { name: string; perspective?: string }) => `${t.name}: ${t.perspective}`)
        .join("\n");
      
      systemPrompt = `You are an expert ${platform} content creator. ${personaContext}

${interestPillarsSystemPrompts[pillar] || interestPillarsSystemPrompts.inspire}${outputInstruction}`;
      
      userPrompt = `Create a ${pillar} post about: ${topicNames || "a trending topic relevant to professionals"}

${topicPerspectives ? `Context:\n${topicPerspectives}` : ""}
${userLinks.length > 0 ? `Include link: ${userLinks[0]}` : ""}

${platformInstructions[platform] || platformInstructions.linkedin}`;

    } else if (action === "generate") {
      systemPrompt = `You are an expert ${platform} ghostwriter. ${personaContext}

${linkedinOptimizerSystemPrompt}${outputInstruction}`;
      
      const topicContext = topics
        .filter((t: { perspective?: string }) => t.perspective)
        .map((t: { name: string; perspective?: string }) => t.perspective)
        .join("\n\n");
      
      userPrompt = `Create a ${pillar} post${content ? ` about: ${content}` : ''}.

${topicContext ? `Context:\n${topicContext}` : ""}
${userLinks.length > 0 ? `Include link: ${userLinks[0]}` : ""}

${platformInstructions[platform] || platformInstructions.linkedin}`;

    } else if (action === "optimize") {
      systemPrompt = `You are an expert LinkedIn content optimizer.${outputInstruction}`;
      userPrompt = `Optimize this post for maximum engagement:\n\n${content}`;
    } else {
      throw new Error("Invalid action. Use: rewrite, surprise, generate, or optimize");
    }

    console.log("Generating post with action:", action, "pillar:", pillar);
    console.log("Persona:", personaData?.name || "none");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ content: generatedContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-post function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
