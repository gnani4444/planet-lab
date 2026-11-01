'use client';
import {useCallback, useEffect, useRef, useState, type MutableRefObject} from 'react';
import {SimulationView, type SimulationHandle} from '@/features/simulation';
import {useLabStore} from '@/state/lab-store';
import type {RunStatus, RunSummary, TelemetrySample, WorldId} from '@/domain';

export default function SimulationHost({cameraRef}: {cameraRef: MutableRefObject<SimulationHandle | null>}) {
  const recipe = useLabStore(s => s.recipe);
  const revision = useLabStore(s => s.revision);
  const comparison = useLabStore(s => s.comparison);
  const transport = useLabStore(s => s.transport);
  const [quality, setQuality] = useState<'low' | 'high'>('high');
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 767px)');
    const update = () => setQuality(narrow.matches ? 'low' : 'high');
    update(); narrow.addEventListener('change', update);
    return () => narrow.removeEventListener('change', update);
  }, []);
  const handle = useRef<SimulationHandle | null>(null);
  const active = useRef(true);
  useEffect(() => {active.current = true; return () => {active.current = false; cameraRef.current = null;};}, [cameraRef]);
  const bindHandle = useCallback((value: SimulationHandle | null) => {handle.current = value; cameraRef.current = value;}, [cameraRef]);
  useEffect(() => {
    const scene = handle.current; if(!scene) return;
    if(transport.action === 'run') scene.run();
    else if(transport.action === 'pause') scene.pause();
    else if(transport.action === 'step') scene.step();
    else scene.reset();
  }, [transport.sequence, transport.action]);
  const current = useCallback(() => active.current && useLabStore.getState().revision === revision, [revision]);
  const onSample = useCallback((sample: TelemetrySample, world: WorldId) => {if(current()) useLabStore.getState().acceptSample(sample, world, revision);}, [current, revision]);
  const onComplete = useCallback((summary: RunSummary) => {if(current()) useLabStore.getState().acceptSummary(summary);}, [current]);
  const onStatus = useCallback((status: RunStatus) => {if(current()) useLabStore.getState().setStatus(status, revision);}, [current, revision]);
  const onError = useCallback((message: string) => {if(current()) {useLabStore.getState().setError(message); useLabStore.getState().setStatus('error', revision);}}, [current, revision]);
  return <SimulationView ref={bindHandle} recipe={recipe} revision={revision} comparison={comparison} quality={quality} onSample={onSample} onComplete={onComplete} onStatus={onStatus} onError={onError}/>;
}
