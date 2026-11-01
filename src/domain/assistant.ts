import { z } from 'zod';
import { experimentRecipeSchema, labCommandSchema, metricIdSchema, runSummarySchema } from './experiment';
export const assistantRequestSchema = z.object({requestId: z.uuid(), revision: z.number().int().nonnegative(), operation: z.enum(['command','explain']), input: z.string().trim().min(1).max(500), recipe: experimentRecipeSchema, summary: runSummarySchema.optional(), referenceSummary: runSummarySchema.optional()}).strict();
export const assistantResultSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('command'), command: labCommandSchema}).strict(),
  z.object({kind: z.literal('clarify'), text: z.string().min(1).max(3000)}).strict(),
  z.object({kind: z.literal('unsupported'), text: z.string().min(1).max(3000)}).strict(),
  z.object({kind: z.literal('explanation'), text: z.string().min(1).max(3000), metricRefs: z.array(metricIdSchema).max(7)}).strict(),
]);
export const assistantResponseSchema = z.object({requestId: z.uuid(), basedOnRevision: z.number().int().nonnegative(), result: assistantResultSchema}).strict();
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantResult = z.infer<typeof assistantResultSchema>;
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
