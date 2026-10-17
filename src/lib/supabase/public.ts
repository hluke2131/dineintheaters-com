import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Anonymous, cookie-free client for reads that must not depend on the request
// (the sitemap). Calling cookies() would make a route dynamic, so anything
// that has to be prerendered and revalidated on a timer uses this instead of
// the server client. It carries only the anon key, so row-level security
// (is_published = true) applies exactly as it does everywhere else.
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
