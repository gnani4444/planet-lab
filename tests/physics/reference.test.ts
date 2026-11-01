import { describe, expect, it } from 'vitest';
import { createPhysicsState, FIXED_DT, runToCompletion, stepPhysics, summarizePhysics } from '@/features/simulation/physics';
import type { ExperimentRecipe } from '@/domain';

const projectile = (worldId: 'earth' | 'moon' | 'mars', massKg = 1): ExperimentRecipe => ({
  schemaVersion: 1, activityId: 'projectile', worldId, seed: 42,
  params: { objectId: 'sphere', massKg, speedMps: 14, angleDeg: 37, releaseHeightM: 2, dragEnabled: false },
});

describe('independent physics references', () => {
  it('keeps a vacuum projectile within 2% of the analytic flight solution', () => {
    for (const worldId of ['earth', 'moon', 'mars'] as const) {
      const recipe = projectile(worldId);
      const g = { earth: 9.80665, moon: 1.62, mars: 3.71 }[worldId];
      const theta = 37 * Math.PI / 180;
      const vy = 14 * Math.sin(theta);
      const t = (vy + Math.sqrt(vy * vy + 2 * g * 2)) / g;
      const expectedRange = 14 * Math.cos(theta) * t;
      const result = summarizePhysics(runToCompletion(recipe), recipe, 1, 'reference-run');
      expect(Math.abs((result.metrics.flightTimeS! - t) / t)).toBeLessThan(0.02);
      expect(Math.abs((result.metrics.rangeM! - expectedRange) / expectedRange)).toBeLessThan(0.02);
    }
  });

  it('does not make vacuum acceleration depend on mass', () => {
    const light = runToCompletion(projectile('earth', 0.1));
    const heavy = runToCompletion(projectile('earth', 20));
    expect(light.tick).toBe(heavy.tick);
    expect(light.position[0]).toBeCloseTo(heavy.position[0], 10);
    expect(light.position[1]).toBe(heavy.position[1]);
  });

  it('measures small-angle pendulum periods within 3% of the reference', () => {
    const recipe: ExperimentRecipe = { schemaVersion: 1, activityId: 'pendulum', worldId: 'earth', seed: 42, params: { lengthM: 2, bobMassKg: 3, initialAngleDeg: 5 } };
    const state = runToCompletion(recipe);
    const summary = summarizePhysics(state, recipe, 1, 'reference-run');
    const expected = 2 * Math.PI * Math.sqrt(2 / 9.80665);
    expect(summary.metrics.periodS).toBeDefined();
    expect(Math.abs((summary.metrics.periodS! - expected) / expected)).toBeLessThan(0.03);
  });

  it('calculates wind force from qCdA and gives the Moon zero drag', () => {
    for (const worldId of ['earth', 'moon', 'mars'] as const) {
      const recipe: ExperimentRecipe = { schemaVersion: 1, activityId: 'wind-tunnel', worldId, seed: 42, params: { objectId: 'sphere', windSpeedMps: 12, areaM2: 0.2 } };
      const state = createPhysicsState(recipe);
      const summary = summarizePhysics(state, recipe, 1, 'reference-run');
      const density = { earth: 1.225, moon: 0, mars: 0.016 }[worldId];
      const expectedQ = 0.5 * density * 12 ** 2;
      expect(summary.metrics.dynamicPressurePa).toBeCloseTo(expectedQ, 10);
      expect(summary.metrics.dragN).toBeCloseTo(expectedQ * 0.47 * 0.2, 10);
    }
  });

  it('advances one manual step by exactly 1/60 second', () => {
    const state = createPhysicsState(projectile('moon'));
    stepPhysics(state, projectile('moon'));
    expect(state.tick).toBe(1);
    expect(state.tick * FIXED_DT).toBeCloseTo(1 / 60, 15);
  });
});
