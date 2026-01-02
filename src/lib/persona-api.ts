import { supabase } from "@/integrations/supabase/client";
import type { LinkedInProfile } from "./linkedin-api";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface Persona {
  id?: string;
  name: string;
  tone?: string;
  style?: string;
  topics?: string[];
  headline?: string;
  summary?: string;
  [key: string]: unknown;
}

export async function createPersonaFromProfile(profile: LinkedInProfile): Promise<Persona> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error("User not authenticated");
  }

  const bearer = `Bearer ${session.access_token}`;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-persona`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: bearer,
    },
    body: JSON.stringify({ linkedinProfile: profile }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create persona");
  }

  const data = await response.json();
  const persona = data.persona;

  // Store persona in database
  const { error: upsertError } = await supabase
    .from('personas')
    .upsert({
      user_id: session.user.id,
      name: persona.name || null,
      headline: persona.headline || null,
      tone: persona.tone || null,
      style: persona.style || null,
      topics: persona.topics || null,
      summary: persona.summary || null,
      raw_data: persona,
    }, {
      onConflict: 'user_id',
    });

  if (upsertError) {
    console.error('Error saving persona:', upsertError);
    // Don't throw - persona was created, just not saved
  }

  return persona;
}

export async function getStoredPersona(): Promise<Persona | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  // Return the raw_data if available, otherwise construct from columns
  if (data.raw_data) {
    return data.raw_data as Persona;
  }

  return {
    id: data.id,
    name: data.name || '',
    headline: data.headline || undefined,
    tone: data.tone || undefined,
    style: data.style || undefined,
    topics: data.topics || undefined,
    summary: data.summary || undefined,
  };
}

export async function clearStoredPersona(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('personas')
    .delete()
    .eq('user_id', user.id);
}
