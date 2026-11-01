import type { ExperimentRecipe, TelemetrySample, WorldId, RunSummary } from '@/domain';
import { ACTIVITIES, WORLDS } from '@/data';

export const FIXED_DT = 1 / 60;
export const MODEL_VERSION = 'planet-lab-local-physics-1.0';
const DRAG_COEFFICIENT: Record<'sphere' | 'brick', number> = { sphere: 0.47, brick: 1.05 };
const DAMPING_PER_SECOND = 0.002;

export type PhysicsState = {
  tick: number;
  elapsedS: number;
  position: [number, number, number];
  velocity: [number, number, number];
  angle: number;
  angularVelocity: number;
  maxHeight: number;
  originX: number;
  crossings: number[];
  lastCrossingSide: -1 | 1;
  dragN: number;
  finished: boolean;
  termination?: 'contact' | 'cycles' | 'timeout';
};

export const createPhysicsState = (recipe: ExperimentRecipe): PhysicsState => {
  if (recipe.activityId === 'wind-tunnel') {
    const rho = WORLDS[recipe.worldId].gasDensityKgM3;
    const coeff = recipe.params.objectId === 'sphere' ? 0.47 : 1.28;
    const q = 0.5 * rho * recipe.params.windSpeedMps ** 2;
    return { tick: 0, elapsedS: 0, position: [0, 1, 0], velocity: [0, 0, 0], angle: 0, angularVelocity: 0, maxHeight: 1, originX: 0, crossings: [], lastCrossingSide: 1, dragN: q * coeff * recipe.params.areaM2, finished: true, termination: 'contact' };
  }
  if (recipe.activityId === 'pendulum') {
    const angle = recipe.params.initialAngleDeg * Math.PI / 180;
    const length = recipe.params.lengthM;
    const pivotY = 4.2;
    return { tick: 0, elapsedS: 0, position: [length * Math.sin(angle), pivotY - length * Math.cos(angle), 0], velocity: [0, 0, 0], angle, angularVelocity: 0, maxHeight: pivotY, originX: 0, crossings: [], lastCrossingSide: 1, dragN: 0, finished: false };
  }
  const rover = recipe.activityId === 'rover-ramp';
  const speed = rover ? recipe.params.launchSpeedMps : recipe.params.speedMps;
  const angle = (rover ? recipe.params.launchAngleDeg : recipe.params.angleDeg) * Math.PI / 180;
  const height = rover ? 0.3 : recipe.params.releaseHeightM;
  return {
    tick: 0, elapsedS: 0, position: [0, height, 0], velocity: [speed * Math.cos(angle), speed * Math.sin(angle), 0],
    angle: 0, angularVelocity: 0, maxHeight: height, originX: 0, crossings: [], lastCrossingSide: 1, dragN: 0, finished: false,
  };
};

/** One semi-implicit fixed tick. State and forces are in SI units. */
export function stepPhysics(state: PhysicsState, recipe: ExperimentRecipe, worldId: WorldId = recipe.worldId): void {
  if (state.finished || recipe.activityId === 'wind-tunnel') return;
  state.tick += 1;
  const priorTime = state.elapsedS;
  state.elapsedS += FIXED_DT;
  const t = state.elapsedS;
  const world = WORLDS[worldId];
  if (recipe.activityId === 'pendulum') {
    const length = recipe.params.lengthM;
    const gravity = world.gravityMps2;
    const angularAcceleration = -(gravity / length) * Math.sin(state.angle) - DAMPING_PER_SECOND * state.angularVelocity;
    state.angularVelocity += angularAcceleration * FIXED_DT;
    state.angle += state.angularVelocity * FIXED_DT;
    state.position = [length * Math.sin(state.angle), 4.2 - length * Math.cos(state.angle), 0];
    const side = state.angle >= 0 ? 1 : -1;
    if (state.lastCrossingSide !== side && Math.abs(state.angle) < 0.035 && t > 0.15) {
      state.crossings.push(t);
      state.lastCrossingSide = side;
      if (state.crossings.length >= 7) { state.finished = true; state.termination = 'cycles'; }
    }
    if (t >= ACTIVITIES.pendulum.durationLimitS) { state.finished = true; state.termination = 'timeout'; }
    return;
  }

  const dragEnabled = recipe.activityId === 'projectile' && recipe.params.dragEnabled;
  if (dragEnabled && world.gasDensityKgM3 > 0) {
    const speed = Math.hypot(...state.velocity);
    if (speed > 0) {
      const mass = recipe.params.massKg;
      const coeff = DRAG_COEFFICIENT[recipe.params.objectId];
      const area = recipe.params.objectId === 'sphere' ? Math.PI * 0.18 ** 2 : 0.25;
      state.dragN = 0.5 * world.gasDensityKgM3 * speed ** 2 * coeff * area;
      const dragAcceleration = state.dragN / mass;
      const scale = Math.max(0, 1 - dragAcceleration * FIXED_DT / speed);
      state.velocity[0] *= scale;
      state.velocity[1] *= scale;
    }
  } else state.dragN = 0;

  const oldPosition: [number, number, number] = [...state.position];
  const oldVerticalVelocity = state.velocity[1];
  state.velocity[1] -= world.gravityMps2 * FIXED_DT;
  state.position[0] += state.velocity[0] * FIXED_DT;
  state.position[1] += state.velocity[1] * FIXED_DT;
  state.maxHeight = Math.max(state.maxHeight, state.position[1]);
  if (state.position[1] <= 0) {
    const fraction = Math.max(0, Math.min(1, oldPosition[1] / Math.max(oldPosition[1] - state.position[1], Number.EPSILON)));
    state.elapsedS = priorTime + FIXED_DT * fraction;
    state.position[0] = oldPosition[0] + (state.position[0] - oldPosition[0]) * fraction;
    state.position[1] = 0;
    state.velocity[1] = oldVerticalVelocity - world.gravityMps2 * FIXED_DT * fraction;
    state.finished = true;
    state.termination = 'contact';
  } else if (t >= ACTIVITIES[recipe.activityId].durationLimitS) {
    state.finished = true;
    state.termination = 'timeout';
  }
}

export function toTelemetry(state: PhysicsState): TelemetrySample {
  return {
    timeS: state.elapsedS,
    positionM: [...state.position],
    velocityMps: [...state.velocity],
    dragN: state.dragN,
    angleRad: Number.isFinite(state.angle) && state.tick > 0 ? state.angle : null,
  };
}

export function summarizePhysics(state: PhysicsState, recipe: ExperimentRecipe, revision: number, runId: string): RunSummary {
  const elapsedS = state.elapsedS;
  const metrics: RunSummary['metrics'] = {};
  if (recipe.activityId === 'wind-tunnel') {
    const rho = WORLDS[recipe.worldId].gasDensityKgM3;
    metrics.dragN = state.dragN;
    metrics.dynamicPressurePa = 0.5 * rho * recipe.params.windSpeedMps ** 2;
  } else if (recipe.activityId === 'pendulum') {
    const cyclePeriods = state.crossings.slice(2).map((time, i) => time - state.crossings[i]);
    if (cyclePeriods.length) metrics.periodS = cyclePeriods.reduce((sum, period) => sum + period, 0) / cyclePeriods.length;
  } else {
    metrics.flightTimeS = elapsedS;
    metrics.rangeM = Math.max(0, state.position[0] - state.originX);
    metrics.peakHeightM = Math.max(0, state.maxHeight);
    metrics.impactSpeedMps = Math.hypot(...state.velocity);
  }
  return {
    runId, revision, recipe, modelVersion: MODEL_VERSION, elapsedS,
    termination: state.termination ?? 'manual', metrics,
    assumptions: ACTIVITIES[recipe.activityId].assumptions,
  };
}

export function runToCompletion(recipe: ExperimentRecipe, worldId: WorldId = recipe.worldId): PhysicsState {
  const state = createPhysicsState(recipe);
  const maxTicks = Math.ceil(ACTIVITIES[recipe.activityId].durationLimitS / FIXED_DT);
  for (let i = 0; i < maxTicks && !state.finished; i += 1) stepPhysics(state, recipe, worldId);
  return state;
}
