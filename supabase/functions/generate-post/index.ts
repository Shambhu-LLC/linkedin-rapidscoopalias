import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform-specific instructions
const platformInstructions: Record<string, string> = {
  linkedin: `The post rewritten is for LinkedIn.
Write a long-form LinkedIn post targeting around 800 words.
Each sentence must be on its own line with a blank line between sentences (one-liner format).
Maximum 3000 characters (LinkedIn's limit). Prioritize depth and value.`,
  twitter: `The post rewritten is for X(formerly called as Twitter).
Post can have a maximum of 200 characters(including spaces, punctuations and everything), this should be followed strictly(no exemptions).`,
  facebook: `The post rewritten is for Facebook.
Post can have a maximum of 5000 characters(including spaces, punctuations and everything), this should be followed strictly(no exemptions).`,
  instagram: `The post rewritten is for Instagram.
Post can have a maximum of 2200 characters(including spaces, punctuations and everything), this should be followed strictly(no exemptions).`,
};

// Interest pillar system prompts - SHARP & PUNCHY
const interestPillarsSystemPrompts: Record<string, string> = {
  inspire: `FRAMEWORK: INSPIRE
• Hook: One bold statement (under 8 words)
• The shift: What changed? Expand with a concrete example or data point.
• The lesson: Universal truth. Back it up with real-world evidence.
• The journey: Walk through the transformation step by step.
• CTA: Challenge or question
Use one-liner format: one sentence per line, blank line between each. No paragraphs. Target 800 words.`,
  educate: `FRAMEWORK: EDUCATE
• Hook: Surprising fact or question
• The insight: One clear concept explained in depth
• The breakdown: 5-7 bullet points, each with a concrete example or data point
• The deep dive: Expand on the most important points with real scenarios
• The takeaway: "Here's what this means for you"
Use one-liner format: one sentence per line, blank line between each. No paragraphs. Target 800 words.`,
  sell: `FRAMEWORK: SELL
• Hook: Pain point or opportunity
• The gap: What most people miss — explain with examples
• The evidence: Share proof, numbers, or case studies
• The solution: Your unique angle, explained step by step
• CTA: Clear next step
Use one-liner format: one sentence per line, blank line between each. No paragraphs. Target 800 words.`,
  proof: `FRAMEWORK: PROOF
• Hook: The result (number or outcome)
• The context: What was tested — full background
• The process: Walk through what happened step by step
• The insight: Why it worked, with supporting data
• The prediction: What's next and what it means for the reader
Use one-liner format: one sentence per line, blank line between each. No paragraphs. Target 800 words.`,
};

// LinkedIn optimizer - AGGRESSIVE BREVITY
const linkedinOptimizerSystemPrompt = `You write SHARP LinkedIn posts that stop the scroll.

RULES (NON-NEGOTIABLE):
1. HOOK: First line under 8 words. Make them NEED to read more.
2. ONE IDEA: Each post = ONE insight. No tangents.
3. WHITE SPACE: One sentence per line. Blank line between each.
4. BULLETS: Use "→" or "•" for lists. 3-5 points max.
5. NO FLUFF: Cut "I think", "In my opinion", "Basically". Just say it.
6. TARGET 800 WORDS: Go deep on the topic. Every sentence earns its place.
7. ONE-LINER FORMAT: One sentence per line. Blank line between each. No paragraphs.
8. END STRONG: Question, bold statement, or clear CTA.

BANNED:
- Emojis at start of bullets (🔹🚀✅)
- "Let me tell you a story..."
- Generic openings like "Here's the thing..."
- Hashtags in the middle of content`;


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
