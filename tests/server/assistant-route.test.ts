import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyBearerToken: vi.fn(),
  reserveAssistantQuota: vi.fn(),
  finalizeAssistantUsage: vi.fn(),
  generateAssistantResult: vi.fn(),
}));

vi.mock('@/lib/server/assistant-service', () => ({
  verifyBearerToken: mocks.verifyBearerToken,
  reserveAssistantQuota: mocks.reserveAssistantQuota,
  finalizeAssistantUsage: mocks.finalizeAssistantUsage,
}));
vi.mock('@/lib/server/assistant-model', () => ({
  AssistantProviderError: class AssistantProviderError extends Error {
    constructor(readonly code: string) { super(code); }
  },
  generateAssistantResult: mocks.generateAssistantResult,
}));

import { GET, POST } from '@/app/api/assistant/route';
import { AssistantProviderError } from '@/lib/server/assistant-model';

const recipe = {
  schemaVersion: 1 as const,
  activityId: 'projectile' as const,
  worldId: 'mars' as const,
  seed: 42,
  params: { objectId: 'sphere' as const, massKg: 1, speedMps: 10, angleDeg: 45, releaseHeightM: 1, dragEnabled: false },
};
const summary = {
  runId: 'f531d96f-03a4-47d3-8b42-3c98aaeea533',
  revision: 3,
  recipe,
  modelVersion: 'local-v1',
  elapsedS: 2.2,
  termination: 'contact' as const,
  metrics: { rangeM: 12.5, flightTimeS: 2.2 },
  assumptions: ['Uniform gravity.'],
};
const explanationRequest = {
  requestId: '5b5d27aa-074d-4e7c-849a-4d734e801a88',
  revision: 3,
  operation: 'explain' as const,
  input: 'Why did it travel this far?',
  recipe,
  summary,
};

function apiRequest(body: unknown, authorization = 'Bearer valid-token') {
  return new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function configureCloud() {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
}

describe('assistant route boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureCloud();
    mocks.verifyBearerToken.mockResolvedValue('owner-uuid');
    mocks.reserveAssistantQuota.mockResolvedValue({ status: 'reserved', reservationId: 'quota-row' });
    mocks.finalizeAssistantUsage.mockResolvedValue(true);
    mocks.generateAssistantResult.mockResolvedValue({
      result: { kind: 'explanation', text: 'The measured range changes with the local environment.', metricRefs: ['rangeM'] },
      inputTokens: 500,
      outputTokens: 25,
    });
  });

  it('reports missing cloud configuration without exposing credentials', async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false, reason: expect.any(String) });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects missing auth before quota reservation', async () => {
    const response = await POST(apiRequest(explanationRequest, ''));
    expect(response.status).toBe(401);
    expect(mocks.reserveAssistantQuota).not.toHaveBeenCalled();
    expect(mocks.generateAssistantResult).not.toHaveBeenCalled();
  });

  it('rejects a measured summary from another revision before making a provider call', async () => {
    const body = { ...explanationRequest, summary: { ...summary, revision: 2 } };
    const response = await POST(apiRequest(body));
    expect(response.status).toBe(400);
    expect(mocks.verifyBearerToken).not.toHaveBeenCalled();
    expect(mocks.reserveAssistantQuota).not.toHaveBeenCalled();
  });

  it('rejects a measured summary whose recipe differs from the request', async () => {
    const body = { ...explanationRequest, summary: { ...summary, recipe: { ...recipe, params: { ...recipe.params, speedMps: 9 } } } };
    const response = await POST(apiRequest(body));
    expect(response.status).toBe(400);
    expect(mocks.reserveAssistantQuota).not.toHaveBeenCalled();
  });

  it('rejects an oversized streamed body before parsing or reserving quota', async () => {
    const body = JSON.stringify({ ...explanationRequest, padding: 'x'.repeat(33 * 1024) });
    const response = await POST(new Request('http://localhost/api/assistant', {
      method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' }, body,
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Request is too large.' });
    expect(mocks.reserveAssistantQuota).not.toHaveBeenCalled();
  });

  it('rejects a mismatched Earth reference before reserving quota', async () => {
    const referenceSummary = {
      ...summary,
      recipe: { ...recipe, worldId: 'earth' as const, params: { ...recipe.params, speedMps: 20 } },
    };
    const response = await POST(apiRequest({ ...explanationRequest, referenceSummary }));
    expect(response.status).toBe(400);
    expect(mocks.reserveAssistantQuota).not.toHaveBeenCalled();
  });

  it('reserves quota, validates provider output, and returns the request revision', async () => {
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ requestId: explanationRequest.requestId, basedOnRevision: 3, result: { kind: 'explanation' } });
    expect(mocks.reserveAssistantQuota).toHaveBeenCalledWith('owner-uuid', expect.objectContaining({ requestId: explanationRequest.requestId }));
    expect(mocks.finalizeAssistantUsage).toHaveBeenCalledWith('owner-uuid', explanationRequest.requestId, {
      status: 'completed', inputTokens: 500, outputTokens: 25,
    });
  });

  it('allows setup-only explanations without measurements and requires empty metric references', async () => {
    mocks.generateAssistantResult.mockResolvedValue({
      result: { kind: 'explanation', text: 'This setup describes a projectile launch. No measurement is available yet.', metricRefs: [] },
      inputTokens: 300,
      outputTokens: 30,
    });
    const setupRequest = { ...explanationRequest };
    Reflect.deleteProperty(setupRequest, 'summary');
    const response = await POST(apiRequest(setupRequest));
    expect(response.status).toBe(200);
    expect((await response.json()).result).toMatchObject({ kind: 'explanation', metricRefs: [] });
  });

  it('rejects metric references absent from the supplied measurements', async () => {
    mocks.generateAssistantResult.mockResolvedValue({
      result: { kind: 'explanation', text: 'The measured period was short.', metricRefs: ['periodS'] },
      inputTokens: 500,
      outputTokens: 25,
    });
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(503);
    expect(mocks.finalizeAssistantUsage).toHaveBeenCalledWith('owner-uuid', explanationRequest.requestId, {
      status: 'failed', inputTokens: null, outputTokens: null,
    });
  });

  it('keeps numeric values in trusted metric references, not explanation prose', async () => {
    mocks.generateAssistantResult.mockResolvedValue({
      result: { kind: 'explanation', text: 'The range was 12.5 meters.', metricRefs: ['rangeM'] },
      inputTokens: 500,
      outputTokens: 25,
    });
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(503);
  });

  it('rejects numeric prose from explain clarification and unsupported responses', async () => {
    mocks.generateAssistantResult.mockResolvedValue({
      result: { kind: 'unsupported', text: 'This lab does not model speeds above 30 m/s.' },
      inputTokens: 500,
      outputTokens: 25,
    });
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(503);
  });

  it('does not call the model when a request id was already reserved', async () => {
    mocks.reserveAssistantQuota.mockResolvedValue({ status: 'duplicate' });
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(409);
    expect(mocks.generateAssistantResult).not.toHaveBeenCalled();
  });

  it('returns quota exhaustion before calling the model', async () => {
    mocks.reserveAssistantQuota.mockResolvedValue({ status: 'quota_exceeded' });
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(429);
    expect(mocks.generateAssistantResult).not.toHaveBeenCalled();
  });

  it('finalizes failed usage and returns a safe timeout error', async () => {
    const timeout = new AssistantProviderError('timeout');
    mocks.generateAssistantResult.mockRejectedValue(timeout);
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: 'Assistant request timed out.' });
    expect(mocks.finalizeAssistantUsage).toHaveBeenCalledWith('owner-uuid', explanationRequest.requestId, {
      status: 'failed', inputTokens: null, outputTokens: null,
    });
  });

  it('cannot return a command from an explain operation', async () => {
    mocks.generateAssistantResult.mockResolvedValue({
      result: { kind: 'command', command: { type: 'control', action: 'run' } },
      inputTokens: 500,
      outputTokens: 10,
    });
    const response = await POST(apiRequest(explanationRequest));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Assistant is temporarily unavailable.' });
    expect(mocks.finalizeAssistantUsage).toHaveBeenCalledWith('owner-uuid', explanationRequest.requestId, {
      status: 'failed', inputTokens: null, outputTokens: null,
    });
  });
});
