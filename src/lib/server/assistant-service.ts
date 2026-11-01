import 'server-only';

import type { AssistantRequest } from '@/domain/assistant';
import { createAuthVerifier, createQuotaClient } from '@/lib/server/supabase-admin';

export type QuotaReservation = { status: 'reserved' | 'duplicate' | 'quota_exceeded'; reservationId?: string };
export type UsageFinalization = { status: 'completed' | 'failed' | 'rejected'; inputTokens: number | null; outputTokens: number | null };

export async function verifyBearerToken(token: string): Promise<string | null> {
  const verifier = createAuthVerifier();
  if (!verifier) return null;
  const { data, error } = await verifier.auth.getUser(token);
  if (error) {
    const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
    if (status === 401 || status === 403) return null;
    throw new Error('Supabase Auth could not verify the session.');
  }
  return data.user?.id ?? null;
}

export async function reserveAssistantQuota(ownerId: string, request: AssistantRequest): Promise<QuotaReservation | null> {
  const client = createQuotaClient();
  if (!client) return null;
  const { data, error } = await client.rpc('reserve_ai_usage', {
    p_owner_id: ownerId,
    p_request_id: request.requestId,
    p_operation: request.operation,
    p_reserved_input_tokens: 8000,
    p_reserved_output_tokens: 800,
  });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const value = row as { status?: unknown; reservation_id?: unknown };
  if (value.status === 'reserved' && typeof value.reservation_id === 'string') {
    return { status: 'reserved', reservationId: value.reservation_id };
  }
  if (value.status === 'duplicate') return { status: 'duplicate' };
  if (value.status === 'quota_exceeded') return { status: 'quota_exceeded' };
  return null;
}

export async function finalizeAssistantUsage(
  ownerId: string,
  requestId: string,
  finalization: UsageFinalization,
): Promise<boolean> {
  const client = createQuotaClient();
  if (!client) return false;
  const { data, error } = await client.rpc('finalize_ai_usage', {
    p_owner_id: ownerId,
    p_request_id: requestId,
    p_status: finalization.status,
    p_actual_input_tokens: finalization.inputTokens,
    p_actual_output_tokens: finalization.outputTokens,
  });
  return !error && data === true;
}
