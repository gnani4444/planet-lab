import { describe, expect, it } from 'vitest';
import type { ExperimentRecipe, WorldId } from '@/domain';
import { WORLDS } from '@/data';
import { createPhysicsState, FIXED_DT, runToCompletion, stepPhysics, summarizePhysics } from '@/features/simulation/physics';

const WORLDS_TO_CHECK: WorldId[] = ['earth', 'moon', 'mars', 'mercury', 'venus', 'titan'];
const SPHERE_RADIUS_M = 0.18;
const SPHERE_AREA_M2 = Math.PI * SPHERE_RADIUS_M ** 2;
const SPHERE_DRAG_COEFFICIENT = 0.47;

function freeFall(worldId: WorldId, heightM: number, massKg: number, dragEnabled: boolean): ExperimentRecipe {
  return { schemaVersion: 1, activityId: 'free-fall', worldId, seed: 42, params: { heightM, massKg, dragEnabled } };
}

function bounce(worldId: WorldId, heightM: number, massKg: number, restitution: number): ExperimentRecipe {
  return { schemaVersion: 1, activityId: 'bounce', worldId, seed: 42, params: { heightM, massKg, restitution } };
}

function summary(recipe: ExperimentRecipe) {
  const state = runToCompletion(recipe);
  return summarizePhysics(state, recipe, 1, 'audit-run');
}

function rk4VenusProjectile(recipe: Extract<ExperimentRecipe, { activityId: 'projectile' }>, dt = 1e-4) {
  const rho = WORLDS.venus.gasDensityKgM3;
  const area = SPHERE_AREA_M2;
  const dragRate = 0.5 * rho * SPHERE_DRAG_COEFFICIENT * area / recipe.params.massKg;
  const gravity = WORLDS.venus.gravityMps2;
  const angle = recipe.params.angleDeg * Math.PI / 180;
  type State = [x: number, y: number, vx: number, vy: number];
  const derivative = ([, , vx, vy]: State): State => {
    const speed = Math.hypot(vx, vy);
    return [vx, vy, -dragRate * speed * vx, -gravity - dragRate * speed * vy];
  };
  const add = (a: State, b: State, scale: number): State => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale, a[3] + b[3] * scale];
  let state: State = [0, recipe.params.releaseHeightM, recipe.params.speedMps * Math.cos(angle), recipe.params.speedMps * Math.sin(angle)];
  let time = 0;
  for (let i = 0; i < 2_000_000; i += 1) {
    const k1 = derivative(state);
    const k2 = derivative(add(state, k1, dt / 2));
    const k3 = derivative(add(state, k2, dt / 2));
    const k4 = derivative(add(state, k3, dt));
    const next: State = [
      state[0] + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      state[1] + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
      state[2] + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
      state[3] + dt / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    ];
    if (next[1] <= 0) {
      const fraction = state[1] / (state[1] - next[1]);
      const velocityX = state[2] + (next[2] - state[2]) * fraction;
      const velocityY = state[3] + (next[3] - state[3]) * fraction;
      return { timeS: time + dt * fraction, rangeM: state[0] + (next[0] - state[0]) * fraction, impactSpeedMps: Math.hypot(velocityX, velocityY) };
    }
    state = next;
    time += dt;
  }
  throw new Error('RK4 reference did not reach the ground');
}

describe('independent references for free-fall and bounce', () => {
  it('matches vacuum free-fall time and impact speed on every world', () => {
    const heightM = 7.3;
    for (const worldId of WORLDS_TO_CHECK) {
      const g = WORLDS[worldId].gravityMps2;
      const expectedTimeS = Math.sqrt(2 * heightM / g);
      const expectedImpactSpeedMps = Math.sqrt(2 * g * heightM);
      const result = summary(freeFall(worldId, heightM, 0.4, false));

      expect(result.termination, worldId).toBe('contact');
      expect(Math.abs(result.metrics.flightTimeS! - expectedTimeS), worldId).toBeLessThanOrEqual(FIXED_DT);
      expect(Math.abs(result.metrics.impactSpeedMps! - expectedImpactSpeedMps), worldId).toBeLessThanOrEqual(g * FIXED_DT);
    }
  });

  it('keeps vacuum free-fall independent of mass', () => {
    for (const worldId of WORLDS_TO_CHECK) {
      const light = summary(freeFall(worldId, 7.3, 0.1, false));
      const heavy = summary(freeFall(worldId, 7.3, 20, false));
      expect(light.metrics.flightTimeS, worldId).toBeCloseTo(heavy.metrics.flightTimeS!, 12);
      expect(light.metrics.impactSpeedMps, worldId).toBeCloseTo(heavy.metrics.impactSpeedMps!, 12);
    }
  });

  it('does not report completed flight metrics when a projectile times out', () => {
    const speedMps = 30;
    const angleDeg = 80;
    const releaseHeightM = 10;
    const recipe: ExperimentRecipe = {
      schemaVersion: 1, activityId: 'projectile', worldId: 'titan', seed: 42,
      params: { objectId: 'sphere', massKg: 1, speedMps, angleDeg, releaseHeightM, dragEnabled: false },
    };
    const result = summary(recipe);
    const verticalSpeedMps = speedMps * Math.sin(angleDeg * Math.PI / 180);
    const analyticFlightTimeS = (verticalSpeedMps + Math.sqrt(verticalSpeedMps ** 2 + 2 * WORLDS.titan.gravityMps2 * releaseHeightM)) / WORLDS.titan.gravityMps2;

    expect(analyticFlightTimeS).toBeGreaterThan(30);
    expect(result.termination).toBe('timeout');
    expect(result.metrics.flightTimeS).toBeUndefined();
    expect(result.metrics.impactSpeedMps).toBeUndefined();
  });

  it.each([0, 0.3, 0.7, 0.95])('matches ideal first-bounce energy retention for restitution %s', (restitution) => {
    const heightM = 3.7;
    const result = summary(bounce('earth', heightM, 2, restitution));
    const expectedHeightM = restitution ** 2 * heightM;
    const expectedRetentionPct = 100 * restitution ** 2;

    expect(result.termination).toBe('contact');
    expect(result.metrics.reboundHeightM).toBeCloseTo(expectedHeightM, 2);
    expect(result.metrics.energyRetentionPct).toBeCloseTo(expectedRetentionPct, 1);
  });

  it('matches the analytical dense-atmosphere fall time and terminal speed on Venus', () => {
    const heightM = 10;
    const massKg = 0.1;
    const gravity = WORLDS.venus.gravityMps2;
    const density = WORLDS.venus.gasDensityKgM3;
    const terminalSpeedMps = Math.sqrt((2 * massKg * gravity) / (density * SPHERE_DRAG_COEFFICIENT * SPHERE_AREA_M2));
    const x = (heightM * gravity) / terminalSpeedMps ** 2;
    // acosh(exp(x)) = x + log(1 + sqrt(1 - exp(-2x))); this form avoids exp(x) overflow.
    const acoshExpX = x + Math.log1p(Math.sqrt(1 - Math.exp(-2 * x)));
    const expectedTimeS = (terminalSpeedMps / gravity) * acoshExpX;
    const expectedImpactSpeedMps = terminalSpeedMps * Math.tanh((gravity * expectedTimeS) / terminalSpeedMps);
    const result = summary(freeFall('venus', heightM, massKg, true));

    expect(result.termination).toBe('contact');
    expect(Math.abs(result.metrics.flightTimeS! - expectedTimeS) / expectedTimeS).toBeLessThan(0.01);
    expect(Math.abs(result.metrics.impactSpeedMps! - expectedImpactSpeedMps) / expectedImpactSpeedMps).toBeLessThan(0.01);

    const state = createPhysicsState(freeFall('venus', heightM, massKg, true));
    let maximumDownwardSpeed = 0;
    while (!state.finished) {
      stepPhysics(state, freeFall('venus', heightM, massKg, true));
      maximumDownwardSpeed = Math.max(maximumDownwardSpeed, Math.abs(state.velocity[1]));
    }
    expect(maximumDownwardSpeed).toBeLessThanOrEqual(terminalSpeedMps * 1.01);
  });

  it('matches an independent small-step RK4 reference for a Venus launch with drag', () => {
    const recipe: Extract<ExperimentRecipe, { activityId: 'projectile' }> = {
      schemaVersion: 1, activityId: 'projectile', worldId: 'venus', seed: 42,
      params: { objectId: 'sphere', massKg: 0.1, speedMps: 30, angleDeg: 45, releaseHeightM: 2, dragEnabled: true },
    };
    const expected = rk4VenusProjectile(recipe);
    const expectedHalfStep = rk4VenusProjectile(recipe, 5e-5);
    expect(Math.abs(expected.timeS - expectedHalfStep.timeS)).toBeLessThan(1e-7);
    expect(Math.abs(expected.rangeM - expectedHalfStep.rangeM)).toBeLessThan(1e-7);
    expect(Math.abs(expected.impactSpeedMps - expectedHalfStep.impactSpeedMps)).toBeLessThan(1e-7);
    const result = summary(recipe);

    expect(result.termination).toBe('contact');
    expect(Math.abs(result.metrics.flightTimeS! - expected.timeS) / expected.timeS).toBeLessThan(0.01);
    expect(Math.abs(result.metrics.rangeM! - expected.rangeM) / expected.rangeM).toBeLessThan(0.01);
    expect(Math.abs(result.metrics.impactSpeedMps! - expected.impactSpeedMps) / expected.impactSpeedMps).toBeLessThan(0.01);
  });
});
