'use client';

import { experimentRecipeSchema } from '@/domain/experiment';
import { savedExperimentSchema, type Result, type SavedExperiment } from '@/domain/persistence';
import { getAccessToken, getBrowserSupabase } from '@/lib/supabase/browser';

type ExperimentRow = {
  id: unknown;
  title: unknown;
  recipe: unknown;
  created_at: unknown;
  updated_at: unknown;
};

function fromRow(value: unknown): SavedExperiment | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as ExperimentRow;
  const recipe = experimentRecipeSchema.safeParse(row.recipe);
  if (!recipe.success) return null;
  const parsed = savedExperimentSchema.safeParse({
    id: row.id,
    title: row.title,
    recipe: recipe.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  return parsed.success ? parsed.data : null;
}

async function readyClient(): Promise<Result<NonNullable<ReturnType<typeof getBrowserSupabase>>>> {
  const auth = await getAccessToken();
  if (!auth.ok) return auth;
  const client = getBrowserSupabase();
  return client ? { ok: true, data: client } : { ok: false, error: 'Cloud features are not configured.' };
}

export async function saveExperiment(input: { title: string; recipe: unknown }): Promise<Result<SavedExperiment>> {
  try {
    const title = input.title.trim();
    const recipe = experimentRecipeSchema.safeParse(input.recipe);
    const parsed = savedExperimentSchema.shape.title.safeParse(title);
    if (!parsed.success || !recipe.success) return { ok: false, error: 'Experiment details are invalid.' };

    const ready = await readyClient();
    if (!ready.ok) return ready;
    const { data: userData, error: userError } = await ready.data.auth.getUser();
    if (userError || !userData.user) return { ok: false, error: 'Cloud session is invalid.' };

    const { data, error } = await ready.data.from('experiments').insert({
      owner_id: userData.user.id,
      title,
      schema_version: 1,
      recipe: recipe.data,
    }).select('id,title,recipe,created_at,updated_at').single();
    if (error) return { ok: false, error: 'Could not save this experiment.' };
    const saved = fromRow(data);
    return saved ? { ok: true, data: saved } : { ok: false, error: 'Saved experiment could not be validated.' };
  } catch {
    return { ok: false, error: 'Could not save this experiment.' };
  }
}

export async function listExperiments(): Promise<Result<SavedExperiment[]>> {
  try {
    const ready = await readyClient();
    if (!ready.ok) return ready;
    const { data, error } = await ready.data.from('experiments')
      .select('id,title,recipe,created_at,updated_at').order('updated_at', { ascending: false }).limit(100);
    if (error) return { ok: false, error: 'Could not load saved experiments.' };
    const rows = (data ?? []).map(fromRow);
    if (rows.some((row) => row === null)) return { ok: false, error: 'A saved experiment failed validation.' };
    return { ok: true, data: rows as SavedExperiment[] };
  } catch {
    return { ok: false, error: 'Could not load saved experiments.' };
  }
}

export async function loadExperiment(id: string): Promise<Result<SavedExperiment>> {
  if (!savedExperimentSchema.shape.id.safeParse(id).success) return { ok: false, error: 'Experiment ID is invalid.' };
  try {
    const ready = await readyClient();
    if (!ready.ok) return ready;
    const { data, error } = await ready.data.from('experiments')
      .select('id,title,recipe,created_at,updated_at').eq('id', id).maybeSingle();
    if (error) return { ok: false, error: 'Could not load this experiment.' };
    const saved = fromRow(data);
    return saved ? { ok: true, data: saved } : { ok: false, error: 'Experiment was not found or failed validation.' };
  } catch {
    return { ok: false, error: 'Could not load this experiment.' };
  }
}

export async function deleteExperiment(id: string): Promise<Result<null>> {
  if (!savedExperimentSchema.shape.id.safeParse(id).success) return { ok: false, error: 'Experiment ID is invalid.' };
  try {
    const ready = await readyClient();
    if (!ready.ok) return ready;
    const { data, error } = await ready.data.from('experiments').delete().eq('id', id).select('id').maybeSingle();
    if (error) return { ok: false, error: 'Could not delete this experiment.' };
    return data ? { ok: true, data: null } : { ok: false, error: 'Experiment was not found.' };
  } catch {
    return { ok: false, error: 'Could not delete this experiment.' };
  }
}
