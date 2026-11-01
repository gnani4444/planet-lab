import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS, DEFAULT_RECIPE, assistantRequestSchema, experimentRecipeSchema, labCommandSchema, type RunSummary } from '@/domain';
import { DRAFT_KEY, persistDraft, restoreDraft, useLabStore } from '@/state/lab-store';
const state = () => useLabStore.getState();
function summary(worldId = state().recipe.worldId): RunSummary {return {runId: crypto.randomUUID(), revision: state().revision, recipe: {...state().recipe, worldId}, modelVersion: 'test', elapsedS: 1, termination: 'contact', metrics: {rangeM: 5}, assumptions: []};}
beforeEach(() => {state().configure(DEFAULT_RECIPE); state().setComparison(false);});
describe('bounded experiment contract', () => {
  it('accepts every default recipe and rejects unknown fields', () => {
    for(const [activityId,params] of Object.entries(DEFAULT_PARAMS)) expect(experimentRecipeSchema.safeParse({...DEFAULT_RECIPE, activityId, params}).success).toBe(true);
    expect(experimentRecipeSchema.safeParse({...DEFAULT_RECIPE, injection: 'ignored'}).success).toBe(false);
    expect(experimentRecipeSchema.safeParse({...DEFAULT_RECIPE, params: {...DEFAULT_RECIPE.params, launchSpeedMps: Infinity}}).success).toBe(false);
    expect(experimentRecipeSchema.safeParse({...DEFAULT_RECIPE, params: {...DEFAULT_RECIPE.params, launchSpeedMps: 21}}).success).toBe(false);
  });
  it('rejects arbitrary commands and oversized assistant input', () => {
    expect(labCommandSchema.safeParse({type: 'execute', code: 'alert(1)'}).success).toBe(false);
    expect(assistantRequestSchema.safeParse({requestId: crypto.randomUUID(), revision: 0, operation: 'command', input: 'x'.repeat(501), recipe: DEFAULT_RECIPE}).success).toBe(false);
  });
});
describe('revision and comparison lifecycle', () => {
  it('clears stale telemetry when settings change and rejects late completion', () => {
    state().run(); const old = summary(); state().acceptSummary(old); expect(state().status).toBe('completed');
    state().updateParam('launchSpeedMps', 9); state().acceptSummary(old);
    expect(state().summaries).toEqual({}); expect(state().status).toBe('ready');
  });
  it('resumes the same run after pause and resets with a new revision', () => {
    state().run(); const revision = state().revision; state().pause(); state().run(); expect(state().revision).toBe(revision);
    state().reset(); expect(state().revision).toBe(revision + 1); expect(state().status).toBe('ready');
  });
  it('completes comparison only after both matching worlds finish', () => {
    state().setComparison(true); state().run(); const mars = summary(); state().acceptSummary(mars); expect(state().status).toBe('running');
    const wrong = summary('earth'); wrong.recipe = {...DEFAULT_RECIPE, activityId: 'rover-ramp', worldId: 'earth', params: {...DEFAULT_PARAMS['rover-ramp'], launchSpeedMps: 14}};
    state().acceptSummary(wrong); expect(state().summaries.earth).toBeUndefined();
    state().acceptSummary(summary('earth')); expect(state().status).toBe('completed');
  });
  it('accepts equivalent recipes with different JSON key order', () => {
    state().run(); const result = summary();
    result.recipe = {activityId: 'rover-ramp', params: DEFAULT_PARAMS['rover-ramp'], seed: 42, worldId: 'mars', schemaVersion: 1};
    state().acceptSummary(result); expect(state().status).toBe('completed');
  });
  it('rejects late telemetry and bounds retained samples', () => {
    state().run(); const revision = state().revision;
    const sample = {timeS: 1, positionM: [0,1,0] as const, velocityMps: [0,0,0] as const, dragN: null, angleRad: null};
    state().acceptSample(sample, 'mars', revision - 1); expect(state().samples.mars).toBeUndefined();
    for(let i=0;i<650;i++) state().acceptSample({...sample, timeS: i/10}, 'mars', revision);
    expect(state().samples.mars).toHaveLength(600);
  });
  it('invalid input preserves the last valid settings', () => {
    const previous = state().recipe; expect(state().updateParam('launchSpeedMps', -100)).toBe(false); expect(state().recipe).toEqual(previous);
  });
  it('Earth cannot silently compare with itself', () => {
    state().selectWorld('earth'); state().setComparison(true); expect(state().comparison).toBe(false); expect(state().error).toContain('Choose Moon or Mars');
  });
});

afterEach(() => {vi.unstubAllGlobals(); vi.useRealTimers();});
describe('dispatcher and local recovery', () => {
  it('routes valid commands and prevents unknown-command side effects', () => {
    const revision = state().revision;
    expect(state().dispatch({type: 'execute', code: 'change()'})).toBe(false);
    expect(state().revision).toBe(revision);
    expect(state().dispatch({type: 'configure', recipe: {...DEFAULT_RECIPE, worldId: 'moon'}, run: true})).toBe(true);
    expect(state().recipe.worldId).toBe('moon'); expect(state().status).toBe('running');
    state().setStatus('ready', state().revision); expect(state().status).toBe('running');
    state().dispatch({type: 'control', action: 'pause'}); expect(state().status).toBe('paused');
  });
  it('backs up corrupt draft data and reset writes a recoverable recipe', () => {
    vi.useFakeTimers(); const entries = new Map([[DRAFT_KEY, '{broken json']]);
    vi.stubGlobal('localStorage', {getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key,value)});
    expect(restoreDraft()).toBe('invalid'); expect(entries.get(`${DRAFT_KEY}.invalid`)).toBe('{broken json');
    const stop = persistDraft(); state().reset(); vi.advanceTimersByTime(201); stop();
    expect(experimentRecipeSchema.safeParse(JSON.parse(entries.get(DRAFT_KEY)!)).success).toBe(true);
    expect(entries.get(`${DRAFT_KEY}.invalid`)).toBe('{broken json');
  });
  it('restores a validated recipe and rejects incompatible versions', () => {
    const entries = new Map([[DRAFT_KEY, JSON.stringify({...DEFAULT_RECIPE, worldId: 'moon'})]]);
    vi.stubGlobal('localStorage', {getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key,value)});
    expect(restoreDraft()).toBe('restored'); expect(state().recipe.worldId).toBe('moon');
    entries.set(DRAFT_KEY, JSON.stringify({...DEFAULT_RECIPE, schemaVersion: 99}));
    expect(restoreDraft()).toBe('invalid'); expect(state().recipe.worldId).toBe('moon');
  });
});
