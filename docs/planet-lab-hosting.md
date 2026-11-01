# Planet Lab — Supabase, Vercel, operations

Plan only. No resources provisioned. No credentials inspected. No subscription or free-tier allowance assumed.

## Service map

| Service | Responsibility |
| --- | --- |
| Vercel | Next.js pages, static assets, bounded HTTP API routes, preview/production deployments |
| Browser | 3D rendering, physics, local draft, direct authenticated Supabase requests |
| Supabase Auth | Lazy anonymous identity for Save and AI |
| Supabase Postgres | Saved recipes, durable quota reservations, API usage |
| Supabase Storage | P1 private screenshots; no uploads required for first core demo |
| OpenAI | Validated commands and explanations; voice/images later |

Start with one app deployment and one Supabase project. Use separate preview/production projects before wider release.
Never point untrusted fork previews at production secrets or database.
If one database serves event previews, treat it as disposable demo data and prohibit destructive migrations after sharing.

## Environment contract

| Name | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Public client identity; RLS still required |
| `SUPABASE_SECRET_KEY` | Server only | Narrow privileged quota/share operations |
| `OPENAI_API_KEY` | Server only | Runtime API calls |
| `OPENAI_MODEL` | Server only | Default `gpt-6-luna` |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical deployment URL when needed |

Use new Supabase publishable/secret key formats. Do not start from legacy anon/service_role examples.
Secret key bypasses RLS. Isolate client in a `server-only` module; validate authorization before every privileged action.
`.env.example` contains names and safe placeholders only. `.env.local` stays ignored.
No cloud keys: local simulation still boots; cloud save/AI show unavailable.

## Auth

- Start local lab without network or authentication.
- Save/AI first checks existing Supabase session. Create anonymous session only if absent.
- Enable anonymous sign-in deliberately. Supabase anonymous users use the authenticated Postgres role.
- Use CAPTCHA/Turnstile and rate controls for public anonymous enrollment.
- Event Wi-Fi shares IPs; test sign-in limits before demo. Reuse session instead of creating on every reload.
- Clear storage loses guest access. Show this beside saved experiments.
- Server verifies JWT through Supabase Auth. Never trust decoded claims without verification.
- User-specific API responses use `Cache-Control: no-store`.
- P1 permanent account linking only after core works.

## Launch tables

### `experiments`

Fields: id UUID PK, owner_id UUID FK auth.users, title text, schema_version int, recipe JSONB, created_at, updated_at.
Checks: title 1–80 chars; schema_version = 1; bounded JSON payload. Index owner_id and updated_at.
RLS: authenticated owner selects/inserts/updates/deletes own rows.
INSERT/UPDATE `WITH CHECK` enforces owner_id = auth.uid(); UPDATE also checks old-row ownership.
No public SELECT. No user-selectable ownership transfer.
Browser validates full recipe; database constraints enforce basic bounds/version. Revalidate on every load.

### `ai_usage`

Fields: id/request_id UUID, owner_id, operation, status, reserved input/output budget, actual tokens, estimated USD, created_at, completed_at.
Unique request_id per owner. Index owner_id/created_at and created_at.
User has no direct write access. Backend owns inserts/finalization.
Do not store raw audio, API keys, or full prompts by default.

### Quota reservation

Use transactional Postgres function; executable only by trusted backend role.
Verify user first. Atomically reserve slot and bounded token allowance before OpenAI call.
Proposed launch limits: 30 AI requests/user/hour; 2,000 project requests/day; fixed per-request token bounds.
Counts include pending reservations. Concurrent calls cannot oversubscribe budget.
Same owner/request_id returns existing status; do not call provider twice.
Crash/timeout keeps conservative reservation. Finalize actual usage when known; no blind automatic retry.
Expose friendly quota error. If quota store fails, AI fails closed while local simulation remains available.
Tune limits after actual credit and rate-limit checks. These numbers are application policy, not provider entitlements.

## P1 shares

Table `share_links`: id, owner_id, token_hash unique, recipe_snapshot JSONB, expires_at, revoked_at, created_at.
Snapshot excludes private notes, prompts, identity, and unrelated saved experiments.
Generate 32 random bytes server-side; base64url token. Store SHA-256 hash only. Default expiry: seven days.
Owner policies allow own link management. No anonymous table listing or broad recipe SELECT.
Authenticated `POST /api/shares` validates snapshot and creates link. Return raw token once.
Public `GET /api/shares/[token]` hashes token, checks expiry/revocation, returns only validated snapshot.
Secret client used only for this narrow lookup. Missing/expired/revoked returns same 404.
Share page: noindex, no-store, no-referrer; no private screenshot access through share token.

## P1 Storage

- Private `screenshots` bucket. Path `<user-id>/<experiment-id>/<random-id>.webp`.
- MIME allowlist and size limit; verify uploaded type. Start with maximum 2 MB.
- Storage RLS restricts insert/read/delete to owner path and correct bucket.
- Signed read URLs expire. Never put screenshot bucket into public mode to fix policy bugs.
- Upload directly using authenticated Storage client. Avoid proxying binary uploads through app API.
- Static curated assets live in repository/CDN; never user-writable through app.

## Vercel setup

1. Import this GitHub repository. Root directory: repository root containing future package.json.
2. Select Next.js framework; use compatible supported Node LTS; install through committed pnpm lockfile.
3. Set env separately for Development, Preview, Production. Redeploy after build-time public env changes.
4. Deploy preview before full feature integration. Verify `.wasm`, GLB, and texture loading over HTTPS.
5. Keep 3D client-only. Use `dynamic(..., { ssr: false })` inside a Client Component.
6. Run OpenAI/auth/quota routes in Node runtime. Bound duration to app timeout and selected Vercel plan.
7. Keep API bodies small. Current Functions payload limit is 4.5 MB; screenshots upload directly to Storage.
8. Serve versioned assets with appropriate cache headers. User/API/share data stays no-store.
9. Configure production domain and public access. Confirm judges can open URL without deployment-protection login.
10. Set spending alerts; inspect error and function logs. Never log secrets or full bearer headers.

No server WebSocket needed for launch. Browser can later connect directly to OpenAI voice through its supported connection flow.
Do not repeat obsolete guidance that Vercel categorically cannot host WebSockets; support changed during 2026.
Specialist physics jobs need a separate solver service when that roadmap ships. Do not squeeze CFD into request handlers.

## Cost model

Separate: OpenAI usage, Vercel usage, Supabase database/storage/egress, asset costs, later solver compute.
Existing research contains API arithmetic. Check real account balance and platform quotas before launch.
No paid plan or automatic recharge activated without user's instruction.
Keep simulation local to avoid server GPU fees. Cache/reuse static/generated assets.

## Release checks

- Owner A can save/reload/delete. Owner B cannot read/update/delete A's experiment through direct API calls.
- Unauthenticated client cannot write data or list private recipes.
- Browser bundle contains no OpenAI/Supabase secret key.
- Quota reservation handles concurrent requests and duplicate request_id.
- Preview keys reach intended database only. Preview cannot migrate production.
- Public URL loads from a clean browser; assets use working URLs and correct MIME types.
- Provider outage does not break physics or draft recovery.
- Production rollout records commit, migration version, model setting, asset/model versions, and known limits.
- Rollback: previous Vercel deployment plus additive compatible migrations. Never drop data to roll back UI.

## Official references — checked November 1, 2026

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Anonymous sign-in and abuse controls](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Postgres RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Vercel deployment environments](https://vercel.com/docs/deployments/environments)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel WebSocket availability update](https://vercel.com/changelog/websocket-support-is-now-generally-available)
- [Next.js lazy/client-only loading](https://nextjs.org/docs/app/guides/lazy-loading)
