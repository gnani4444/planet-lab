import * as THREE from 'three';
import type {Vec3} from '@/domain';

// At most one point per 60 Hz tick for the longest, 45-second activity, plus endpoints.
const CAPACITY = 2702;
export function createTrajectoryGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(CAPACITY * 3), 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}
export function updateTrajectoryGeometry(geometry: THREE.BufferGeometry, points: readonly Vec3[], offset: number): void {
  const positions = geometry.getAttribute('position');
  const count = Math.min(points.length, positions.count);
  for(let i = 0; i < count; i++) positions.setXYZ(i, points[i][0] + offset, points[i][1], points[i][2]);
  positions.needsUpdate = true;
  geometry.setDrawRange(0, count);
}
