import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasValidConfig = supabaseUrl && supabaseAnonKey;

let supabase: SupabaseClient | null = null;

if (hasValidConfig) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn("Supabase initialization failed:", error);
  }
} else {
  console.warn("Supabase config not found. Running without Supabase.");
}

export { supabase };
export const appId = "grandma-crm";
