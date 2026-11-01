import type { ExperimentRecipe, TelemetrySample, WorldId, RunSummary } from '@/domain';
import { ACTIVITIES, WORLDS } from '@/data';

export const FIXED_DT = 1 / 60;
export const MODEL_VERSION = 'planet-lab-local-physics-1.1';
const DRAG_COEFFICIENT: Record<'sphere' | 'brick', number> = { sphere: 0.47, brick: 1.05 };
const DAMPING_PER_SECOND = 0.002;
export type DragMotion = { displacement: [number, number, number]; velocity: [number, number, number] };

/** Symmetric gravity split with an exact constant-Cd quadratic-drag drift for one interval. */
export function integrateQuadraticDragMotion(
  initial: [number, number, number], dt: number, gravityMps2: number,
  densityKgM3: number, coefficient: number, areaM2: number, massKg: number,
): DragMotion {
  const [vx, vy, vz] = initial;
  const halfGravity: [number, number, number] = [vx, vy - gravityMps2 * dt / 2, vz];
  const speed = Math.hypot(...halfGravity);
  const k = 0.5 * densityKgM3 * coefficient * areaM2 / massKg;
  const kdT = k * speed * dt;
  const driftFactor = k > 0 && speed > 0 ? Math.log1p(kdT) / (k * speed) : dt;
  const dragVelocity: [number, number, number] = kdT > 0
    ? [halfGravity[0] / (1 + kdT), halfGravity[1] / (1 + kdT), halfGravity[2] / (1 + kdT)]
    : halfGravity;
  const displacement: [number, number, number] = [halfGravity[0] * driftFactor, halfGravity[1] * driftFactor, halfGravity[2] * driftFactor];
  return { displacement, velocity: [dragVelocity[0], dragVelocity[1] - gravityMps2 * dt / 2, dragVelocity[2]] };
}

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
  firstImpactTimeS?: number;
  firstImpactSpeedMps?: number;
  reboundMaxHeight?: number;
  impactCount?: number;
};

export const createPhysicsState = (recipe: ExperimentRecipe): PhysicsState => {
  if (recipe.activityId === 'free-fall' || recipe.activityId === 'bounce') {
    const height = recipe.params.heightM;
    return {
      tick: 0, elapsedS: 0, position: [0, height + 0.18, 0], velocity: [0, 0, 0],
      angle: 0, angularVelocity: 0, maxHeight: height, originX: 0, crossings: [], lastCrossingSide: 1, dragN: 0, finished: false,
      reboundMaxHeight: 0, impactCount: 0,
    };
  }
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

function contactFraction(startY: number, contactY: number, velocity: [number, number, number], dt: number, gravity: number, density: number, coefficient: number, area: number, mass: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 28; i += 1) {
    const middle = (low + high) / 2;
    const motion = integrateQuadraticDragMotion(velocity, dt * middle, gravity, density, coefficient, area, mass);
    if (startY + motion.displacement[1] > contactY) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** One semi-implicit fixed tick. State and forces are in SI units. */
export function stepPhysics(state: PhysicsState, recipe: ExperimentRecipe, worldId: WorldId = recipe.worldId): void {
  if (state.finished || recipe.activityId === 'wind-tunnel') return;
  state.tick += 1;
  const priorTime = state.elapsedS;
  state.elapsedS += FIXED_DT;
  const t = state.elapsedS;
  const world = WORLDS[worldId];
  if (recipe.activityId === 'free-fall' || recipe.activityId === 'bounce') {
    const priorPosition = state.position[1];
    const priorVelocity: [number, number, number] = [...state.velocity];
    const mass = recipe.params.massKg;
    const radius = 0.18;
    const dragEnabled = recipe.activityId === 'free-fall' && recipe.params.dragEnabled && world.gasDensityKgM3 > 0;
    const coefficient = 0.47;
    const area = Math.PI * radius ** 2;
    const density = dragEnabled ? world.gasDensityKgM3 : 0;
    const motion = integrateQuadraticDragMotion(priorVelocity, FIXED_DT, world.gravityMps2, density, coefficient, area, mass);
    state.velocity = motion.velocity;
    state.position[1] += motion.displacement[1];
    const halfVelocity = priorVelocity[1] - world.gravityMps2 * FIXED_DT / 2;
    state.dragN = dragEnabled ? 0.5 * density * halfVelocity ** 2 * coefficient * area : 0;
    state.maxHeight = Math.max(state.maxHeight, state.position[1] - radius);
    const centerHeight = radius;
    if (state.position[1] <= centerHeight) {
      const fraction = recipe.activityId === 'bounce'
        ? (priorVelocity[1] + Math.sqrt(priorVelocity[1] ** 2 + 2 * world.gravityMps2 * (priorPosition - centerHeight))) / world.gravityMps2 / FIXED_DT
        : contactFraction(priorPosition, centerHeight, priorVelocity, FIXED_DT, world.gravityMps2, density, coefficient, area, mass);
      const impactTime = priorTime + FIXED_DT * fraction;
      const incomingVelocity = integrateQuadraticDragMotion(priorVelocity, FIXED_DT * fraction, world.gravityMps2, density, coefficient, area, mass).velocity[1];
      state.position[1] = centerHeight;
      state.velocity[1] = incomingVelocity;
      state.impactCount = (state.impactCount ?? 0) + 1;
      if (recipe.activityId === 'free-fall' || state.impactCount >= 2 || (recipe.activityId === 'bounce' && recipe.params.restitution === 0)) {
        if (recipe.activityId === 'bounce' && state.impactCount === 1) {
          state.firstImpactTimeS = impactTime;
          state.firstImpactSpeedMps = Math.abs(incomingVelocity);
        }
        state.finished = true;
        state.termination = 'contact';
        state.elapsedS = impactTime;
      } else {
        state.firstImpactTimeS = impactTime;
        state.firstImpactSpeedMps = Math.abs(incomingVelocity);
        state.velocity[1] = Math.abs(incomingVelocity) * recipe.params.restitution;
        state.reboundMaxHeight = centerHeight;
        const remainingS = FIXED_DT * (1 - fraction);
        state.position[1] = centerHeight + state.velocity[1] * remainingS - 0.5 * world.gravityMps2 * remainingS ** 2;
        state.velocity[1] -= world.gravityMps2 * remainingS;
      }
    } else if (recipe.activityId === 'bounce' && (state.impactCount ?? 0) === 1) {
      state.reboundMaxHeight = Math.max(state.reboundMaxHeight ?? centerHeight, state.position[1]);
      if (state.velocity[1] <= 0 && state.reboundMaxHeight! <= centerHeight + Number.EPSILON) {
        state.finished = true;
        state.termination = 'contact';
      }
    }
    if (!state.finished && t >= ACTIVITIES[recipe.activityId].durationLimitS) { state.finished = true; state.termination = 'timeout'; }
    return;
  }
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

  if (recipe.activityId === 'projectile' && recipe.params.dragEnabled && world.gasDensityKgM3 > 0) {
    const area = recipe.params.objectId === 'sphere' ? Math.PI * 0.18 ** 2 : 0.25;
    const coefficient = DRAG_COEFFICIENT[recipe.params.objectId];
    const beforePosition: [number, number, number] = [...state.position];
    const beforeVelocity: [number, number, number] = [...state.velocity];
    const motion = integrateQuadraticDragMotion(beforeVelocity, FIXED_DT, world.gravityMps2, world.gasDensityKgM3, coefficient, area, recipe.params.massKg);
    state.velocity = motion.velocity;
    state.dragN = 0.5 * world.gasDensityKgM3 * Math.hypot(...beforeVelocity) ** 2 * coefficient * area;
    state.position = [beforePosition[0] + motion.displacement[0], beforePosition[1] + motion.displacement[1], beforePosition[2] + motion.displacement[2]];
    state.maxHeight = Math.max(state.maxHeight, state.position[1]);
    if (state.position[1] <= 0) {
      const fraction = contactFraction(beforePosition[1], 0, beforeVelocity, FIXED_DT, world.gravityMps2, world.gasDensityKgM3, coefficient, area, recipe.params.massKg);
      const partial = integrateQuadraticDragMotion(beforeVelocity, FIXED_DT * fraction, world.gravityMps2, world.gasDensityKgM3, coefficient, area, recipe.params.massKg);
      state.elapsedS = priorTime + FIXED_DT * fraction;
      state.position = [beforePosition[0] + partial.displacement[0], 0, beforePosition[2] + partial.displacement[2]];
      state.velocity = partial.velocity;
      state.finished = true;
      state.termination = 'contact';
      return;
    }
    if (t >= ACTIVITIES[recipe.activityId].durationLimitS) { state.finished = true; state.termination = 'timeout'; }
    return;
  }

  const oldPosition: [number, number, number] = [...state.position];
  const oldVelocity: [number, number, number] = [...state.velocity];
  state.dragN = 0;
  state.velocity[1] -= world.gravityMps2 * FIXED_DT;
  state.position[0] += state.velocity[0] * FIXED_DT;
  state.position[1] += state.velocity[1] * FIXED_DT;
  state.maxHeight = Math.max(state.maxHeight, state.position[1]);
  if (state.position[1] <= 0) {
    const fraction = Math.max(0, Math.min(1, oldPosition[1] / Math.max(oldPosition[1] - state.position[1], Number.EPSILON)));
    state.elapsedS = priorTime + FIXED_DT * fraction;
    state.position[0] = oldPosition[0] + (state.position[0] - oldPosition[0]) * fraction;
    state.position[1] = 0;
    state.velocity = [oldVelocity[0], oldVelocity[1] - world.gravityMps2 * FIXED_DT * fraction, oldVelocity[2]];
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
  } else if (recipe.activityId === 'bounce') {
    const radius = 0.18;
    const clearance = recipe.params.heightM;
    if (state.firstImpactTimeS !== undefined && state.firstImpactSpeedMps !== undefined) {
      metrics.flightTimeS = state.firstImpactTimeS;
      metrics.impactSpeedMps = state.firstImpactSpeedMps;
      metrics.reboundHeightM = Math.max(0, (state.reboundMaxHeight ?? radius) - radius);
      metrics.energyRetentionPct = clearance > 0 ? (metrics.reboundHeightM / clearance) * 100 : 0;
    }
  } else if (recipe.activityId === 'free-fall' && state.termination === 'contact') {
    metrics.flightTimeS = state.elapsedS;
    metrics.impactSpeedMps = Math.hypot(...state.velocity);
  } else if ((recipe.activityId === 'projectile' || recipe.activityId === 'rover-ramp') && state.termination === 'contact') {
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
  if (!state.finished) { state.finished = true; state.termination = 'timeout'; }
  return state;
}
