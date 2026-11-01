import {expect, it} from 'vitest';
import {createTrajectoryGeometry, updateTrajectoryGeometry} from '@/features/simulation/trajectory';
it('retains a full growing 3D trajectory beyond its first two points', () => {
  const geometry = createTrajectoryGeometry();
  const points = Array.from({length: 20}, (_, i) => [i, Math.sin(i), 0] as const);
  updateTrajectoryGeometry(geometry, points.slice(0,2), -7);
  expect(geometry.drawRange.count).toBe(2);
  updateTrajectoryGeometry(geometry, points, -7);
  expect(geometry.drawRange.count).toBe(20);
  expect(geometry.getAttribute('position').getX(19)).toBe(12);
  expect(geometry.getAttribute('position').getY(19)).toBeCloseTo(Math.sin(19), 6);
  updateTrajectoryGeometry(geometry, [], 0);
  expect(geometry.drawRange.count).toBe(0);
  geometry.dispose();
});
