'use client';
import { create } from 'zustand';
import { DEFAULT_PARAMS, DEFAULT_RECIPE, experimentRecipeSchema, labCommandSchema, runSummarySchema, type ActivityId, type ExperimentRecipe, type LabCommand, type RunStatus, type RunSummary, type TelemetrySample, type WorldId } from '@/domain';
export type TransportAction = 'run' | 'pause' | 'reset' | 'step';
export type LabState = {
  recipe: ExperimentRecipe; revision: number; status: RunStatus; comparison: boolean;
  samples: Partial<Record<WorldId, TelemetrySample[]>>; summaries: Partial<Record<WorldId, RunSummary>>;
  error: string | null; transport: {action: TransportAction; sequence: number};
  configure: (recipe: unknown) => boolean; selectWorld: (world: WorldId) => void; selectActivity: (activity: ActivityId) => void;
  updateParam: (key: string, value: unknown) => boolean;
  run: () => void; pause: () => void; reset: () => void; step: () => void; setComparison: (value: boolean) => void;
  acceptSample: (sample: TelemetrySample, world: WorldId, revision: number) => void;
  acceptSummary: (summary: RunSummary) => void; setStatus: (status: RunStatus, revision: number) => void;
  setError: (error: string | null) => void; dispatch: (command: unknown) => boolean;
};
const cleared = {samples: {}, summaries: {}, error: null};
export const useLabStore = create<LabState>((set, get) => ({
  recipe: DEFAULT_RECIPE, revision: 0, status: 'ready', comparison: false, ...cleared, transport: {action: 'reset', sequence: 0},
  configure(input) {
    const parsed = experimentRecipeSchema.safeParse(input);
    if (!parsed.success) {set({error: 'Invalid experiment settings. Keep values within the displayed limits.'}); return false;}
    set(s => ({recipe: parsed.data, revision: s.revision + 1, status: 'ready', ...cleared, comparison: parsed.data.worldId === 'earth' ? false : s.comparison, transport: {action: 'reset', sequence: s.transport.sequence + 1}}));
    return true;
  },
  selectWorld(worldId) {get().configure({...get().recipe, worldId});},
  selectActivity(activityId) {get().configure({...get().recipe, activityId, params: DEFAULT_PARAMS[activityId]});},
  updateParam(key, value) {return get().configure({...get().recipe, params: {...get().recipe.params, [key]: value}});},
  run() {set(s => s.status === 'running' ? {} : ({status: 'running', error: null, ...(s.status === 'paused' ? {} : {revision: s.revision + 1, samples: {}, summaries: {}}), transport: {action: 'run', sequence: s.transport.sequence + 1}}));},
  pause() {set(s => ({status: s.status === 'running' ? 'paused' : s.status, transport: {action: 'pause', sequence: s.transport.sequence + 1}}));},
  reset() {set(s => ({revision: s.revision + 1, status: 'ready', ...cleared, transport: {action: 'reset', sequence: s.transport.sequence + 1}}));},
  step() {if (get().status === 'completed' || get().status === 'error') return; set(s => ({status: 'paused', transport: {action: 'step', sequence: s.transport.sequence + 1}}));},
  setComparison(value) {if(value && get().recipe.worldId === 'earth') {set({error: 'Choose Moon or Mars to compare with Earth.'}); return;} set(s => ({comparison: value, revision: s.revision + 1, status: 'ready', ...cleared, transport: {action: 'reset', sequence: s.transport.sequence + 1}}));},
  acceptSample(sample, world, revision) {const s = get(); if(!['running', 'paused'].includes(s.status) || revision !== s.revision || !Number.isFinite(sample.timeS) || (world !== s.recipe.worldId && !(s.comparison && world === 'earth'))) return; set({samples: {...s.samples, [world]: [...(s.samples[world] ?? []), sample].slice(-600)}});},
  acceptSummary(input) {
    const parsed = runSummarySchema.safeParse(input); if (!parsed.success) return;
    const summary = parsed.data; const s = get();
    if(summary.revision !== s.revision || !['running','paused'].includes(s.status)) return;
    const expected = {...s.recipe, worldId: summary.recipe.worldId};
    if(JSON.stringify(experimentRecipeSchema.parse(expected)) !== JSON.stringify(summary.recipe) || (summary.recipe.worldId !== s.recipe.worldId && !(s.comparison && summary.recipe.worldId === 'earth'))) return;
    const summaries = {...s.summaries, [summary.recipe.worldId]: summary};
    set({summaries, status: summaries[s.recipe.worldId] && (!s.comparison || summaries.earth) ? 'completed' : s.status});
  },
  setStatus(status, revision) {if (revision !== get().revision) return; if(status === 'loading' && ['running','paused'].includes(get().status)) return; if(status === 'ready' && get().status !== 'loading') return; if(status === 'completed') return; set({status});},
  setError(error) {set({error});},
  dispatch(input) {const parsed = labCommandSchema.safeParse(input); if(!parsed.success) {set({error: 'Unsupported command.'});return false;} const command: LabCommand = parsed.data; if(command.type === 'configure') {if(!get().configure(command.recipe)) return false; if(command.run) get().run();} else {const action = command.action; if(action === 'compare') get().setComparison(true); else get()[action]();} return true;},
}));

export const DRAFT_KEY = 'planet-lab.recipe.v1';
export function restoreDraft(): 'restored' | 'empty' | 'invalid' {
  try { const raw = localStorage.getItem(DRAFT_KEY); if(!raw) return 'empty'; let input: unknown; try {input = JSON.parse(raw);} catch {localStorage.setItem(`${DRAFT_KEY}.invalid`, raw); return 'invalid';} const data = experimentRecipeSchema.safeParse(input); if(!data.success) {localStorage.setItem(`${DRAFT_KEY}.invalid`, raw); return 'invalid';} useLabStore.getState().configure(data.data); return 'restored'; } catch {return 'invalid';}
}
export function persistDraft(): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const unsubscribe = useLabStore.subscribe((state, previous) => {if(state.recipe === previous.recipe && !(state.transport.action === 'reset' && state.transport.sequence !== previous.transport.sequence)) return; clearTimeout(timer); timer = setTimeout(() => {try {localStorage.setItem(DRAFT_KEY, JSON.stringify(state.recipe));} catch {useLabStore.getState().setError('Local storage unavailable. Keep this tab open to preserve your experiment.');}}, 200);});
  return () => {clearTimeout(timer); unsubscribe();};
}
