'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Result } from '@/domain/persistence';

let browserClient: SupabaseClient | null = null;
let accessTokenPromise: Promise<Result<string>> | null = null;

export function cloudConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function getBrowserSupabase(): SupabaseClient | null {
  if (!cloudConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
    );
  }
  return browserClient;
}

/** Reuse the guest session. Create an anonymous identity only when a cloud action needs one. */
async function startOrReuseGuestSession(): Promise<Result<string>> {
  const client = getBrowserSupabase();
  if (!client) return { ok: false, error: 'Cloud features are not configured.' };

  try {
    const { data: current, error: sessionError } = await client.auth.getSession();
    if (sessionError) return { ok: false, error: 'Could not read the cloud session.' };
    if (current.session?.access_token) return { ok: true, data: current.session.access_token };

    const { data, error } = await client.auth.signInAnonymously();
    if (error?.code === 'anonymous_provider_disabled') {
      return { ok: false, error: 'Guest sign-in is disabled in Supabase. Enable anonymous sign-ins in Authentication settings.' };
    }
    if (error?.status === 429) {
      return { ok: false, error: 'Too many guest sign-in attempts. Wait a moment, then retry.' };
    }
    if (error || !data.session?.access_token) {
      return { ok: false, error: 'Could not start a guest cloud session.' };
    }
    return { ok: true, data: data.session.access_token };
  } catch {
    return { ok: false, error: 'Cloud authentication is temporarily unavailable.' };
  }
}

export function getAccessToken(): Promise<Result<string>> {
  if (!accessTokenPromise) {
    accessTokenPromise = startOrReuseGuestSession().finally(() => { accessTokenPromise = null; });
  }
  return accessTokenPromise;
}
