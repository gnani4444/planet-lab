'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useRapier, useSphericalJoint } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { ExperimentRecipe, RunStatus, TelemetrySample, RunSummary, WorldId } from '@/domain';
import { ACTIVITIES, WORLDS } from '@/data';
import { FIXED_DT, MODEL_VERSION } from './physics';
import {createTrajectoryGeometry, updateTrajectoryGeometry} from './trajectory';

export type SimulationViewProps = {
  recipe: ExperimentRecipe;
  revision: number;
  comparison: boolean;
  quality: 'low' | 'high';
  onStatus: (status: RunStatus) => void;
  onSample: (sample: TelemetrySample, worldId: WorldId) => void;
  onComplete: (summary: RunSummary) => void;
  onError: (message: string) => void;
};

export type SimulationHandle = { run(): void; pause(): void; reset(): void; step(): void; resetCamera(): void };
type WorldKey = 'active' | 'earth';
type Action = 'run' | 'pause' | 'reset' | 'step' | null;
type BodyRead = { position: [number, number, number]; velocity: [number, number, number]; angle: number | null; impactSpeed: number };
type WorldApi = {
  step: (dt: number) => void;
  reset: () => void;
  freeze: (position: [number, number, number]) => void;
  read: () => BodyRead;
};
type EngineContext = {
  recipe: ExperimentRecipe;
  revision: number;
  comparison: boolean;
  action: React.MutableRefObject<Action>;
  running: React.MutableRefObject<boolean>;
  accumulator: React.MutableRefObject<number>;
  worlds: React.MutableRefObject<Partial<Record<WorldKey, WorldApi>>>;
  runtime: React.MutableRefObject<Partial<Record<WorldKey, RuntimeState>>>;
  onStatus: SimulationViewProps['onStatus'];
  onSample: SimulationViewProps['onSample'];
  onComplete: SimulationViewProps['onComplete'];
  onError: SimulationViewProps['onError'];
  onReady: () => void;
};
type RuntimeState = {
  tick: number;
  elapsedS: number;
  position: [number, number, number];
  velocity: [number, number, number];
  maxHeight: number;
  angle: number | null;
  crossings: number[];
  previousAngle: number | null;
  contact: boolean;
  emitted: boolean;
  trajectory: [number, number, number][];
};

const vec = (value: { x: number; y: number; z: number }): [number, number, number] => [value.x, value.y, value.z];
const runUuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const startPosition = (recipe: ExperimentRecipe): [number, number, number] => {
  if (recipe.activityId === 'rover-ramp') return [0, 0.43, 0];
  if (recipe.activityId === 'projectile') return [0, recipe.params.releaseHeightM + (recipe.params.objectId === 'sphere' ? 0.18 : 0.16), 0];
  if (recipe.activityId === 'pendulum') {
    const theta = recipe.params.initialAngleDeg * Math.PI / 180;
    return [recipe.params.lengthM * Math.sin(theta), 4.2 - recipe.params.lengthM * Math.cos(theta), 0];
  }
  return [0, 1, 0];
};
const contactHeight = (recipe: ExperimentRecipe) => recipe.activityId === 'projectile' ? (recipe.params.objectId === 'sphere' ? 0.18 : 0.16) : recipe.activityId === 'rover-ramp' ? 0.13 : 0;
const startVelocity = (recipe: ExperimentRecipe): [number, number, number] => {
  if (recipe.activityId === 'rover-ramp') {
    const theta = recipe.params.launchAngleDeg * Math.PI / 180;
    return [recipe.params.launchSpeedMps * Math.cos(theta), recipe.params.launchSpeedMps * Math.sin(theta), 0];
  }
  if (recipe.activityId === 'projectile') {
    const theta = recipe.params.angleDeg * Math.PI / 180;
    return [recipe.params.speedMps * Math.cos(theta), recipe.params.speedMps * Math.sin(theta), 0];
  }
  return [0, 0, 0];
};
function emptyRuntime(recipe: ExperimentRecipe): RuntimeState {
  const position = startPosition(recipe);
  const angle = recipe.activityId === 'pendulum' ? recipe.params.initialAngleDeg * Math.PI / 180 : null;
  return { tick: 0, elapsedS: 0, position, velocity: startVelocity(recipe), maxHeight: recipe.activityId === 'pendulum' ? 4.2 : position[1] - contactHeight(recipe), angle, crossings: [], previousAngle: angle, contact: false, emitted: false, trajectory: [position] };
}
function dragFor(recipe: ExperimentRecipe, worldId: WorldId, velocity: [number, number, number]): number {
  if (recipe.activityId === 'wind-tunnel') {
    const p = recipe.params;
    const coefficient = p.objectId === 'sphere' ? 0.47 : 1.28;
    return 0.5 * WORLDS[worldId].gasDensityKgM3 * p.windSpeedMps ** 2 * coefficient * p.areaM2;
  }
  if (recipe.activityId !== 'projectile' || !recipe.params.dragEnabled) return 0;
  const speed = Math.hypot(...velocity);
  const coefficient = recipe.params.objectId === 'sphere' ? 0.47 : 1.05;
  const area = recipe.params.objectId === 'sphere' ? Math.PI * 0.18 ** 2 : 0.25;
  return 0.5 * WORLDS[worldId].gasDensityKgM3 * speed * speed * coefficient * area;
}

/** One Rapier provider per comparison world; one parent clock advances both in the same tick. */
function WorldPhysics({ context, worldKey, worldId, offset }: { context: EngineContext; worldKey: WorldKey; worldId: WorldId; offset: number }) {
  return <Physics gravity={[0, -WORLDS[worldId].gravityMps2, 0]} timeStep={FIXED_DT} paused interpolate={false} numSolverIterations={8}><WorldPhysicsContent context={context} worldKey={worldKey} worldId={worldId} offset={offset} /></Physics>;
}

function WorldPhysicsContent({ context, worldKey, worldId, offset }: { context: EngineContext; worldKey: WorldKey; worldId: WorldId; offset: number }) {
  const { step: stepWorld } = useRapier();
  const body = useRef<RapierRigidBody>(null!);
  const anchor = useRef<RapierRigidBody>(null!);
  const recipe = context.recipe;
  const initialAngle = recipe.activityId === 'pendulum' ? recipe.params.initialAngleDeg * Math.PI / 180 : 0;
  const localInitial = useMemo<[number, number, number]>(() => { const initial = startPosition(recipe); return [initial[0] + offset, initial[1], initial[2]]; }, [recipe, offset]);
  const pendulumLength = recipe.activityId === 'pendulum' ? recipe.params.lengthM : 1;
  const api = useMemo<WorldApi>(() => ({
    step: (dt) => {
      if (recipe.activityId === 'projectile' && recipe.params.dragEnabled && body.current) {
        const v = body.current.linvel();
        const speed = Math.hypot(v.x, v.y, v.z);
        const force = dragFor(recipe, worldId, [v.x, v.y, v.z]);
        if (speed > 0 && force > 0) body.current.applyImpulse({ x: -v.x / speed * force * dt, y: -v.y / speed * force * dt, z: -v.z / speed * force * dt }, true);
      }
      stepWorld(dt);
    },
    reset: () => {
      if (!body.current) return;
      const p = startPosition(recipe);
      body.current.setBodyType(0, true);
      body.current.setTranslation({ x: p[0] + offset, y: p[1], z: p[2] }, true);
      body.current.setRotation({ x: 0, y: 0, z: Math.sin((recipe.activityId === 'pendulum' ? initialAngle : 0) / 2), w: Math.cos((recipe.activityId === 'pendulum' ? initialAngle : 0) / 2) }, true);
      const v = startVelocity(recipe);
      body.current.setLinvel({ x: v[0], y: v[1], z: v[2] }, true);
      body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.current.resetForces(true);
      body.current.resetTorques(true);
      body.current.wakeUp();
    },
    freeze: (p) => {
      if (!body.current) return;
      body.current.setTranslation({ x: p[0] + offset, y: p[1], z: p[2] }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.current.setBodyType(1, true);
    },
    read: () => {
      const position = body.current ? vec(body.current.translation()) : localInitial;
      const velocity: [number, number, number] = body.current ? vec(body.current.linvel()) : [0, 0, 0];
      const pendulumAngle = recipe.activityId === 'pendulum' ? Math.atan2(position[0] - offset, 4.2 - position[1]) : null;
      return { position: [position[0] - offset, position[1], position[2]], velocity, angle: pendulumAngle, impactSpeed: Math.hypot(...velocity) };
    },
  }), [stepWorld, recipe, worldId, offset, initialAngle, localInitial]);
  const worldRegistry = context.worlds;
  const worldApis = worldRegistry.current;
  useEffect(() => {
    // Mutable physics APIs are deliberately held in stable engine refs, outside React state.
    // eslint-disable-next-line react-hooks/immutability -- this ref registry is the simulation's engine state, never UI state.
    worldApis[worldKey] = api;
    return () => { delete worldApis[worldKey]; };
  }, [api, worldApis, worldKey]);
  const onReady = context.onReady;
  useEffect(() => {
    onReady();
  }, [onReady]);

  const initialVelocity = startVelocity(recipe);
  const isPendulum = recipe.activityId === 'pendulum';
  const isProjectile = recipe.activityId === 'projectile';
  const sphere = isProjectile && recipe.params.objectId === 'sphere';
  const p = recipe.activityId === 'wind-tunnel' ? recipe.params : null;

  return (
    <>
        <RigidBody type="fixed" position={[offset, -0.12, 0]} colliders={false}>
          <CuboidCollider args={[100, 0.12, 100]} friction={0.85} restitution={0} />
        </RigidBody>
        {isPendulum && <RigidBody ref={anchor} type="fixed" position={[offset, 0, 0]} colliders={false} />}
        {isPendulum ? (
          <RigidBody ref={body} position={localInitial} rotation={[0, 0, initialAngle]} canSleep={false} colliders={false} linearDamping={0.0004} angularDamping={0.0002}>
            <BallCollider args={[0.16]} density={recipe.params.bobMassKg / (4 / 3 * Math.PI * 0.16 ** 3)} friction={0.1} restitution={0} />
          </RigidBody>
        ) : isProjectile ? (
          <RigidBody ref={body} position={localInitial} linearVelocity={initialVelocity} colliders={false} linearDamping={0} angularDamping={0} ccd>
            {sphere ? <BallCollider args={[0.18]} density={recipe.params.massKg / (4 / 3 * Math.PI * 0.18 ** 3)} friction={0.55} restitution={0.05} /> : <CuboidCollider args={[0.25, 0.16, 0.16]} density={recipe.params.massKg / (8 * 0.25 * 0.16 * 0.16)} friction={0.6} restitution={0.05} />}
          </RigidBody>
        ) : recipe.activityId === 'rover-ramp' ? (
          <RigidBody ref={body} position={localInitial} linearVelocity={initialVelocity} colliders={false} linearDamping={0} angularDamping={0} ccd>
            <CuboidCollider args={[0.42, 0.13, 0.3]} density={80 / (8 * 0.42 * 0.13 * 0.3)} friction={0.7} restitution={0} />
          </RigidBody>
        ) : null}
      {isPendulum && <PendulumConstraint anchor={anchor} body={body} length={pendulumLength} />}
      {isPendulum && <PendulumRod context={context} worldKey={worldKey} offset={offset} length={recipe.params.lengthM} />}
      {recipe.activityId === 'wind-tunnel' && <WindObject objectId={p!.objectId} offset={offset} />}
    </>
  );
}

function PendulumConstraint({ anchor, body, length }: { anchor: React.RefObject<RapierRigidBody>; body: React.RefObject<RapierRigidBody>; length: number }) {
  useSphericalJoint(anchor, body, [[0, 4.2, 0], [0, length, 0]]);
  return null;
}

function PendulumRod({ context, worldKey, offset, length }: { context: EngineContext; worldKey: WorldKey; offset: number; length: number }) {
  const rod = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const reading = context.worlds.current[worldKey]?.read();
    if (!reading || !rod.current) return;
    const dx = reading.position[0];
    const dy = reading.position[1] - 4.2;
    rod.current.position.set(offset + dx / 2, 4.2 + dy / 2, 0);
    rod.current.rotation.z = -Math.atan2(dx, -dy);
    rod.current.scale.y = Math.hypot(dx, dy) / length;
  });
  return <mesh ref={rod} position={[offset, 4.2 - length / 2, 0]}><cylinderGeometry args={[0.018, 0.018, length, 8]} /><meshStandardMaterial color="#d8c89e" metalness={0.5} roughness={0.35} /></mesh>;
}

function WorldScene({ context, worldKey, worldId, offset }: { context: EngineContext; worldKey: WorldKey; worldId: WorldId; offset: number }) {
  const preset = WORLDS[worldId].visualPreset;
  const pendulum = context.recipe.activityId === 'pendulum';
  const terrain = useMemo(() => {
    const random = seeded(context.recipe.seed + worldId.length * 37);
    return Array.from({ length: 40 }, () => {
      const x = offset - 6 + random() * 12;
      let z = -7 + random() * 14;
      if (x > offset - 4 && x < offset + 7 && Math.abs(z) < 2.4) z = (z < 0 ? -1 : 1) * (2.6 + random() * 1.4);
      return { x, z, size: 0.12 + random() * (worldId === 'moon' ? 0.75 : 0.42), rotation: random() * Math.PI };
    });
  }, [context.recipe.seed, offset, worldId]);
  return (
    <>
      <mesh position={[offset, -0.13, 0]} receiveShadow><boxGeometry args={[context.comparison ? 14 : 200, 0.26, context.comparison ? 16 : 200]} /><meshStandardMaterial color={preset.ground} roughness={0.94} /></mesh>
      <mesh position={[offset, -0.035, 0]}><boxGeometry args={[13, 0.06, 4]} /><meshStandardMaterial color={worldId === 'mars' ? '#ae8066' : '#403e3a'} roughness={0.6} /></mesh>
      {terrain.map((rock, i) => <mesh key={i} position={[rock.x, -0.01 + rock.size * 0.35, rock.z]} rotation={[0, rock.rotation, 0]} castShadow={!pendulum}><dodecahedronGeometry args={[rock.size, 0]} /><meshStandardMaterial color={i % 3 === 0 ? preset.rock : preset.ground} roughness={0.92} /></mesh>)}
      {worldId === 'mars' && <MarsRidge offset={offset} color={preset.rock} />}
      {context.recipe.activityId === 'rover-ramp' && <RoverRamp offset={offset} />}
      {context.recipe.activityId === 'rover-ramp' && <Rover context={context} worldKey={worldKey} offset={offset} />}
      {context.recipe.activityId === 'projectile' && <Projectile context={context} worldKey={worldKey} offset={offset} recipe={context.recipe} />}
      {context.recipe.activityId === 'pendulum' && <Pendulum context={context} worldKey={worldKey} anchorX={offset} length={context.recipe.params.lengthM} />}
      <TrajectoryPoints context={context} worldKey={worldKey} offset={offset} color={worldKey === 'earth' ? '#ecf0f2' : '#53b5f3'} dashed={worldKey === 'earth'} />
      <ScaleReference offset={offset} />
    </>
  );
}

function seeded(seed: number) { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
function MarsRidge({ offset, color }: { offset: number; color: string }) { return <group position={[offset, 0, -18]}>{[0, 1, 2].map((i) => <mesh key={i} position={[i * 12 - 8, 0.65 + (i % 2) * 0.15, -8]} rotation={[0, i * 0.3, 0]}><coneGeometry args={[6.5, 2.1 + i % 2 * 0.4, 8]} /><meshStandardMaterial color={color} roughness={1} /></mesh>)}</group>; }
function RoverRamp({ offset }: { offset: number }) { return <group position={[offset, 0, 0]}><mesh position={[-1.6, 0.18, 0]} rotation={[0, 0, -0.25]}><boxGeometry args={[2.9, 0.16, 1.65]} /><meshStandardMaterial color="#7b7770" roughness={0.68} /></mesh><mesh position={[-3.3, 0.13, 0]}><boxGeometry args={[0.22, 0.4, 1.85]} /><meshStandardMaterial color="#d7a853" metalness={0.6} roughness={0.4} /></mesh><mesh position={[3.7, 0.035, 0]}><boxGeometry args={[4.6, 0.07, 2.3]} /><meshStandardMaterial color="#395968" roughness={0.8} /></mesh><mesh position={[3.7, 0.08, 0]}><boxGeometry args={[0.035, 0.02, 2.3]} /><meshStandardMaterial color="#c2d9e2" emissive="#476473" emissiveIntensity={0.6} /></mesh></group>; }
function Rover({ context, worldKey, offset }: { context: EngineContext; worldKey: WorldKey; offset: number }) { const root = useRef<THREE.Group>(null!); useFrame(() => { const s = context.runtime.current[worldKey]; if (!root.current || !s) return; root.current.position.set(s.position[0] + offset, s.position[1], 0); root.current.rotation.z = Math.atan2(s.velocity[1], Math.max(0.001, s.velocity[0])); }); return <group ref={root}><mesh position={[0, 0.04, 0]} castShadow><boxGeometry args={[0.75, 0.2, 0.58]} /><meshStandardMaterial color="#e5a642" metalness={0.42} roughness={0.42} /></mesh><mesh position={[-0.06, 0.18, 0]} castShadow><boxGeometry args={[0.48, 0.13, 0.46]} /><meshStandardMaterial color="#d9dce0" metalness={0.48} roughness={0.3} /></mesh><mesh position={[0.18, 0.36, 0]} rotation={[0, 0, 0.2]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.36, 10]} /><meshStandardMaterial color="#959ca1" metalness={0.6} roughness={0.28} /></mesh><mesh position={[0.2, 0.56, 0]} castShadow><sphereGeometry args={[0.1, 16, 12]} /><meshStandardMaterial color="#dbe4ea" metalness={0.38} roughness={0.25} /></mesh>{[-0.26, 0, 0.26].flatMap((x) => [-1, 1].map((side) => <group key={`${x}-${side}`} position={[x, -0.02, side * 0.34]} rotation={[Math.PI / 2, 0, 0]}><mesh castShadow><cylinderGeometry args={[0.17, 0.17, 0.1, 18]} /><meshStandardMaterial color="#25292d" roughness={0.86} /></mesh><mesh><cylinderGeometry args={[0.092, 0.092, 0.105, 16]} /><meshStandardMaterial color="#c3c7c9" metalness={0.62} roughness={0.3} /></mesh></group>))}<mesh position={[-0.12, 0.28, -0.31]} rotation={[0, 0, 0.12]} castShadow><boxGeometry args={[0.34, 0.045, 0.26]} /><meshStandardMaterial color="#25394a" metalness={0.22} roughness={0.28} /></mesh></group>; }
function Projectile({ context, worldKey, offset, recipe }: { context: EngineContext; worldKey: WorldKey; offset: number; recipe: ExperimentRecipe }) { const mesh = useRef<THREE.Mesh>(null!); const sphere = recipe.activityId === 'projectile' && recipe.params.objectId === 'sphere'; useFrame(() => { const s = context.runtime.current[worldKey]; if (s && mesh.current) mesh.current.position.set(s.position[0] + offset, s.position[1], 0); }); return <mesh ref={mesh} position={[offset, startPosition(recipe)[1], 0]} castShadow>{sphere ? <sphereGeometry args={[0.18, 28, 20]} /> : <boxGeometry args={[0.5, 0.32, 0.32]} />}<meshStandardMaterial color={sphere ? '#d6e5ec' : '#d18a4d'} metalness={0.26} roughness={sphere ? 0.23 : 0.63} /></mesh>; }
function Pendulum({ context, worldKey, anchorX, length }: { context: EngineContext; worldKey: WorldKey; anchorX: number; length: number }) { const root = useRef<THREE.Group>(null!); useFrame(() => { const s = context.runtime.current[worldKey]; if (s && root.current) root.current.rotation.z = -(s.angle ?? 0); }); return <group ref={root} position={[anchorX, 4.2, 0]}><mesh position={[0, -length / 2, 0]} castShadow><cylinderGeometry args={[0.018, 0.018, length, 8]} /><meshStandardMaterial color="#d8c89e" metalness={0.5} roughness={0.35} /></mesh><mesh position={[0, -length, 0]} castShadow><sphereGeometry args={[0.16, 24, 16]} /><meshStandardMaterial color="#c6d0d7" metalness={0.7} roughness={0.24} /></mesh><mesh position={[0, 0.05, 0]}><sphereGeometry args={[0.09, 12, 10]} /><meshStandardMaterial color="#f2c76c" metalness={0.55} /></mesh></group>; }
function WindObject({ objectId, offset }: { objectId: 'sphere' | 'plate'; offset: number }) { return <group position={[offset, 1.35, 0]}>{Array.from({ length: 13 }, (_, i) => <mesh key={i} position={[-3.3 + (i % 5) * 0.35, -0.75 + Math.floor(i / 5) * 0.68, 0]}><boxGeometry args={[3.5, 0.012, 0.012]} /><meshBasicMaterial color="#9ed8ef" transparent opacity={0.48} /></mesh>)}<mesh castShadow>{objectId === 'sphere' ? <sphereGeometry args={[0.36, 24, 18]} /> : <boxGeometry args={[0.22, 0.9, 0.9]} />}<meshStandardMaterial color="#dce8ec" metalness={0.35} roughness={0.28} /></mesh></group>; }
function TrajectoryPoints({ context, worldKey, offset, color, dashed }: { context: EngineContext; worldKey: WorldKey; offset: number; color: string; dashed: boolean }) {
  const line = useRef<THREE.Line | null>(null);
  if (line.current === null) {
    const material = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.76 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.96 });
    line.current = new THREE.Line(createTrajectoryGeometry(), material);
  }
  const length = useRef(0);
  useEffect(() => {
    const object = line.current;
    return () => {object?.geometry.dispose(); if(object) {const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose());}};
  }, []);
  useFrame(() => {
    const points = context.runtime.current[worldKey]?.trajectory;
    if (!points || points.length < 2 || points.length === length.current) return;
    const current = line.current;
    if (!current) return;
    updateTrajectoryGeometry(current.geometry, points, offset);
    current.frustumCulled = false;
    if (dashed) current.computeLineDistances();
    length.current = points.length;
  });
  return <primitive object={line.current} />;
}
function ScaleReference({ offset }: { offset: number }) { return <group position={[offset + 5.3, 0.02, -1.65]}><mesh position={[0.5, 0.02, 0]}><boxGeometry args={[1, 0.035, 0.055]} /><meshBasicMaterial color="#e8ecee" /></mesh>{[0, 0.5, 1].map((x) => <mesh key={x} position={[x, 0.075, 0]}><boxGeometry args={[0.025, 0.13, 0.07]} /><meshBasicMaterial color="#e8ecee" /></mesh>)}</group>; }

function SimulationEngine({ context }: { context: EngineContext }) {
  const elapsed = useRef(0);
  const runIds = useRef<Partial<Record<WorldKey, string>>>({});
  const runStarted = useRef(false);
  const completedOnce = useRef(false);
  const compareWorld = context.recipe.worldId === 'earth' ? 'moon' : 'earth';
  const duration = ACTIVITIES[context.recipe.activityId].durationLimitS;
  const publish = useCallback((key: WorldKey, immediate = false) => {
    const runtime = context.runtime.current[key];
    if (!runtime) return;
    const world = key === 'earth' ? compareWorld : context.recipe.worldId;
    const adjustedPosition: [number, number, number] = [...runtime.position];
    if (!immediate && runtime.tick % 6 !== 0) return;
    context.onSample({ timeS: runtime.elapsedS, positionM: adjustedPosition, velocityMps: [...runtime.velocity], dragN: dragFor(context.recipe, world, runtime.velocity), angleRad: runtime.angle }, world);
  }, [context, compareWorld]);
  const completeOne = useCallback((key: WorldKey) => {
    const runtime = context.runtime.current[key];
    if (!runtime || runtime.emitted) return;
    runtime.emitted = true;
    const worldId = key === 'earth' ? compareWorld : context.recipe.worldId;
    const recipe = { ...context.recipe, worldId } as ExperimentRecipe;
    const metrics: RunSummary['metrics'] = {};
    let termination: RunSummary['termination'] = runtime.contact ? 'contact' : 'timeout';
    if (recipe.activityId === 'wind-tunnel') {
      const q = 0.5 * WORLDS[worldId].gasDensityKgM3 * recipe.params.windSpeedMps ** 2;
      metrics.dynamicPressurePa = q;
      metrics.dragN = dragFor(recipe, worldId, [0, 0, 0]);
      termination = 'manual';
    } else if (recipe.activityId === 'pendulum') {
      const intervals = runtime.crossings.slice(2).map((time, i) => time - runtime.crossings[i]);
      if (intervals.length) metrics.periodS = intervals.reduce((sum, period) => sum + period, 0) / intervals.length;
      termination = runtime.crossings.length >= 7 ? 'cycles' : 'timeout';
    } else if (runtime.contact) {
      metrics.flightTimeS = runtime.elapsedS;
      metrics.rangeM = Math.max(0, runtime.position[0]);
      metrics.peakHeightM = Math.max(0, runtime.maxHeight);
      metrics.impactSpeedMps = Math.hypot(...runtime.velocity);
    }
    context.onComplete({ runId: runIds.current[key] ?? runUuid(), revision: context.revision, recipe, modelVersion: MODEL_VERSION, elapsedS: runtime.elapsedS, termination, metrics, assumptions: ACTIVITIES[recipe.activityId].assumptions });
    publish(key, true);
  }, [context, compareWorld, publish]);
  const startRun = useCallback(() => {
    elapsed.current = 0;
    runStarted.current = true;
    completedOnce.current = false;
    const keys: WorldKey[] = context.comparison ? ['active', 'earth'] : ['active'];
    for (const key of keys) {
      context.runtime.current[key] = emptyRuntime(context.recipe);
      context.worlds.current[key]?.reset();
      runIds.current[key] = runUuid();
    }
    context.onStatus('running');
    for (const key of keys) publish(key, true);
    if (context.recipe.activityId === 'wind-tunnel') {
      for (const key of keys) completeOne(key);
      context.running.current = false;
      context.onStatus('completed');
    }
  }, [context, completeOne, publish]);
  const doReset = useCallback(() => {
    context.running.current = false;
    context.accumulator.current = 0;
    elapsed.current = 0;
    runStarted.current = false;
    completedOnce.current = false;
    for (const key of ['active', 'earth'] as const) {
      context.runtime.current[key] = emptyRuntime(context.recipe);
      context.worlds.current[key]?.reset();
      delete runIds.current[key];
    }
    context.onStatus('ready');
    publish('active', true);
  }, [context, publish]);
  function singleStep() {
    if (!runStarted.current) startRun();
    context.running.current = false;
    advanceTick(true);
    if (!completedOnce.current) context.onStatus('paused');
  }

  function advanceTick(immediate: boolean) {
    if (elapsed.current >= duration) return;
    const keys: WorldKey[] = context.comparison ? ['active', 'earth'] : ['active'];
    elapsed.current += FIXED_DT;
    for (const key of keys) {
      const api = context.worlds.current[key];
      const runtime = context.runtime.current[key];
      if (!api || !runtime || runtime.emitted) continue;
      const before = api.read();
      api.step(FIXED_DT);
      const previousAngle = runtime.angle;
      const reading = api.read();
      runtime.tick += 1;
      runtime.elapsedS = elapsed.current;
      runtime.position = reading.position;
      runtime.velocity = reading.velocity;
      runtime.angle = reading.angle;
      const groundOffset = contactHeight(context.recipe);
      runtime.maxHeight = Math.max(runtime.maxHeight, reading.position[1] - groundOffset);
      if (recipeIsPendulum(context.recipe) && previousAngle !== null && runtime.angle !== null) {
        if (previousAngle * runtime.angle <= 0 && Math.abs(previousAngle - runtime.angle) > 0.00001) {
          const fraction = Math.abs(previousAngle) / (Math.abs(previousAngle) + Math.abs(runtime.angle));
          runtime.crossings.push(elapsed.current - FIXED_DT + FIXED_DT * fraction);
        }
      }
      if (runtime.tick % 6 === 0 || immediate) runtime.trajectory.push(reading.position);
      const contactCenterHeight = contactHeight(context.recipe);
      const madeContact = context.recipe.activityId !== 'pendulum' && context.recipe.activityId !== 'wind-tunnel' && before.position[1] > contactCenterHeight && reading.position[1] <= contactCenterHeight + 0.003 && runtime.tick > 1;
      if (madeContact && !runtime.contact) {
      const world = key === 'earth' ? compareWorld : context.recipe.worldId;
      const gravity = WORLDS[world].gravityMps2;
        const fraction = Math.max(0, Math.min(1, (before.position[1] - contactCenterHeight) / Math.max(before.position[1] - reading.position[1], Number.EPSILON)));
        runtime.contact = true;
        runtime.velocity = [before.velocity[0] + (reading.velocity[0] - before.velocity[0]) * fraction, before.velocity[1] - gravity * FIXED_DT * fraction, before.velocity[2] + (reading.velocity[2] - before.velocity[2]) * fraction];
        runtime.elapsedS = elapsed.current - FIXED_DT + FIXED_DT * fraction;
        runtime.position[0] = before.position[0] + (reading.position[0] - before.position[0]) * fraction;
        runtime.position[1] = contactCenterHeight;
        api.freeze(runtime.position);
      }
      const hasEnded = runtime.contact || runtime.elapsedS >= duration || (recipeIsPendulum(context.recipe) && runtime.crossings.length >= 7);
      publish(key, immediate || hasEnded);
      if (hasEnded) completeOne(key);
    }
    const allDone = keys.every((key) => context.runtime.current[key]?.emitted);
    if (allDone && !completedOnce.current) {
      completedOnce.current = true;
      context.running.current = false;
      context.onStatus('completed');
    }
  }

  useFrame((_state, delta) => {
    if (document.visibilityState === 'hidden') {
      if (context.running.current) { context.running.current = false; context.onStatus('paused'); }
      context.accumulator.current = 0;
    }
    const command = context.action.current;
    context.action.current = null;
    if (command === 'run') {
      if (!runStarted.current || completedOnce.current) startRun();
      context.running.current = true;
    } else if (command === 'pause') {
      context.running.current = false;
      context.accumulator.current = 0;
      context.onStatus(runStarted.current ? 'paused' : 'ready');
    } else if (command === 'reset') doReset();
    else if (command === 'step') singleStep();
    if (!context.running.current) return;
    context.accumulator.current += Math.min(delta, 0.1);
    let steps = 0;
    while (context.accumulator.current >= FIXED_DT && steps < 6 && context.running.current) {
      advanceTick(false);
      context.accumulator.current -= FIXED_DT;
      steps += 1;
    }
  });
  return null;
}

const recipeIsPendulum = (recipe: ExperimentRecipe) => recipe.activityId === 'pendulum';

function ErrorBoundary({ children, onError, recipe }: { children: React.ReactNode; onError: (message: string) => void; recipe: ExperimentRecipe }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <NumericFallback recipe={recipe} />;
  return <BoundaryCatcher onCatch={(error) => { setFailed(true); onError(error); }}>{children}</BoundaryCatcher>;
}
class BoundaryCatcher extends React.Component<{ children: React.ReactNode; onCatch: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onCatch(`3D scene failed: ${error.message}`); }
  render() { return this.state.failed ? null : this.props.children; }
}

function NumericFallback({ recipe }: { recipe: ExperimentRecipe }) {
  const world = WORLDS[recipe.worldId];
  let result: string[] = [];
  let label = 'Reference values';
  if (recipe.activityId === 'wind-tunnel') {
    const coefficient = recipe.params.objectId === 'sphere' ? 0.47 : 1.28;
    const pressure = 0.5 * world.gasDensityKgM3 * recipe.params.windSpeedMps ** 2;
    result = [`Dynamic pressure ${pressure.toFixed(2)} Pa`, `Drag force ${(pressure * coefficient * recipe.params.areaM2).toFixed(3)} N`];
  } else if (recipe.activityId === 'pendulum') {
    label = 'Small-angle reference';
    result = [`Period ${(2 * Math.PI * Math.sqrt(recipe.params.lengthM / world.gravityMps2)).toFixed(3)} s`, 'Large-angle and damping effects are omitted.'];
  } else if (recipe.activityId === 'projectile' && recipe.params.dragEnabled) {
    label = 'Ballistic reference unavailable';
    result = ['Drag is enabled; the reference trajectory cannot represent this recipe.'];
  } else {
    const speed = recipe.activityId === 'rover-ramp' ? recipe.params.launchSpeedMps : recipe.params.speedMps;
    const angleDeg = recipe.activityId === 'rover-ramp' ? recipe.params.launchAngleDeg : recipe.params.angleDeg;
    const height = recipe.activityId === 'rover-ramp' ? 0.3 : recipe.params.releaseHeightM;
    const angle = angleDeg * Math.PI / 180;
    const vy = speed * Math.sin(angle);
    const time = (vy + Math.sqrt(vy * vy + 2 * world.gravityMps2 * height)) / world.gravityMps2;
    result = [`Vacuum airtime ${(time).toFixed(2)} s`, `Vacuum range ${(speed * Math.cos(angle) * time).toFixed(2)} m`, `Reference gravity ${world.gravityMps2.toFixed(3)} m/s²`];
    label = recipe.activityId === 'rover-ramp' ? 'Controlled-launch ballistic estimate' : 'Vacuum reference estimate';
  }
  return <div role="status" style={{ height: '100%', overflow: 'auto', background: '#111316', color: '#f4f5f6', padding: '22px 24px', font: '13px/1.55 Inter, system-ui, sans-serif' }}><strong style={{ fontSize: 16 }}>3D scene unavailable</strong><p style={{ color: '#b8c0c4', maxWidth: 520 }}>WebGL or the local physics engine could not start. A browser with WebGL is required for a measured Rapier run.</p><div style={{ borderTop: '1px solid #41474a', paddingTop: 12, marginTop: 16 }}><strong>{label}</strong>{result.map((line) => <div key={line}>{line}</div>)}<div style={{ color: '#90999d', marginTop: 8 }}>World reference: g = {world.gravityMps2} m/s² · gas density = {world.gasDensityKgM3} kg/m³</div></div></div>;
}

export const SimulationView = forwardRef<SimulationHandle, SimulationViewProps>(function SimulationView(props, ref) {
  const action = useRef<Action>(null);
  const running = useRef(false);
  const accumulator = useRef(0);
  const worlds = useRef<Partial<Record<WorldKey, WorldApi>>>({});
  const runtime = useRef<Partial<Record<WorldKey, RuntimeState>>>({ active: emptyRuntime(props.recipe), earth: emptyRuntime(props.recipe) });
  const controls = useRef<{ reset: () => void; target: THREE.Vector3; update: () => void } | null>(null);
  const [follow, setFollow] = useState(props.recipe.activityId === 'rover-ramp');
  const { onStatus } = props;
  const onReady = useCallback(() => onStatus('ready'), [onStatus]);
  const context: EngineContext = { ...props, action, running, accumulator, worlds, runtime, onReady };
  useImperativeHandle(ref, () => ({
    run: () => { action.current = 'run'; },
    pause: () => { action.current = 'pause'; },
    reset: () => { action.current = 'reset'; },
    step: () => { action.current = 'step'; },
    resetCamera: () => {
      controls.current?.reset();
    },
  }), []);
  useEffect(() => {
    runtime.current = { active: emptyRuntime(props.recipe), earth: emptyRuntime(props.recipe) };
    setFollow(props.recipe.activityId === 'rover-ramp');
  }, [props.recipe, props.revision]);
  const activeWorld = props.recipe.worldId;
  const comparisonWorld: WorldId = activeWorld === 'earth' ? 'moon' : 'earth';
  const renderDensity = props.quality === 'high' ? [1, 1.5] as [number, number] : [1, 1] as [number, number];
  const activePreset = WORLDS[activeWorld].visualPreset;
  const scene = (
    <Canvas shadows={props.quality === 'high'} dpr={renderDensity} camera={{ position: props.comparison ? [0, 10.5, 34] : props.recipe.activityId === 'rover-ramp' ? [3.8, 3.4, 8.5] : [3.8, 5.1, 10.5], fov: 38, near: 0.1, far: 120 }} gl={{ antialias: props.quality === 'high', powerPreference: 'high-performance' }} fallback={<p>WebGL is required for the 3D view. Enable WebGL or use a compatible browser.</p>}>
      <color attach="background" args={[activePreset.sky]} />
      {activeWorld !== 'moon' && <fog attach="fog" args={[activePreset.sky, 24, 65]} />}
      {activeWorld === 'moon' && <Stars radius={65} depth={20} count={900} factor={2} saturation={0} fade speed={0} />}
      <ambientLight intensity={activeWorld === 'moon' ? 0.18 : 0.55} />
      <directionalLight position={[3, 13, 8]} intensity={activeWorld === 'moon' ? 2.5 : 1.8} castShadow shadow-mapSize={[1024, 1024]} />
      {props.comparison ? <>
        <WorldPhysics context={context} worldKey="active" worldId={activeWorld} offset={-7} />
        <WorldPhysics context={context} worldKey="earth" worldId={comparisonWorld} offset={7} />
        <WorldScene context={context} worldKey="active" worldId={activeWorld} offset={-7} />
        <WorldScene context={context} worldKey="earth" worldId={comparisonWorld} offset={7} />
      </> : <>
        <WorldPhysics context={context} worldKey="active" worldId={activeWorld} offset={0} />
        <WorldScene context={context} worldKey="active" worldId={activeWorld} offset={0} />
      </>}
      <OrbitControls ref={controls as never} makeDefault enableDamping dampingFactor={0.08} target={props.comparison ? [0, 1.4, 0] : [0, props.recipe.activityId === 'pendulum' ? 2.2 : 0.8, 0]} minDistance={3} maxDistance={44} maxPolarAngle={Math.PI * 0.49} />
      <CameraTracker controls={controls} context={context} activeOffset={props.comparison ? -7 : 0} follow={follow} />
      <SimulationEngine context={context} />
    </Canvas>
  );
  const windMetrics = props.recipe.activityId === 'wind-tunnel' ? {
    drag: dragFor(props.recipe, props.recipe.worldId, [0, 0, 0]),
    pressure: 0.5 * WORLDS[props.recipe.worldId].gasDensityKgM3 * props.recipe.params.windSpeedMps ** 2,
  } : null;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background: '#101216', overflow: 'hidden', borderRadius: 12 }}>
      <ErrorBoundary recipe={props.recipe} onError={props.onError}>{scene}</ErrorBoundary>
      <div style={{ position: 'absolute', inset: 'auto auto 12px 12px', maxWidth: 'calc(100% - 84px)', padding: '8px 10px', borderRadius: 7, background: '#101216dc', color: '#f3f5f6', font: '500 12px/1.5 Inter, system-ui, sans-serif', letterSpacing: '.02em' }}>
        {props.recipe.activityId === 'rover-ramp' && 'Controlled launch. Suspension and drivetrain not modelled.'}
        {props.recipe.activityId === 'wind-tunnel' && `Illustrative airflow · ρ ${WORLDS[props.recipe.worldId].gasDensityKgM3.toFixed(3)} kg/m³ · Cd ${props.recipe.params.objectId === 'sphere' ? '0.47' : '1.28'} · drag ${windMetrics?.drag.toFixed(3)} N · q ${windMetrics?.pressure.toFixed(2)} Pa`}
        {props.recipe.activityId === 'pendulum' && `Fixed pivot · ${props.recipe.params.lengthM.toFixed(1)} m string · ${props.recipe.params.bobMassKg.toFixed(1)} kg bob`}
        {props.comparison && <div style={{ marginTop: 5, color: '#b7c2c8' }}>Shared backdrop; independent physics · {activeWorld.toUpperCase()} vs {comparisonWorld.toUpperCase()}</div>}
      </div>
      <div style={{ position: 'absolute', right: 12, top: 10, display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => setFollow((value) => !value)} aria-pressed={follow} style={cameraButton}>{follow ? 'Following' : 'Follow object'}</button>
      </div>
    </div>
  );
});

const cameraButton: React.CSSProperties = { minHeight: 44, border: '1px solid #70777b', borderRadius: 6, padding: '8px 10px', background: '#16191cdd', color: '#f3f5f6', font: '500 12px Inter, system-ui, sans-serif', cursor: 'pointer' };
function CameraTracker({ controls, context, activeOffset, follow }: { controls: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>; context: EngineContext; activeOffset: number; follow: boolean }) {
  useFrame(() => {
    if (!follow || !controls.current) return;
    const state = context.runtime.current.active;
    if (!state) return;
    controls.current.target.set(state.position[0] + activeOffset, Math.max(0.9, state.position[1]), 0);
    controls.current.update();
  });
  return null;
}
