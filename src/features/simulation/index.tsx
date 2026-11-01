'use client';
import {forwardRef, useImperativeHandle} from 'react';
import type {ExperimentRecipe, RunStatus, TelemetrySample, RunSummary, WorldId} from '@/domain';
export type SimulationViewProps = {recipe: ExperimentRecipe; revision: number; comparison: boolean; quality: 'low'|'high'; onStatus: (status: RunStatus)=>void; onSample: (sample: TelemetrySample, worldId: WorldId)=>void; onComplete: (summary: RunSummary)=>void; onError: (message: string)=>void};
export type SimulationHandle = {run(): void; pause(): void; reset(): void; step(): void; resetCamera(): void};
export const SimulationView = forwardRef<SimulationHandle, SimulationViewProps>(function SimulationView(_props, ref) {
  useImperativeHandle(ref, () => ({run(){},pause(){},reset(){},step(){},resetCamera(){}}));
  return <div role="status">Simulation foundation ready. Physics module pending.</div>;
});
