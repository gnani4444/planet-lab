'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';

export const TOUR_STORAGE_KEY = 'planet-lab-tour-v1';
type Panel = 'setup' | 'results' | 'ask';
type TourStep = { title: string; text: string; tip: string; target?: string; panel?: Panel };
const steps: TourStep[] = [
  { title: 'Welcome to Planet Lab', text: 'Same experiment. Different world. Explore six activities, compare their results on Earth, and ask OpenAI to explain the science.', tip: 'A quick tour of the workbench. Skip any time and replay with Take a tour.' },
  { title: 'Choose an activity', text: 'Try a rover launch, projectile, pendulum, wind tunnel, free fall or bounce. Each activity has its own controls and measurements.', tip: 'Start with Rover ramp for a quick first experiment.', target: '[data-tour="activities"], [data-tour="activity-menu"]', panel: 'setup' },
  { title: 'Pick your world', text: 'Switch between Earth, Moon, Mars, Mercury, Venus and Titan. Gravity and the reference atmosphere change with the world.', tip: 'Changing worlds clears the previous run so the next result matches your setup.', target: '[data-tour="world"]' },
  { title: 'Adjust the setup', text: 'Use the number fields or sliders to change one variable at a time. Some activities also offer object shape and atmospheric drag.', tip: 'Environment and Model assumptions explain the conditions and limits of each experiment.', target: '[data-tour="parameters"]', panel: 'setup' },
  { title: 'Run, pause and inspect', text: 'Run starts the experiment. Pause holds its state, Step advances one physics tick, and Reset returns to the starting setup.', tip: 'Outside inputs and dialogs, Space toggles Run/Pause and R resets.', target: '[data-tour="controls"]' },
  { title: 'Read the results', text: 'Follow the live readout, then inspect the finished measurements and plot. Open the sample table for the recorded data.', tip: 'Wind tunnel shows calculated reference drag; other activities report their simulation measurements.', target: '[data-tour="results"]', panel: 'results' },
  { title: 'Compare with Earth', text: 'Choose a world other than Earth, turn on Compare Earth, then Run. Both worlds use the same activity and inputs.', tip: 'Compare the two traces, measured values and differences without changing the recipe.', target: '[data-tour="compare"]' },
  { title: 'Ask OpenAI why', text: 'Ask what to expect before a run or explain a completed result. Suggested questions adapt to your activity and available measurements.', tip: 'Chat opens in a larger dialog. Follow up, or review a proposed change before clicking Apply setup. No sign-in needed.', target: '[data-tour="assistant"]', panel: 'ask' },
  { title: 'Keep your experiments', text: 'Your current setup is saved locally as you work. Use Saved experiments to name, load or delete cloud recipes when cloud storage is available.', tip: 'Cloud saves belong to this browser session. Chat and the simulator work without them.', target: '[data-tour="saved"]' },
  { title: 'Explore the scene', text: 'Drag the scene to look around your experiment. Use Reset camera to return to the default view.', tip: 'The view changes; your experiment inputs stay the same.', target: '[data-tour="camera"]' },
  { title: 'You’re ready to experiment', text: 'Settings shows whether cloud storage is configured. Start with a run, compare Earth, then ask OpenAI what changed.', tip: 'You can replay this tour any time with Take a tour.', target: '[data-tour="settings"]' },
];
type Rect = { left: number; top: number; width: number; height: number };
type Props = { open: boolean; onClose: () => void; panel: Panel; onPanelChange: (panel: Panel) => void };

export function FeatureTour({ open, onClose, panel, onPanelChange }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const returnPanel = useRef(panel);
  const returnScroll = useRef(0);
  const [index, setIndex] = useState(0);
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const step = steps[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      returnPanel.current = panel;
      returnScroll.current = window.scrollY;
      setIndex(0);
      dialog.showModal();
      headingRef.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, panel]);

  useLayoutEffect(() => {
    if (!open) return;
    headingRef.current?.focus({ preventScroll: true });
    let frame = 0;
    const update = () => {
      const target = step.target ? Array.from(document.querySelectorAll<HTMLElement>(step.target)).find(element => element.getClientRects().length > 0) : undefined;
      const bounds = target?.getBoundingClientRect();
      const margin = 16;
      const width = cardRef.current?.offsetWidth || Math.min(400, window.innerWidth - margin * 2);
      const height = cardRef.current?.offsetHeight || 300;
      const clampX = (x: number) => Math.max(margin, Math.min(x, window.innerWidth - width - margin));
      const clampY = (y: number) => Math.max(margin, Math.min(y, window.innerHeight - height - margin));
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        setHighlight(null);
        setPosition({ left: clampX((window.innerWidth - width) / 2), top: clampY((window.innerHeight - height) / 2) });
        return;
      }
      const left = Math.max(4, bounds.left - 5);
      const top = Math.max(4, bounds.top - 5);
      const right = Math.min(window.innerWidth - 4, bounds.right + 5);
      const bottom = Math.min(window.innerHeight - 4, bounds.bottom + 5);
      setHighlight({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
      if (right + width + margin * 2 <= window.innerWidth) setPosition({ left: right + margin, top: clampY(top) });
      else if (left - width - margin >= margin) setPosition({ left: left - width - margin, top: clampY(top) });
      else if (bottom + height + margin * 2 <= window.innerHeight) setPosition({ left: clampX(left), top: bottom + margin });
      else if (top - height - margin >= margin) setPosition({ left: clampX(left), top: top - height - margin });
      else setPosition({ left: clampX((window.innerWidth - width) / 2), top: clampY(window.innerHeight - height - margin) });
    };
    const target = step.target ? Array.from(document.querySelectorAll<HTMLElement>(step.target)).find(element => element.getClientRects().length > 0) : undefined;
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    update();
    frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const observer = new ResizeObserver(update);
    if (cardRef.current) observer.observe(cardRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, step, panel]);

  const goTo = (next: number) => {
    setIndex(next);
    const nextPanel = steps[next].panel;
    if (nextPanel) onPanelChange(nextPanel);
  };
  const finish = () => {
    try { localStorage.setItem(TOUR_STORAGE_KEY, 'seen'); } catch { /* The tour still closes when browser storage is unavailable. */ }
    onPanelChange(returnPanel.current);
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => {
      window.scrollTo({ top: returnScroll.current, behavior: 'instant' });
      const target = returnFocus.current;
      if (target && target !== document.body && target.isConnected && target.getClientRects().length) target.focus({ preventScroll: true });
      else Array.from(document.querySelectorAll<HTMLButtonElement>('.tour-trigger')).find(button => button.getClientRects().length)?.focus({ preventScroll: true });
    });
  };

  return <dialog className="feature-tour" ref={dialogRef} aria-labelledby="tour-title" aria-describedby="tour-description" onCancel={event => { event.preventDefault(); finish(); }} onKeyDown={event => {
    if (event.key === 'ArrowRight' && index < steps.length - 1) { event.preventDefault(); goTo(index + 1); }
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); goTo(index - 1); }
  }}>
    {highlight && highlight.width > 0 && highlight.height > 0 ? <div className="tour-spotlight" style={highlight} aria-hidden="true"/> : <div className="tour-shade" aria-hidden="true"/>}
    <section ref={cardRef} className="tour-card" style={position ?? undefined}>
      <div className="tour-heading"><span><Compass size={15} aria-hidden="true"/> WORKBENCH TOUR</span><button type="button" aria-label="Close tour" onClick={finish}><X size={18}/></button></div>
      <p className="tour-progress" role="status">Step {index + 1} of {steps.length}</p>
      <h2 ref={headingRef} id="tour-title" tabIndex={-1}>{step.title}</h2>
      <p id="tour-description">{step.text}</p>
      <p className="tour-tip">{step.tip}</p>
      <div className="tour-actions"><button type="button" className="tour-skip" onClick={finish}>Skip tour</button><div>
        {index > 0 && <button type="button" className="tour-back" onClick={() => goTo(index - 1)}><ArrowLeft size={15} aria-hidden="true"/> Back</button>}
        <button type="button" className="tour-next" onClick={() => index === steps.length - 1 ? finish() : goTo(index + 1)}>{index === 0 ? 'Start tour' : index === steps.length - 1 ? 'Finish tour' : 'Next'}{index < steps.length - 1 && <ArrowRight size={15} aria-hidden="true"/>}</button>
      </div></div>
    </section>
  </dialog>;
}
