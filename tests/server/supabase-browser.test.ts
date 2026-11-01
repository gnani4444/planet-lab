import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient }));

describe('lazy browser Supabase auth', () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  });

  it('shares one in-flight anonymous sign-in across concurrent cloud actions', async () => {
    let finishSignIn!: (value: { data: { session: { access_token: string } }; error: null }) => void;
    const signInAnonymously = vi.fn(() => new Promise((resolve) => { finishSignIn = resolve; }));
    const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    createClient.mockReturnValue({ auth: { getSession, signInAnonymously } });
    const { getAccessToken } = await import('@/lib/supabase/browser');

    const first = getAccessToken();
    const second = getAccessToken();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    finishSignIn({ data: { session: { access_token: 'guest-token' } }, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, data: 'guest-token' },
      { ok: true, data: 'guest-token' },
    ]);
  });

  it('reuses an existing session and stays unavailable when cloud config is absent', async () => {
    const signInAnonymously = vi.fn();
    createClient.mockReturnValue({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'existing' } }, error: null }), signInAnonymously } });
    const { getAccessToken, cloudConfigured } = await import('@/lib/supabase/browser');
    await expect(getAccessToken()).resolves.toEqual({ ok: true, data: 'existing' });
    expect(signInAnonymously).not.toHaveBeenCalled();

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(cloudConfigured()).toBe(false);
    await expect(getAccessToken()).resolves.toMatchObject({ ok: false });
  });
});

it('reports the disabled guest provider with a concrete setup action', async () => {
 vi.resetModules();
 process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
 createClient.mockReturnValue({ auth: { getSession: vi.fn().mockResolvedValue({data:{session:null},error:null}), signInAnonymously: vi.fn().mockResolvedValue({data:{session:null},error:{code:'anonymous_provider_disabled',status:422}}) } });
 const {getAccessToken}=await import('@/lib/supabase/browser');
 await expect(getAccessToken()).resolves.toEqual({ok:false,error:expect.stringContaining('Enable anonymous sign-ins')});
});
