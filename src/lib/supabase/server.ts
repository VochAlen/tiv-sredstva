// Supabase klijent za server (Server Components, Server Actions, Route Handlers)
// Koristi cookies za auth session

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sinhrona verzija - prima već rezolvan cookieStore
export const createClient = (cookieStore: ReadonlyRequestCookies) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll se može pozvati iz Server Component - tada se cookie set ignoriše
          }
        },
      },
    }
  );
};

// Async verzija - sama dohvata cookieStore (za postojeći kod)
export async function createClientAsync() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

// Provjeri da li je Supabase konfigurisan
export function isSupabaseConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!supabaseKey &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
  );
}
