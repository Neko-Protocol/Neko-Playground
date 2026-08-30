import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env.server";

/**
 * Server-only Supabase client (service role — bypasses RLS). Every new
 * event-platform table has RLS enabled with no anon/authenticated policies,
 * so this is the only client capable of reading/writing them; the browser
 * never talks to Supabase directly, only through Next.js API routes.
 *
 * Importing `@/lib/env.server` here means this module inherits its
 * browser-import guard — it throws if pulled into a client bundle.
 */
let cached: SupabaseClient | null = null;

export function getEventPlatformDb(): SupabaseClient {
  if (cached) return cached;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireServerEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return cached;
}
