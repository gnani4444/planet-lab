# Planet Lab backend setup

The local lab works without cloud credentials. Cloud saves and the assistant stay unavailable until Supabase and OpenAI are configured. This repo has no linked Supabase or Vercel project, and no live credentials have been checked or provisioned.

## Supabase

1. Create or select a disposable development Supabase project. Enable anonymous sign-in in Authentication, and set the anonymous-user abuse controls/CAPTCHA before opening the app publicly.
2. Apply both SQL files in `supabase/migrations/` in filename order: `202611010001_planet_lab_core.sql`, then `202611010002_recipe_validation_permissions.sql`. These create owner-scoped `experiments`, private `ai_usage`, RLS policies, and privileged quota reservation/finalization functions.
3. Add the project's URL, publishable key, and secret key to the local environment using `.env.example` as the name list. The publishable key is browser-safe because table access is restricted by RLS. Keep `SUPABASE_SECRET_KEY` server-only.
4. Restart the Next.js server after changing environment values. The app creates an anonymous session only when the user first saves or asks the assistant; it reuses the browser session after that.

Saved recipes are written from the browser as the signed-in owner. Database policies enforce owner identity for select, insert, update, and delete. Recipes are validated again when read. A lost browser session cannot recover its anonymous owner's saves.

## OpenAI assistant

Set `OPENAI_API_KEY` on the server and optionally set `OPENAI_MODEL` (defaults to `gpt-6-luna`). Never use a `NEXT_PUBLIC_` variable for the OpenAI key. `GET /api/assistant` reports whether all required server services are configured; it never returns credential values.

`POST /api/assistant` accepts a validated JSON request and a Supabase bearer token. Explain requests may be setup-only; when a measured summary is supplied, its recipe and revision must match the request. An Earth reference must have Earth as its world and match the current recipe's activity, parameters, and seed. Explain responses cannot contain commands. Numeric explanations can cite only metric IDs present in the supplied summary. Without a summary, the assistant must say that no measurement is available and return no metric references. The prompt forbids numeric cross-world claims without an Earth reference.

The route reserves durable quota before calling OpenAI. The database limits each owner to 30 requests per hour and the project to 2,000 requests per UTC day. A request ID can reserve only once, so retries return conflict rather than call the model twice. Reservations remain conservative if the function crashes before finalization. The current implementation records actual input/output tokens when returned; `estimated_usd` stays empty until model pricing is deliberately configured. Input is capped at 8,000 tokens, output at 800 tokens, and the provider operation has a 15-second timeout.

The assistant uses Responses Structured Outputs with a schema generated from the shared Zod result schema. It returns a proposed command; the browser validates it against the current revision and dispatches supported commands through the same controls as the UI. It does not run simulation physics or execute model-generated code.

## External release checks

Before claiming cloud or AI availability, configure a non-production Supabase project and OpenAI key, apply both migrations, verify anonymous sign-in, and test save/reload/delete under two separate users. Exercise quota concurrency and duplicate request IDs against Postgres. Verify a real Responses call, token recording, timeout behavior, and the deployed environment's secrets. A read-only Supabase connection check passed on 2026-11-01, but the expected tables and RPCs were absent from its API schema and anonymous sign-in was disabled. Provider calls, live database behavior and deployment remain unverified.

Official references: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Responses input-token counts](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count), [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Database permission regression

The second migration grants authenticated writers and the backend role permission to execute the pure recipe validators used by CHECK constraints. It changes no ownership policy or privileged quota permission. Apply it even if the first migration was applied earlier.

`supabase/tests/recipe_permissions.sql` verifies a valid owner save, invalid recipe rejection, owner isolation and denial of direct quota reservation by authenticated users. Run it only in a disposable test database after both migrations; its transaction rolls back all fixtures. These checks were executed with PGlite 0.5.14 and a local Supabase Auth schema stub. Live Supabase Auth and concurrent server sessions remain separate checks.
