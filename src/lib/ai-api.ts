const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Topic {
  id: string;
  name: string;
  perspective?: string;
  link?: string;
}

interface GeneratePostParams {
  action: "rewrite" | "surprise" | "generate" | "optimize";
  content?: string;
  platform?: string;
  pillar?: string;
  topics?: Topic[];
  persona?: string | null;
  userLinks?: string[];
}

interface GenerateImageParams {
  postContent: string;
  style?: "human_enhanced" | "avatar_3d" | "stick_figure";
}

export async function generatePost(params: GeneratePostParams): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("Usage limit reached. Please add credits to continue.");
    }
    throw new Error(error.error || "Failed to generate post");
  }

  const data = await response.json();
  return data.content;
}

export async function generateImage(params: GenerateImageParams): Promise<{
  imageUrl: string;
  prompts: Record<string, string>;
  selectedPrompt: string;
  scenarioSummary: string;
}> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("Usage limit reached. Please add credits to continue.");
    }
    throw new Error(error.error || "Failed to generate image");
  }

  return response.json();
}
