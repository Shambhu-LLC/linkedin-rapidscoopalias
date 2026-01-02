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

const PERSONA_STORAGE_KEY = "user_persona";

export async function createPersonaFromProfile(profile: LinkedInProfile): Promise<Persona> {
  const { data: { session } } = await supabase.auth.getSession();
  const bearer = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_KEY}`;

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
  
  // Store persona in localStorage for now
  localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(data.persona));
  
  return data.persona;
}

export function getStoredPersona(): Persona | null {
  const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearStoredPersona(): void {
  localStorage.removeItem(PERSONA_STORAGE_KEY);
}
