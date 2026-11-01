# Planet Lab backend setup

Ask uses a server-side OpenAI key directly. It requires no account, guest sign-in, bearer token or Supabase connection. Cloud saves are a separate optional feature. Production is [planet-lab-drab.vercel.app](https://planet-lab-drab.vercel.app).

## OpenAI

Set `OPENAI_API_KEY` in `.env.local` and in Vercel's server environment. Optionally set `OPENAI_MODEL`; the default is `gpt-6-luna`. Never use a `NEXT_PUBLIC_` variable for the OpenAI key. Restart the server after environment changes.

`GET /api/assistant` reports key configuration without revealing its value. `POST /api/assistant` accepts a strict JSON request with no authorization header. It validates the recipe, revision, optional measurements and up to six user/assistant history messages. History is intent context, never authoritative telemetry.

The server uses Responses Structured Outputs and counts input tokens before generation. Limits are 32 KiB per HTTP request, 500 characters per question, 8,000 input tokens, 800 output tokens and a 15-second provider deadline. Responses include actual input/output token counts. Provider storage is disabled with `store: false`.

A measured summary must match the current recipe and revision. An Earth reference must match activity, inputs and seed, with Earth as its world. Explanation responses cannot execute commands. Numeric readouts are rendered from referenced measurement fields; prose with digits or absent metric references is rejected. Cross-world relationships are derived from supplied summaries and included in the model context. Scientific prose still needs evaluation.

Commands are proposals: the interface displays their target world, activity and parameters, and requires **Apply setup**. They enter the same validated store dispatch as manual controls. No generated code runs.

## Optional cloud saves

1. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SECRET_KEY` using `.env.example`.
2. Apply `202611010001_planet_lab_core.sql`, `202611010002_recipe_validation_permissions.sql`, then `202611010003_expanded_catalog.sql` from `supabase/migrations/`.
3. Enable **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
4. Restart the app. Only a save/list cloud action starts or reuses the browser's guest session. There is no sign-in form.

`experiments` stores owner-scoped recipes. Row-level policies enforce owner identity for select, insert, update and delete. Recipe CHECK constraints validate bounds and exact parameter shapes. Losing the browser's anonymous session loses access to that owner's saves.

The migration also contains private `ai_usage` and privileged quota reservation/finalization functions from the earlier authenticated assistant design. Their permissions and concurrency are tested. **The current public Ask route does not require or invoke these functions.** The former owner/hour and project/day quotas do not govern current chat requests.

## Verified November 1, 2026

The equivalent combined setup for all three migrations was applied transactionally to the configured live project. Both tables report row-level security enabled. Anonymous sign-in was enabled with user approval and verified through Supabase Auth. Live tests passed owner save/load, other-owner read isolation, forged-owner rejection, public read denial, private usage-ledger denial, concurrent quota deduplication and denial of guest access to privileged quota functions.

Ask is separately tested through the public server route with real OpenAI requests. Browser regression coverage deliberately keeps Supabase Auth unavailable while checking that chat still works. See [assistant evaluations](assistant-evaluation.md) for the exact prompts and recorded responses.

Official references: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [conversation state](https://developers.openai.com/api/docs/guides/conversation-state), [Supabase anonymous identities](https://supabase.com/docs/guides/auth/auth-anonymous), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
