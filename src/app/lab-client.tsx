'use client';
import dynamic from 'next/dynamic';
import {useEffect, useRef} from 'react';
import {LabShell} from '@/components/lab/lab-shell';
import {persistDraft, restoreDraft, useLabStore} from '@/state/lab-store';
import type {SimulationHandle} from '@/features/simulation';
const SimulationHost = dynamic(() => import('./simulation-host'), {ssr: false, loading: () => <div className="scene-loading" role="status">Preparing your experiment…</div>});
export default function LabClient() {
  const camera = useRef<SimulationHandle | null>(null);
  const revision = useLabStore(s => s.revision);
  useEffect(() => {
    const result = restoreDraft();
    if(result === 'invalid') useLabStore.getState().setError('Saved draft could not be restored. Original data remains in browser storage. Reset to start fresh.');
    return persistDraft();
  }, []);
  return <LabShell onResetCamera={() => camera.current?.resetCamera()}><SimulationHost key={revision} cameraRef={camera}/></LabShell>;
}
