import { z } from 'zod';

export const worldIdSchema = z.enum(['earth', 'moon', 'mars']);
export const activityIdSchema = z.enum(['rover-ramp', 'projectile', 'pendulum', 'wind-tunnel']);
export type WorldId = z.infer<typeof worldIdSchema>;
export type ActivityId = z.infer<typeof activityIdSchema>;
export type Vec3 = readonly [number, number, number];
const number = (min: number, max: number) => z.number().finite().min(min).max(max);
const base = { schemaVersion: z.literal(1), worldId: worldIdSchema, seed: z.number().int().min(0).max(4294967295) };
export const roverParamsSchema = z.object({ launchSpeedMps: number(1, 20), launchAngleDeg: number(5, 45) }).strict();
export const projectileParamsSchema = z.object({ objectId: z.enum(['sphere', 'brick']), massKg: number(0.1, 20), speedMps: number(0, 30), angleDeg: number(0, 80), releaseHeightM: number(0.5, 10), dragEnabled: z.boolean() }).strict();
export const pendulumParamsSchema = z.object({ lengthM: number(0.5, 3), bobMassKg: number(0.1, 10), initialAngleDeg: number(5, 30) }).strict();
export const windParamsSchema = z.object({ objectId: z.enum(['sphere', 'plate']), windSpeedMps: number(0, 30), areaM2: number(0.01, 1) }).strict();
export const experimentRecipeSchema = z.discriminatedUnion('activityId', [
  z.object({ ...base, activityId: z.literal('rover-ramp'), params: roverParamsSchema }).strict(),
  z.object({ ...base, activityId: z.literal('projectile'), params: projectileParamsSchema }).strict(),
  z.object({ ...base, activityId: z.literal('pendulum'), params: pendulumParamsSchema }).strict(),
  z.object({ ...base, activityId: z.literal('wind-tunnel'), params: windParamsSchema }).strict(),
]);
export type ExperimentRecipe = z.infer<typeof experimentRecipeSchema>;
export type ParamsByActivity = { [K in ActivityId]: Extract<ExperimentRecipe, {activityId: K}>['params'] };
export const labCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('configure'), recipe: experimentRecipeSchema, run: z.boolean() }).strict(),
  z.object({ type: z.literal('control'), action: z.enum(['run', 'pause', 'reset', 'compare']) }).strict(),
]);
export type LabCommand = z.infer<typeof labCommandSchema>;
export const runStatusSchema = z.enum(['loading', 'ready', 'running', 'paused', 'completed', 'error']);
export type RunStatus = z.infer<typeof runStatusSchema>;
export const metricIdSchema = z.enum(['flightTimeS', 'rangeM', 'peakHeightM', 'impactSpeedMps', 'periodS', 'dragN', 'dynamicPressurePa']);
export type MetricId = z.infer<typeof metricIdSchema>;
export type TelemetrySample = { timeS: number; positionM: Vec3; velocityMps: Vec3; dragN: number | null; angleRad: number | null };
export const runSummarySchema = z.object({ runId: z.uuid(), revision: z.number().int().nonnegative(), recipe: experimentRecipeSchema, modelVersion: z.string().min(1).max(80), elapsedS: number(0, 60), termination: z.enum(['contact', 'cycles', 'timeout', 'manual']), metrics: z.partialRecord(metricIdSchema, z.number().finite().nonnegative()), assumptions: z.array(z.string().max(500)).max(20) }).strict();
export type RunSummary = z.infer<typeof runSummarySchema>;
export type ParameterDescriptor = { key: string; label: string; unit: string; min: number; max: number; step: number };
export type WorldDefinition = { id: WorldId; name: string; gravityMps2: number; gasDensityKgM3: number; referenceTemperatureK: number; referencePressurePa: number; sourceUrls: string[]; conditions: string; visualPreset: {ground: string; sky: string; rock: string} };
export type ActivityDefinition = { id: ActivityId; name: string; description: string; parameters: ParameterDescriptor[]; defaults: ParamsByActivity[ActivityId]; metricIds: MetricId[]; durationLimitS: number; assumptions: string[]; assetIds: string[] };
export const DEFAULT_RECIPE: ExperimentRecipe = {schemaVersion: 1, activityId: 'rover-ramp', worldId: 'mars', seed: 42, params: {launchSpeedMps: 8, launchAngleDeg: 25}};
export const DEFAULT_PARAMS: ParamsByActivity = {
  'rover-ramp': {launchSpeedMps: 8, launchAngleDeg: 25},
  projectile: {objectId: 'sphere', massKg: 1, speedMps: 10, angleDeg: 45, releaseHeightM: 1, dragEnabled: false},
  pendulum: {lengthM: 2, bobMassKg: 1, initialAngleDeg: 15},
  'wind-tunnel': {objectId: 'sphere', windSpeedMps: 12, areaM2: 0.1},
};
export const METRICS: Record<MetricId, {label: string; unit: string; precision: number}> = {
  flightTimeS: {label: 'Airtime', unit: 's', precision: 2}, rangeM: {label: 'Range', unit: 'm', precision: 2},
  peakHeightM: {label: 'Peak height', unit: 'm', precision: 2}, impactSpeedMps: {label: 'Impact speed', unit: 'm/s', precision: 2},
  periodS: {label: 'Period', unit: 's', precision: 2}, dragN: {label: 'Drag force', unit: 'N', precision: 3},
  dynamicPressurePa: {label: 'Dynamic pressure', unit: 'Pa', precision: 2},
};
