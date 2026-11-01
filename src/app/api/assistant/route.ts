import { NextResponse } from 'next/server';
import { assistantRequestSchema, assistantResponseSchema, type AssistantResult } from '@/domain/assistant';
import { AssistantProviderError, generateAssistantResult } from '@/lib/server/assistant-model';
import { finalizeAssistantUsage, reserveAssistantQuota, verifyBearerToken } from '@/lib/server/assistant-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32 * 1024;

function availability() {
  if (!process.env.OPENAI_API_KEY) return { available: false, reason: 'Assistant is unavailable: OpenAI is not configured.' };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY) {
    return { available: false, reason: 'Assistant is unavailable: cloud authentication and quota storage are not configured.' };
  }
  return { available: true as const };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameRecipe(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

function sameExceptWorld(current: Record<string, unknown>, reference: Record<string, unknown>): boolean {
  const currentRecipe = Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'worldId'));
  const referenceRecipe = Object.fromEntries(Object.entries(reference).filter(([key]) => key !== 'worldId'));
  return canonical(currentRecipe) === canonical(referenceRecipe);
}

function validateSummaryBinding(request: ReturnType<typeof assistantRequestSchema.parse>): boolean {
  if (request.summary && (request.summary.revision !== request.revision || !sameRecipe(request.summary.recipe, request.recipe))) return false;
  if (request.referenceSummary) {
    if (request.referenceSummary.revision !== request.revision || request.referenceSummary.recipe.worldId !== 'earth') return false;
    if (!sameExceptWorld(request.recipe as unknown as Record<string, unknown>, request.referenceSummary.recipe as unknown as Record<string, unknown>)) return false;
  }
  return true;
}

function explainOutputIsGrounded(request: ReturnType<typeof assistantRequestSchema.parse>, result: AssistantResult): boolean {
  if (request.operation !== 'explain') return true;
  if (result.kind === 'command') return false;
  if ('text' in result && /\d/.test(result.text)) return false;
  if (result.kind !== 'explanation') return true;
  const measured = new Set(Object.keys(request.summary?.metrics ?? {}));
  return result.metricRefs.every((metricId) => measured.has(metricId));
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export async function GET() {
  return json(availability());
}

export async function POST(request: Request) {
  const available = availability();
  if (!available.available) return json({ error: available.reason }, 503);

  const authorization = request.headers.get('authorization');
  const bearer = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!bearer) return json({ error: 'A valid cloud session is required.' }, 401);

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'Request is too large.' }, 400);
  if (request.headers.get('content-type')?.toLowerCase().split(';')[0] !== 'application/json') {
    return json({ error: 'Request must use JSON.' }, 400);
  }

  const bodyText = await readBoundedBody(request);
  if (bodyText === null) return json({ error: 'Request is too large.' }, 400);

  let input: unknown;
  try { input = JSON.parse(bodyText); }
  catch { return json({ error: 'Request JSON is invalid.' }, 400); }
  const parsedRequest = assistantRequestSchema.safeParse(input);
  if (!parsedRequest.success || !validateSummaryBinding(parsedRequest.data)) {
    return json({ error: 'Request is invalid or the measured summary does not match this experiment.' }, 400);
  }

  let ownerId: string | null;
  try { ownerId = await verifyBearerToken(bearer); }
  catch { return json({ error: 'Cloud authentication is unavailable.' }, 503); }
  if (!ownerId) return json({ error: 'Cloud session is invalid.' }, 401);

  let reservation;
  try { reservation = await reserveAssistantQuota(ownerId, parsedRequest.data); }
  catch { return json({ error: 'Assistant quota is unavailable.' }, 503); }
  if (!reservation) return json({ error: 'Assistant quota is unavailable.' }, 503);
  if (reservation.status === 'duplicate') return json({ error: 'This request is already in progress or was already handled.' }, 409);
  if (reservation.status === 'quota_exceeded') return json({ error: 'Assistant usage limit reached. Try again later.' }, 429);

  try {
    const generated = await generateAssistantResult(parsedRequest.data);
    if (!explainOutputIsGrounded(parsedRequest.data, generated.result)) throw new AssistantProviderError('invalid_output');
    const finalized = await finalizeAssistantUsage(ownerId, parsedRequest.data.requestId, {
      status: 'completed', inputTokens: generated.inputTokens, outputTokens: generated.outputTokens,
    });
    if (!finalized) return json({ error: 'Assistant usage could not be recorded.' }, 503);
    const response = assistantResponseSchema.parse({
      requestId: parsedRequest.data.requestId,
      basedOnRevision: parsedRequest.data.revision,
      result: generated.result,
    });
    return json(response);
  } catch (error) {
    const typed = error instanceof AssistantProviderError ? error : null;
    const status = typed?.code === 'timeout' ? 504 : typed?.code === 'input_too_large' ? 400 : 503;
    const finalized = await finalizeAssistantUsage(ownerId, parsedRequest.data.requestId, {
      status: typed?.code === 'input_too_large' ? 'rejected' : 'failed', inputTokens: null, outputTokens: null,
    }).catch(() => false);
    if (!finalized) return json({ error: 'Assistant usage could not be recorded.' }, 503);
    const message = typed?.code === 'timeout'
      ? 'Assistant request timed out.'
      : typed?.code === 'input_too_large'
        ? 'Request exceeds the assistant input budget.'
        : 'Assistant is temporarily unavailable.';
    return json({ error: message }, status);
  }
}
