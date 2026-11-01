import { z } from 'zod';
import { experimentRecipeSchema, labCommandSchema, metricIdSchema, runSummarySchema } from './experiment';
export const assistantRequestSchema = z.object({requestId: z.uuid(), revision: z.number().int().nonnegative(), operation: z.enum(['command','explain']), input: z.string().trim().min(1).max(500), recipe: experimentRecipeSchema, summary: runSummarySchema.optional(), referenceSummary: runSummarySchema.optional(), history: z.array(z.object({role: z.enum(['user', 'assistant']), content: z.string().min(1).max(1000)}).strict()).max(6).optional()}).strict();
export const assistantResultSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('command'), command: labCommandSchema, text: z.string().min(1).max(1000)}).strict(),
  z.object({kind: z.literal('clarify'), text: z.string().min(1).max(3000)}).strict(),
  z.object({kind: z.literal('unsupported'), text: z.string().min(1).max(3000)}).strict(),
  z.object({kind: z.literal('explanation'), text: z.string().min(1).max(3000), metricRefs: z.array(metricIdSchema).max(7)}).strict(),
]);
export const assistantResponseSchema = z.object({requestId: z.uuid(), basedOnRevision: z.number().int().nonnegative(), result: assistantResultSchema, usage: z.object({inputTokens: z.number().int().min(0).max(8000), outputTokens: z.number().int().min(0).max(800)}).strict().optional()}).strict();
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantResult = z.infer<typeof assistantResultSchema>;
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
