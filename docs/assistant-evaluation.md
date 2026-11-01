# Assistant evaluation — November 1, 2026

Real OpenAI Responses calls using GPT-6 Luna, through the public server route with no login or Supabase identity. The final catalog covers 22 chat cases plus two separate database checks. All final case IDs passed, including the selected bounce replacement. Raw outputs and token counts are in [assistant-results.json](evals/assistant-results.json).

The first pass caught an incorrect Mars free-fall comparison during manual scientific review. The prompt now supplies computed measurement relationships and explicitly checks the longer fall time under weaker gravity. The corrected answer passed. The model also changed a requested restitution of 0.9 to a nearby decimal despite passing the type schema; that candidate was rejected from the UI. The selected zero-restitution experiment passed. Rejected evidence is preserved in [initial results](evals/assistant-initial-results.json) and [rejected candidates](evals/rejected-candidates.json).

Selected UI questions cover explanations before and after runs, Earth comparison, launch angle and drag, pendulum period, airflow and shape, gravity and bounce energy. Six activity-specific setup buttons were tested for actual recipe and run flags. Follow-up history, unsupported requests and an instruction to invent a distance were exercised. The server rejects explanation digits and unavailable metric references; numbers displayed in chat come from the supplied snapshot. These guards do not guarantee every scientific sentence or command matches intent, which is why proposals remain reviewable.

Evaluation measurement fixtures come from the deterministic physics reference, not browser Rapier. A separate real browser journey ran Mars/Earth, obtained a genuine OpenAI explanation and verified displayed metrics against the completed runs; its capture is in the README.

Run `pnpm test:ai` to reproduce all live cases. It bills real OpenAI requests, uses optional Supabase configuration for persistence checks, and preserves the latest result per case ID. Normal unit/browser tests use mocked assistant responses.
