import { z } from 'zod';
import { experimentRecipeSchema } from './experiment';
export const savedExperimentSchema = z.object({id: z.uuid(), title: z.string().min(1).max(80), recipe: experimentRecipeSchema, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime()}).strict();
export type SavedExperiment = z.infer<typeof savedExperimentSchema>;
export type Result<T> = {ok: true; data: T} | {ok: false; error: string};
