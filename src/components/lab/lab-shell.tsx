'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Check, ChevronDown, CircleHelp, Clock3, Compass, ExternalLink,
  Database, GitCompareArrows, Globe2, LoaderCircle, Menu, Pause, Play, RotateCcw, Save, Settings2, SkipForward,
  SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import { ACTIVITIES, WORLDS } from '@/data';
import { METRICS, type ActivityId, type ExperimentRecipe, type MetricId, type ParameterDescriptor, type SavedExperiment, type TelemetrySample, type WorldId } from '@/domain';
import { AssistantPanel } from './assistant-panel';
import { FeatureTour, TOUR_STORAGE_KEY } from './feature-tour';
import { DRAFT_KEY, useLabStore } from '@/state/lab-store';
import { cloudConfigured } from '@/lib/supabase/browser';
import { deleteExperiment, listExperiments, loadExperiment, saveExperiment } from '@/lib/persistence/experiments';

type LabShellProps = { children: ReactNode; onResetCamera?: () => void };
type MobileTab = 'setup' | 'results' | 'ask';
const activityOrder: ActivityId[] = ['rover-ramp', 'projectile', 'pendulum', 'wind-tunnel', 'free-fall', 'bounce'];
const worldOrder: WorldId[] = ['earth', 'moon', 'mars', 'mercury', 'venus', 'titan'];

function ActivitySketch({ activity, selected }: { activity: ActivityId; selected: boolean }) {
  const stroke = selected ? '#dfeef9' : '#999';
  return <svg className="activity-sketch" viewBox="0 0 88 48" role="img" aria-label={`${ACTIVITIES[activity].name} preview`}>
    <path d="M6 39.5h76" stroke="#464646" strokeWidth="1" />
    {activity === 'rover-ramp' && <g stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round"><path d="m12 37 25-11 16 0 15 11"/><path d="M28 30h25l7 7H21z" fill="#30363a"/><circle cx="29" cy="38" r="4" fill="#16191c"/><circle cx="53" cy="38" r="4" fill="#16191c"/><path d="m17 18 13 6m-7-11 13 9" stroke="#d36c4c"/></g>}
    {activity === 'projectile' && <g stroke={stroke} strokeWidth="1.5" fill="none"><path d="M13 38Q40 2 74 24" strokeDasharray="3 4"/><circle cx="49" cy="16" r="6" fill="#343a3f"/><path d="M12 38h63"/></g>}
    {activity === 'pendulum' && <g stroke={stroke} strokeWidth="1.5" fill="none"><path d="M25 10h38M44 10v23"/><path d="M44 10 58 31" stroke="#b7cddd"/><circle cx="58" cy="34" r="6" fill="#42515a"/><circle cx="44" cy="10" r="2" fill="#ddd"/><path d="M37 16a11 11 0 0 1 17 1" stroke="#6994b2" strokeDasharray="2 3"/></g>}
    {activity === 'wind-tunnel' && <g stroke={stroke} strokeWidth="1.5" fill="none"><path d="M11 14h46a8 8 0 0 1 0 16H33m-22-8h14m-14 8h13"/><circle cx="63" cy="22" r="7" fill="#3c4449"/><path d="M63 15v14m-7-7h14" stroke="#b9c3c7"/></g>}
    {activity === 'free-fall' && <g stroke={stroke} strokeWidth="1.5" fill="none"><path d="M24 8v27m-4-4 4 5 4-5M38 9h23"/><circle cx="50" cy="16" r="5" fill="#42515a"/><path d="M50 24v9m-4-4 4 5 4-5" strokeDasharray="2 2"/></g>}
    {activity === 'bounce' && <g stroke={stroke} strokeWidth="1.5" fill="none"><path d="M20 10v24q12 11 24-10t24 12" strokeDasharray="3 3"/><circle cx="20" cy="10" r="5" fill="#42515a"/><circle cx="51" cy="22" r="4" fill="#30363a"/><path d="M13 39h63"/></g>}
  </svg>;
}

function metricValue(value: number | undefined, metricId: MetricId) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(METRICS[metricId].precision)} ${METRICS[metricId].unit}`;
}
function sampleMetric(recipe: ExperimentRecipe, sample: TelemetrySample | undefined) {
  if (!sample) return null;
  if (recipe.activityId === 'pendulum' && sample.angleRad !== null) return { label: 'Angle', value: `${(sample.angleRad * 180 / Math.PI).toFixed(1)}°`, time: sample.timeS };
  if (recipe.activityId === 'wind-tunnel' && sample.dragN !== null) return { label: 'Drag force', value: `${sample.dragN.toFixed(3)} N`, time: sample.timeS };
  const speed = Math.hypot(...sample.velocityMps);
  return { label: 'Speed', value: `${speed.toFixed(2)} m/s`, time: sample.timeS };
}
function chartY(recipe: ExperimentRecipe, sample: TelemetrySample) {
  if (recipe.activityId === 'pendulum') return sample.angleRad === null ? null : sample.angleRad * 180 / Math.PI;
  if (recipe.activityId === 'wind-tunnel') return sample.dragN;
  return sample.positionM[1];
}
function chartLabel(recipe: ExperimentRecipe) {
  if (recipe.activityId === 'pendulum') return { title: 'Angle over time', unit: '°' };
  if (recipe.activityId === 'wind-tunnel') return { title: 'Calculated reference drag', unit: 'N' };
  if (recipe.activityId === 'free-fall' || recipe.activityId === 'bounce') return { title: 'Height over time', unit: 'm' };
  return { title: 'Measured trajectory', unit: 'm' };
}
type ChartPoint = {x:number;y:number};
type ChartDomain = {minX:number;maxX:number;minY:number;maxY:number};
function chartPoints(samples: TelemetrySample[], recipe: ExperimentRecipe): ChartPoint[] {
  return samples.map(s => ({ x: recipe.activityId === 'rover-ramp' || recipe.activityId === 'projectile' ? s.positionM[0] : s.timeS, y: chartY(recipe, s) }))
    .filter((p): p is ChartPoint => p.y !== null && Number.isFinite(p.x) && Number.isFinite(p.y));
}
function sharedDomain(groups: ChartPoint[][]): ChartDomain | null {
  const all = groups.flat(); if (all.length < 2) return null;
  const minX = Math.min(...all.map(p => p.x)); const maxX = Math.max(...all.map(p => p.x));
  const minY = Math.min(0, ...all.map(p => p.y)); const maxY = Math.max(minY + 0.01, ...all.map(p => p.y));
  return {minX,maxX,minY,maxY};
}
function pointsFor(clean: ChartPoint[], domain: ChartDomain | null, width: number, height: number) {
  if (!domain || clean.length < 2) return '';
  return clean.map(p => `${10 + (p.x - domain.minX) / (domain.maxX - domain.minX || 1) * (width - 20)},${height - 10 - (p.y - domain.minY) / (domain.maxY - domain.minY || 1) * (height - 22)}`).join(' ');
}

function ActivityPalette({ compact = false, active, onSelect }: { compact?: boolean; active: ActivityId; onSelect: (id: ActivityId) => void }) {
  return <section className={compact ? 'activity-palette compact' : 'activity-palette'} aria-label="Choose an activity" data-tour="activities">
    {!compact && <div className="section-heading"><h2>Activities</h2></div>}
    <div className="activity-list">
      {activityOrder.map(id => {
        const item = ACTIVITIES[id]; const selected = active === id;
        return <button className={`activity-option${selected ? ' selected' : ''}`} key={id} aria-pressed={selected} onClick={() => onSelect(id)}>
          <ActivitySketch activity={id} selected={selected} />
          <span className="activity-copy"><strong>{item.name}</strong><span>{item.description}</span></span>
          {selected && <span className="selected-mark" aria-hidden="true"><Check size={13}/></span>}
        </button>;
      })}
    </div>
  </section>;
}

function ParameterNumber({ parameter, value, update }: {parameter: ParameterDescriptor; value: number; update: (key: string, value: unknown) => void}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  const id = `parameter-${parameter.key}`;
  useEffect(() => {setDraft(String(value)); setError('');}, [value]);
  return <><div className="parameter-input-row"><input id={id} className="number-input" type="number" min={parameter.min} max={parameter.max} step={parameter.step} value={draft} aria-invalid={Boolean(error)} aria-describedby={`${id}-limits${error ? ` ${id}-error` : ''}`} onChange={event => {
    const raw = event.target.value; setDraft(raw);
    const next = Number(raw);
    if(raw !== '' && Number.isFinite(next) && next >= parameter.min && next <= parameter.max) {setError(''); update(parameter.key, next);}
    else setError(`Enter ${parameter.min}–${parameter.max} ${parameter.unit}. The experiment keeps the last valid value.`);
  }}/><span className="input-unit">{parameter.unit}</span></div>{error && <p id={`${id}-error`} className="parameter-error" role="status">{error}</p>}</>;
}

function ParameterInspector({ recipe, update }: { recipe: ExperimentRecipe; update: (key: string, value: unknown) => void }) {
  const activity = ACTIVITIES[recipe.activityId];
  const params = recipe.params as Record<string, unknown>;
  return <section className="inspector-panel" data-tour="parameters" aria-label="Experiment setup">
    <div className="section-heading"><h2>Setup</h2><SlidersHorizontal size={16} aria-hidden="true" /></div>
    <div className="parameter-list">
      {activity.parameters.map(parameter => {
        const value = params[parameter.key];
        if (typeof value !== 'number') return null;
        const id = `parameter-${parameter.key}`;
        return <div className="parameter" key={parameter.key}>
          <label htmlFor={id}><span>{parameter.label}</span><span className="parameter-unit">{parameter.unit}</span></label>
          <ParameterNumber parameter={parameter} value={value} update={update}/>
          <input className="range-input" type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={value} onChange={e => update(parameter.key, Number(e.target.value))} aria-label={`${parameter.label} slider`} />
          <div className="range-limits" id={`${id}-limits`}><span>{parameter.min} {parameter.unit}</span><span>{parameter.max} {parameter.unit}</span></div>
        </div>;
      })}
      {'objectId' in params && <label className="select-field"><span>Test object</span><select value={String(params.objectId)} onChange={e => update('objectId', e.target.value)}>{(recipe.activityId === 'projectile' ? ['sphere','brick'] : ['sphere','plate']).map(value=><option key={value} value={value}>{value === 'sphere' ? 'Sphere' : value === 'brick' ? 'Brick' : 'Plate'}</option>)}</select></label>}
      {'dragEnabled' in params && <label className="toggle-field"><span><b>Atmospheric drag</b><small>Use the world’s reference air density</small></span><input type="checkbox" checked={Boolean(params.dragEnabled)} onChange={e => update('dragEnabled', e.target.checked)} /></label>}
    </div>
    <div className="environment-card">
      <div className="environment-title"><Globe2 size={15} aria-hidden="true"/><span>Environment</span></div>
      <div className="environment-value"><span>Gravity</span><strong>{WORLDS[recipe.worldId].gravityMps2.toFixed(2)} <small>m/s²</small></strong></div>
      <div className="environment-value"><span>Gas density</span><strong>{WORLDS[recipe.worldId].gasDensityKgM3.toPrecision(3)} <small>kg/m³</small></strong></div>
      <p>{WORLDS[recipe.worldId].conditions}</p>
    </div>
    <details className="assumptions"><summary>Model assumptions <ChevronDown size={14} aria-hidden="true" /></summary><ul>{activity.assumptions.map(line => <li key={line}>{line}</li>)}</ul><a href={WORLDS[recipe.worldId].sourceUrls[0]} target="_blank" rel="noreferrer">World reference data <ExternalLink size={14}/></a></details>
  </section>;
}

function MeasurementChart({ recipe, current, earth }: { recipe: ExperimentRecipe; current: TelemetrySample[]; earth: TelemetrySample[] }) {
  const label = chartLabel(recipe); const activeData = useMemo(() => chartPoints(current, recipe), [current, recipe]);
  const earthData = useMemo(() => chartPoints(earth, recipe), [earth, recipe]);
  const domain = useMemo(() => sharedDomain([activeData,earthData]), [activeData,earthData]);
  const activePoints = useMemo(() => pointsFor(activeData, domain, 320, 104), [activeData, domain]);
  const earthPoints = useMemo(() => pointsFor(earthData, domain, 320, 104), [earthData, domain]);
  const visiblePoints = activePoints || earthPoints;
  return <section className="chart-section" aria-label={label.title}>
    <div className="chart-title"><span>{label.title}</span><div className="chart-legend"><span><i className="legend-current"/> {WORLDS[recipe.worldId].name}</span>{earth.length > 0 && <span><i className="legend-earth"/> Earth</span>}</div></div>
    {visiblePoints ? <svg className="telemetry-chart" viewBox="0 0 320 112" role="img" aria-label={`${label.title}, vertical axis in ${label.unit}`}>
      <path d="M10 12H310M10 47H310M10 82H310M10 102H310" className="chart-grid"/><path d="M10 10V102H310" className="chart-axis"/>
      {earthPoints && <polyline points={earthPoints} className="chart-line earth-line"/>}{activePoints && <polyline points={activePoints} className="chart-line active-line"/>}
      <text x="13" y="22" className="chart-unit">{domain?.maxY.toFixed(1)}</text><text x="13" y="96" className="chart-unit">{domain?.minY.toFixed(1)}</text><text x="28" y="11" className="chart-unit">{label.unit}</text><text x="10" y="109" className="chart-unit">{domain?.minX.toFixed(1)}</text><text x="268" y="109" className="chart-unit">{domain?.maxX.toFixed(1)} {recipe.activityId === 'rover-ramp' || recipe.activityId === 'projectile' ? 'x (m)' : 'time (s)'}</text>
    </svg> : <div className="chart-empty"><span className="empty-axis" aria-hidden="true"><i/></span><span>{recipe.activityId === 'wind-tunnel' && current.length > 0 ? 'One fixed wind speed. Pressure and drag are calculated from the displayed reference conditions.' : 'Run the experiment to record measured data.'}</span></div>}
    <details className="chart-table"><summary>View sample table <ChevronDown size={13}/></summary><div className="table-scroll"><table><caption className="sr-only">Measured samples from current experiment and Earth comparison</caption><thead><tr><th scope="col">World</th><th scope="col">Time (s)</th><th scope="col">Position (m)</th><th scope="col">Velocity (m/s)</th><th scope="col">Drag (N)</th></tr></thead><tbody>{current.slice(-8).map((sample, i) => <tr key={`current-${i}`}><th scope="row">{WORLDS[recipe.worldId].name}</th><td>{sample.timeS.toFixed(2)}</td><td>{sample.positionM.map(v => v.toFixed(2)).join(', ')}</td><td>{sample.velocityMps.map(v => v.toFixed(2)).join(', ')}</td><td>{sample.dragN === null ? '—' : sample.dragN.toFixed(3)}</td></tr>)}{earth.slice(-8).map((sample, i) => <tr key={`earth-${i}`}><th scope="row">Earth</th><td>{sample.timeS.toFixed(2)}</td><td>{sample.positionM.map(v => v.toFixed(2)).join(', ')}</td><td>{sample.velocityMps.map(v => v.toFixed(2)).join(', ')}</td><td>{sample.dragN === null ? '—' : sample.dragN.toFixed(3)}</td></tr>)}{current.length === 0 && earth.length === 0 && <tr><td colSpan={5}>No measured samples yet</td></tr>}</tbody></table></div></details>
  </section>;
}

function ResultsPanel() {
  const recipe = useLabStore(s => s.recipe); const status = useLabStore(s => s.status);
  const samples = useLabStore(s => s.samples); const summaries = useLabStore(s => s.summaries); const comparison = useLabStore(s => s.comparison);
  const activeSamples = samples[recipe.worldId] ?? []; const earthSamples = comparison ? samples.earth ?? [] : [];
  const summary = summaries[recipe.worldId]; const earthSummary = summaries.earth;
  const live = sampleMetric(recipe, activeSamples.at(-1)); const metricIds = ACTIVITIES[recipe.activityId].metricIds;
  return <section className="results-panel" data-tour="results" id="results-panel" role="tabpanel" tabIndex={-1} aria-labelledby="tab-results" aria-label="Measurements and results">
    <div className="results-heading"><h2>{summary ? 'Run result' : status === 'running' ? 'Live readout' : 'Measurements'}</h2><span className={`status-chip ${status}`}><i/>{status === 'running' ? 'Live' : status === 'completed' ? 'Complete' : status === 'paused' ? 'Paused' : 'Ready'}</span></div>
    <div className="measurement-row">
      {summary ? metricIds.map(id => <div className="measurement" key={id}><span>{METRICS[id].label}</span><strong>{metricValue(summary.metrics[id], id)}</strong>{comparison && <><small>Earth: {metricValue(earthSummary?.metrics[id], id)}</small>{summary.metrics[id] !== undefined && earthSummary?.metrics[id] !== undefined && <small>Δ vs Earth: {summary.metrics[id]-earthSummary.metrics[id] > 0 ? '+' : ''}{(summary.metrics[id]-earthSummary.metrics[id]).toFixed(METRICS[id].precision)} {METRICS[id].unit}</small>}</>}</div>) : <div className="measurement live-measurement"><span>{live?.label ?? 'Simulation time'}</span><strong>{live?.value ?? `${activeSamples.at(-1)?.timeS.toFixed(2) ?? '0.00'} s`}</strong><small>{live ? `at ${live.time.toFixed(2)} s` : 'No samples recorded'}</small></div>}
      {!summary && <div className="measurement"><span>Recorded samples</span><strong>{activeSamples.length}</strong><small>Measured from simulation</small></div>}
      {!summary && <div className="measurement"><span>World gravity</span><strong>{WORLDS[recipe.worldId].gravityMps2.toFixed(2)} m/s²</strong><small>Reference surface value</small></div>}
    </div>
    <MeasurementChart recipe={recipe} current={activeSamples} earth={earthSamples}/>
    {summary && <details className="result-assumptions"><summary>Run details and assumptions <ChevronDown size={13}/></summary><p>Model {summary.modelVersion} · {summary.termination} · {summary.elapsedS.toFixed(2)} simulated seconds</p><ul>{summary.assumptions.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul></details>}
  </section>;
}

function TransportControls({ compact = false, onTour }: { compact?: boolean; onTour: () => void }) {
  const status = useLabStore(s => s.status); const run = useLabStore(s => s.run); const pause = useLabStore(s => s.pause); const step = useLabStore(s => s.step); const reset = useLabStore(s => s.reset); const comparison = useLabStore(s => s.comparison); const error = useLabStore(s => s.error);
  return <div className={compact ? 'transport-controls compact' : 'transport-controls'} data-tour="controls">
    <button className="run-button" onClick={() => status === 'running' ? pause() : run()} disabled={status === 'error'}>{status === 'running' ? <><Pause size={15} fill="currentColor"/> Pause</> : <><Play size={15} fill="currentColor"/> {status === 'paused' ? 'Resume' : status === 'completed' ? 'Run again' : 'Run'}</>}</button>
    <button className="transport-button" onClick={step} disabled={status === 'running' || status === 'completed'}><SkipForward size={15}/><span>Step</span></button>
    <button className="transport-button" onClick={reset}><RotateCcw size={15}/><span>Reset</span></button>
    <button className="tour-trigger mobile-tour-trigger" type="button" onClick={onTour} aria-label="Take a tour"><CircleHelp size={15} aria-hidden="true"/> Tour</button>
    <span className="transport-readout"><Clock3 size={13}/>{status === 'running' ? 'Simulation running' : status === 'paused' ? 'Paused · state retained' : status === 'completed' ? 'Run complete' : status === 'error' ? 'Reset to recover' : 'Ready'}{comparison && <i> · Earth comparison</i>}</span>
    {error && <span className="inline-lab-error" role="status">{error}</span>}
  </div>;
}

function SavedExperimentsDialog({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const dialog = useRef<HTMLDialogElement>(null); const [items,setItems] = useState<SavedExperiment[]>([]); const [loading,setLoading] = useState(false); const [error,setError] = useState(''); const [title,setTitle] = useState(''); const recipe = useLabStore(s => s.recipe); const configure = useLabStore(s => s.configure);
  const refresh = useCallback(async () => { if(!cloudConfigured()) {setItems([]); setError('Cloud saves are unavailable. Your current draft remains in this browser.'); return;} setLoading(true); setError(''); const result = await listExperiments(); if(result.ok) setItems(result.data); else setError(result.error); setLoading(false); },[]);
  useEffect(() => { const node = dialog.current; if(!node) return; if(open && !node.open) { node.showModal(); void refresh(); } else if(!open && node.open) node.close(); }, [open,refresh]);
  const save = async (event: React.FormEvent) => { event.preventDefault(); if(!title.trim()) return; setLoading(true); setError(''); const result = await saveExperiment({title:title.trim(),recipe}); if(result.ok) { setItems(list => [result.data,...list.filter(item => item.id !== result.data.id)]); setTitle(''); } else setError(result.error); setLoading(false); };
  const load = async (id:string) => {setLoading(true); setError(''); const result = await loadExperiment(id); if(result.ok) {configure(result.data.recipe); onClose();} else setError(result.error); setLoading(false);};
  const remove = async (id:string) => {setLoading(true); setError(''); const result = await deleteExperiment(id); if(result.ok) setItems(list => list.filter(item => item.id !== id)); else setError(result.error); setLoading(false);};
  return <dialog ref={dialog} className="saved-dialog" aria-labelledby="saved-title" onCancel={onClose} onClose={onClose}>
    <div className="dialog-header"><h2 id="saved-title">Saved experiments</h2><form method="dialog"><button className="icon-button" aria-label="Close saved experiments"><X size={17}/></button></form></div>
    <p className="dialog-explainer">Cloud saves belong to this browser session. Your current setup also stays as a local draft.</p>
    <form className="save-form" onSubmit={save}><label htmlFor="experiment-title">Save current setup</label><div><input id="experiment-title" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="Name this experiment"/><button className="small-primary" disabled={loading || !title.trim() || !cloudConfigured()}><Save size={14}/> Save</button></div></form>
    {error && <p className="dialog-error" role="alert"><CircleHelp size={15}/>{error}</p>}
    <div className="saved-list-heading"><span>Saved experiments</span>{cloudConfigured() && <button onClick={() => void refresh()} disabled={loading}><RotateCcw size={13}/> Refresh</button>}</div>
    <div className="saved-list">{loading && <p className="list-message"><LoaderCircle className="spin" size={15}/> Loading saved experiments…</p>}{!loading && items.length === 0 && <p className="list-message">No saved experiments yet.</p>}{items.map(item => <article className="saved-item" key={item.id}><div><b>{item.title}</b><span>{ACTIVITIES[item.recipe.activityId].name} · {WORLDS[item.recipe.worldId].name}</span><small>Updated {new Date(item.updatedAt).toLocaleDateString()}</small></div><button onClick={() => void load(item.id)} disabled={loading} aria-label={`Load ${item.title}`}>Load</button><button className="delete-button" onClick={() => void remove(item.id)} disabled={loading} aria-label={`Delete ${item.title}`}><Trash2 size={15}/></button></article>)}</div>
    {!cloudConfigured() && <p className="cloud-note"><Database size={14}/> Cloud storage is not configured. Local experiment controls remain available.</p>}
  </dialog>;
}

function SettingsDialog({ open, onClose }: {open:boolean;onClose:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {const node=ref.current;if(!node)return;if(open&&!node.open)node.showModal();else if(!open&&node.open)node.close();},[open]);
  return <dialog ref={ref} className="settings-dialog" aria-labelledby="settings-title" onCancel={onClose} onClose={onClose}><div className="dialog-header"><h2 id="settings-title">Lab settings</h2><form method="dialog"><button className="icon-button" aria-label="Close settings"><X size={17}/></button></form></div><div className="settings-row"><span><b>Cloud persistence</b><small>Save experiments across visits</small></span><strong>{cloudConfigured() ? 'Configured' : 'Unavailable'}</strong></div><p className="settings-note">Physics and measurements remain available without an account or cloud connection.</p></dialog>;
}

function LabHeader({onSave,onSettings,onTour}:{onSave:()=>void;onSettings:()=>void;onTour:()=>void}) {
  const recipe=useLabStore(s=>s.recipe); const selectWorld=useLabStore(s=>s.selectWorld); const comparison=useLabStore(s=>s.comparison); const setComparison=useLabStore(s=>s.setComparison); const [menu,setMenu]=useState(false);
  const world=WORLDS[recipe.worldId]; const activity=ACTIVITIES[recipe.activityId];
  return <header className="lab-header"><Link className="brand" href="/" aria-label="Planet Lab home"><span className="brand-mark"><svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="7"/><ellipse cx="15" cy="15" rx="13" ry="5.6" transform="rotate(-28 15 15)"/><circle cx="25" cy="8" r="1.5" className="orbit-dot"/></svg></span><h1 className="brand-name">Planet <b>Lab</b><small>Field workbench</small></h1></Link>
    <span className="header-divider" aria-hidden="true"/><div className="header-context"><strong>{activity.name}</strong></div>
    <div className="header-world" data-tour="world"><label htmlFor="world-select"><Globe2 size={15}/><span>World</span></label><div className="world-select-wrap"><select id="world-select" value={recipe.worldId} onChange={e=>selectWorld(e.target.value as WorldId)}>{worldOrder.map(id=><option key={id} value={id}>{WORLDS[id].name}</option>)}</select><ChevronDown size={14}/></div><span className="world-conditions">{world.gravityMps2.toFixed(2)} m/s²</span></div>
    <div className="header-actions"><button type="button" className="tour-trigger" onClick={onTour} aria-label="Take a tour"><CircleHelp size={15} aria-hidden="true"/><span className="tour-trigger-label">Take a tour</span></button><button data-tour="compare" className={`compare-button${comparison?' is-active':''}`} aria-label={comparison?'Comparing with Earth':'Compare with Earth'} aria-pressed={comparison} onClick={()=>setComparison(!comparison)} disabled={recipe.worldId==='earth'} title={recipe.worldId==='earth'?'Choose another world to compare with Earth':undefined}><GitCompareArrows size={16} aria-hidden="true"/><span>{comparison?'Comparing Earth':'Compare Earth'}</span></button><button className="header-icon-button" onClick={onSave} data-tour="saved" aria-label="Saved experiments"><Save size={16}/></button><button className="header-icon-button" onClick={onSettings} data-tour="settings" aria-label="Settings"><Settings2 size={16}/></button><button className="mobile-menu-button" data-tour="activity-menu" aria-label="Open activity selection" onClick={()=>setMenu(!menu)}><Menu size={18}/></button></div>
    {menu&&<div className="mobile-activity-menu"><ActivityPalette compact active={recipe.activityId} onSelect={id=>{useLabStore.getState().selectActivity(id);setMenu(false)}}/></div>}
  </header>;
}

function SceneFrame({children,onResetCamera}:{children:ReactNode;onResetCamera?:()=>void}) {
  const recipe=useLabStore(s=>s.recipe);const comparison=useLabStore(s=>s.comparison);
  return <section className="scene-frame" aria-label="Experiment scene"><div className="scene-world-label"><span className="world-live-dot"/><div><b>{WORLDS[recipe.worldId].name}</b><small>Primary view</small></div></div>{comparison&&<div className="earth-world-label"><span className="earth-dash"/><div><b>Earth</b><small>Reference</small></div></div>}<div className="scene-content">{children}</div><div className="scene-toolbar" data-tour="camera"><button onClick={onResetCamera} disabled={!onResetCamera} aria-label="Reset camera" title="Reset camera"><Compass size={16}/></button><span>Orbit view</span></div></section>;
}

export function LabShell({children,onResetCamera}:LabShellProps) {
  const recipe=useLabStore(s=>s.recipe); const selectActivity=useLabStore(s=>s.selectActivity);const updateParam=useLabStore(s=>s.updateParam);const error=useLabStore(s=>s.error);
  const [showSaved,setShowSaved]=useState(false);const [showSettings,setShowSettings]=useState(false);const [mobileTab,setMobileTab]=useState<MobileTab>('setup');const [showTour,setShowTour]=useState(false);
  useEffect(() => {
    try { if(localStorage.getItem(TOUR_STORAGE_KEY) !== 'seen') setShowTour(true); }
    catch { setShowTour(true); }
  },[]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if(event.repeat || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if(target && (target.isContentEditable || target.closest('dialog[open]') || ['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(target.tagName))) return;
      const store = useLabStore.getState();
      if(event.code === 'Space') {
        event.preventDefault();
        if(store.status === 'running') store.pause();
        else store.run();
      }
      else if(event.key.toLowerCase() === 'r') store.reset();
    };
    document.addEventListener('keydown',onKeyDown);
    return () => document.removeEventListener('keydown',onKeyDown);
  },[]);
  const tabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.indexOf(event.target as HTMLButtonElement); if(current < 0) return;
    let next = current;
    if(event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if(event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if(event.key === 'Home') next = 0;
    else if(event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); tabs[next].focus(); tabs[next].click();
  };
  return <div className="lab-shell" data-mobile-tab={mobileTab}>
    <LabHeader onSave={()=>setShowSaved(true)} onSettings={()=>setShowSettings(true)} onTour={()=>setShowTour(true)}/>
    {error&&<div className="lab-error-banner" role="status"><CircleHelp size={14}/><span>{error}</span>{error.includes('Original data remains in browser storage')&&<button className="download-draft" onClick={()=>{const raw=localStorage.getItem(`${DRAFT_KEY}.invalid`);if(!raw)return;const url=URL.createObjectURL(new Blob([raw],{type:'text/plain'}));const link=document.createElement('a');link.href=url;link.download='planet-lab-original-draft.txt';link.click();URL.revokeObjectURL(url);}}>Download original draft</button>}<button onClick={()=>useLabStore.getState().setError(null)} aria-label="Dismiss message"><X size={14}/></button></div>}
    <main className="lab-main">
      <div className="mobile-setup" id="setup-panel" role="tabpanel" tabIndex={-1} aria-labelledby="tab-setup"><ActivityPalette active={recipe.activityId} onSelect={selectActivity}/><ParameterInspector recipe={recipe} update={updateParam}/></div>
      <SceneFrame onResetCamera={onResetCamera}>{children}</SceneFrame>
      <TransportControls compact onTour={()=>setShowTour(true)}/>
      <div className="mobile-tabs" role="tablist" aria-label="Workbench sections" onKeyDown={tabKeyDown}>{(['setup','results','ask'] as const).map(tab=><button id={`tab-${tab}`} key={tab} role="tab" aria-controls={`${tab}-panel`} aria-selected={mobileTab===tab} tabIndex={mobileTab===tab?0:-1} onClick={()=>setMobileTab(tab)}>{tab==='setup'?'Setup':tab==='results'?'Results':'Ask'}</button>)}</div>
      <ResultsPanel/>
      <AssistantPanel/>
    </main>
    <FeatureTour open={showTour} onClose={()=>setShowTour(false)} panel={mobileTab} onPanelChange={setMobileTab}/>
    <SavedExperimentsDialog open={showSaved} onClose={()=>setShowSaved(false)}/><SettingsDialog open={showSettings} onClose={()=>setShowSettings(false)}/>
  </div>;
}
