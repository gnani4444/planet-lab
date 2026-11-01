'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CloudOff, LoaderCircle, MessageCircle, RotateCcw, Send, Sparkles, Trash2, X } from 'lucide-react';
import { METRICS, assistantResponseSchema, type AssistantRequest, type LabCommand, type MetricId } from '@/domain';
import { ACTIVITIES, WORLDS } from '@/data';
import type { AssistantPrompt } from './assistant-prompts';
import { getAssistantPrompts } from './assistant-prompts';
import { useLabStore } from '@/state/lab-store';

type AssistantMessage = { kind: 'user' | 'assistant' | 'error'; text: string; id: string; operation?: 'explain' | 'command'; metricRefs?: MetricId[]; metrics?: Partial<Record<MetricId, number>>; earthMetrics?: Partial<Record<MetricId, number>>; worldId?: string; command?: LabCommand; basedOnRevision?: number; applied?: boolean };
type Availability = { available: boolean; reason?: string };
type FailedPrompt = { prompt: string; operation: 'explain' | 'command' };

function metricValue(value: number | undefined, id: MetricId) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(METRICS[id].precision)} ${METRICS[id].unit}`;
}

function MetricReferences({ message }: { message: AssistantMessage }) {
  if (!message.metricRefs?.length) return null;
  return <dl className="assistant-metrics">
    {message.metricRefs.map(id => <div className="assistant-metric" key={id}>
      <dt>{METRICS[id].label}</dt>
      <dd><span>{message.worldId ? WORLDS[message.worldId as keyof typeof WORLDS]?.name ?? 'Current world' : 'Current world'}: {metricValue(message.metrics?.[id], id)}</span>
        {message.earthMetrics?.[id] !== undefined && <span>Earth: {metricValue(message.earthMetrics[id], id)}</span>}
      </dd>
    </div>)}
  </dl>;
}

function CommandPreview({ command }: { command: LabCommand }) {
  if (command.type === 'control') return <p className="assistant-command-preview">Requested action: {command.action}</p>;
  const activity = ACTIVITIES[command.recipe.activityId];
  return <details className="assistant-command-preview"><summary>{activity.name} · {WORLDS[command.recipe.worldId].name} · {command.run ? 'Apply and run' : 'Apply and leave ready'}</summary>
    <dl>{Object.entries(command.recipe.params).map(([key, value]) => {
      const descriptor = activity.parameters.find(parameter => parameter.key === key);
      return <div key={key}><dt>{descriptor?.label ?? key}</dt><dd>{String(value)} {descriptor?.unit ?? ''}</dd></div>;
    })}</dl>
  </details>;
}

function Transcript({ messages, busy, id, expanded = false, onApply }: { messages: AssistantMessage[]; busy: boolean; id: string; expanded?: boolean; onApply: (message: AssistantMessage) => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages, busy]);
  return <div className={expanded ? 'assistant-transcript expanded' : 'assistant-transcript'} aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
    {messages.length === 0 ? <div className="assistant-empty" id={`${id}-empty`}>
      <span className="assistant-empty-mark"><Sparkles size={16} aria-hidden="true" /></span>
      <p>Ask OpenAI to explain the science, compare worlds, or suggest a setup.</p>
    </div> : messages.map(message => <article className={`assistant-message ${message.kind}`} key={message.id}>
      <div className="assistant-message-label">{message.kind === 'user' ? 'You' : message.kind === 'error' ? 'Could not answer' : message.operation === 'command' ? 'Setup suggestion' : 'OpenAI'}</div>
      <p>{message.text}</p>
      {message.kind === 'assistant' && <MetricReferences message={message} />}
      {message.command && <CommandPreview command={message.command} />}
      {message.kind === 'assistant' && message.command && <button className="assistant-apply" type="button" onClick={() => onApply(message)} disabled={message.applied}>
        {message.applied ? <><span aria-hidden="true">✓</span> Applied</> : 'Apply setup'}
      </button>}
    </article>)}
    {busy && <div className="assistant-loading" role="status"><LoaderCircle className="spin" size={15} aria-hidden="true"/> OpenAI is thinking…</div>}
    <div ref={bottomRef} aria-hidden="true" />
  </div>;
}

export function AssistantPanel() {
  const recipe = useLabStore(s => s.recipe);
  const revision = useLabStore(s => s.revision);
  const summaries = useLabStore(s => s.summaries);
  const setError = useLabStore(s => s.setError);
  const dispatch = useLabStore(s => s.dispatch);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<'explain' | 'command'>('explain');
  const [expanded, setExpanded] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<FailedPrompt | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const previousRevision = useRef(revision);
  const promptSuggestions = useMemo(() => getAssistantPrompts({
    recipe,
    hasMeasuredResult: Boolean(summaries[recipe.worldId]),
    hasEarthComparison: Boolean(summaries.earth && recipe.worldId !== 'earth'),
  }), [recipe, summaries]);

  const checkAvailability = useCallback(async () => {
    setAvailability(null);
    try {
      const response = await fetch('/api/assistant');
      if (!response.ok) throw new Error();
      setAvailability(await response.json());
    } catch {
      setAvailability({ available: false, reason: 'OpenAI assistant is unavailable right now.' });
    }
  }, []);

  useEffect(() => { void checkAvailability(); }, [checkAvailability]);
  useEffect(() => {
    if (previousRevision.current === revision) return;
    previousRevision.current = revision;
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
    setMessages([]);
    setFailedPrompt(null);
  }, [revision]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (expanded && dialog && !dialog.open) dialog.showModal();
    if (!expanded && dialog?.open) dialog.close();
  }, [expanded]);
  useEffect(() => () => requestRef.current?.abort(), []);

  const sendPrompt = useCallback(async (promptValue: string, requestOperation: 'explain' | 'command') => {
    const prompt = promptValue.trim();
    if (!prompt || busy || !availability?.available) return;
    setExpanded(true);
    const snapshot = useLabStore.getState();
    const sentRevision = snapshot.revision;
    const requestRecipe = snapshot.recipe;
    const requestSummary = snapshot.summaries[requestRecipe.worldId];
    const requestReference = requestRecipe.worldId === 'earth' ? undefined : snapshot.summaries.earth;
    const priorHistory = messages.filter(message => message.kind === 'user' || message.kind === 'assistant').slice(-6).map(message => ({
      role: message.kind as 'user' | 'assistant',
      content: message.text.slice(0, 1000),
    }));
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    requestRef.current = controller;
    setMessages(current => [...current, { id: requestId, kind: 'user', text: prompt, operation: requestOperation }]);
    setInput('');
    setFailedPrompt(null);
    setBusy(true);
    try {
      const request: AssistantRequest = {
        requestId,
        revision: sentRevision,
        operation: requestOperation === 'command' ? 'command' : 'explain',
        input: prompt.slice(0, 500),
        recipe: requestRecipe,
        ...(requestSummary ? { summary: requestSummary } : {}),
        ...(requestReference ? { referenceSummary: requestReference } : {}),
        history: priorHistory,
      };
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (requestRef.current !== controller) return;
      if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Assistant request failed. Try again.');
      const parsed = assistantResponseSchema.safeParse(payload);
      if (!parsed.success || parsed.data.requestId !== requestId) throw new Error('Assistant returned an invalid response. Try again.');
      if (useLabStore.getState().revision !== sentRevision || parsed.data.basedOnRevision !== sentRevision) throw new Error('Experiment changed while OpenAI was responding. Ask again for the current setup.');
      const result = parsed.data.result;
      if (result.kind === 'command') {
        setMessages(current => [...current, { id: crypto.randomUUID(), kind: 'assistant', operation: 'command', text: result.text, command: result.command, basedOnRevision: sentRevision }]);
      } else {
        const text = result.text;
        setMessages(current => [...current, {
          id: crypto.randomUUID(),
          kind: result.kind === 'unsupported' ? 'error' : 'assistant',
          operation: 'explain',
          text,
          ...(result.kind === 'explanation' ? {
            metricRefs: result.metricRefs,
            metrics: requestSummary?.metrics,
            earthMetrics: requestReference?.metrics,
            worldId: requestRecipe.worldId,
          } : {}),
        }]);
      }
    } catch (error) {
      if (requestRef.current !== controller) return;
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Assistant request timed out. Try again.'
        : error instanceof Error ? error.message : 'Assistant request failed. Try again.';
      if (useLabStore.getState().revision === sentRevision) {
        setMessages(current => [...current, { id: crypto.randomUUID(), kind: 'error', text: message }]);
        setFailedPrompt({ prompt, operation: requestOperation });
        setError(message);
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }, [availability?.available, busy, messages, setError]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendPrompt(input, operation);
  };
  const selectSuggestion = (suggestion: AssistantPrompt) => {
    setOperation(suggestion.operation);
    void sendPrompt(suggestion.prompt, suggestion.operation);
  };
  const applySuggestion = (message: AssistantMessage) => {
    if (!message.command || message.applied || message.basedOnRevision !== useLabStore.getState().revision) return;
    if (!dispatch(message.command)) return;
    setMessages(current => current.map(item => item.id === message.id ? { ...item, applied: true } : item));
  };
  const clearConversation = () => { requestRef.current?.abort(); requestRef.current = null; setBusy(false); setMessages([]); setFailedPrompt(null); };
  const statusText = availability === null ? 'Checking' : availability.available ? 'OpenAI ready' : 'Unavailable';

  return <section className="assistant-panel" id="ask-panel" role="tabpanel" tabIndex={-1} aria-labelledby="tab-ask" aria-label="Ask about this experiment">
    <div className="assistant-heading">
      <span className="assistant-mark"><Sparkles size={14} aria-hidden="true" /></span>
      <div><h2>Ask OpenAI</h2><p>Science help for this experiment</p></div>
      <span className={`ai-availability${availability?.available ? ' available' : ''}`}>{statusText}</span>
    </div>
    <div className="assistant-mode" role="group" aria-label="Assistant request type">
      <button type="button" aria-pressed={operation === 'explain'} onClick={() => setOperation('explain')}>Explain</button>
      <button type="button" aria-pressed={operation === 'command'} onClick={() => setOperation('command')}>Change setup</button>
    </div>
    <div className="assistant-suggestions" aria-label="Suggested questions">
      {promptSuggestions.map(suggestion => <button key={suggestion.label} type="button" onClick={() => selectSuggestion(suggestion)} disabled={!availability?.available || busy}>
        {suggestion.operation === 'command' && <span className="suggestion-type">Setup</span>}{suggestion.label}
      </button>)}
    </div>
    <Transcript messages={messages} busy={busy} id="assistant-inline" onApply={applySuggestion} />
    <div className="assistant-toolbar">
      <span>{messages.length ? `${messages.filter(message => message.kind === 'user').length} questions` : 'Ask a question to begin'}</span>
      <div>
        <button type="button" onClick={() => setExpanded(true)} aria-haspopup="dialog"><MessageCircle size={14} aria-hidden="true"/> Expand</button>
        <button type="button" onClick={clearConversation} disabled={!messages.length && !busy} aria-label="Clear conversation"><Trash2 size={14} aria-hidden="true"/></button>
      </div>
    </div>
    <form className="assistant-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="assistant-input-inline">Ask about this experiment</label>
      <input id="assistant-input-inline" value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder={operation === 'command' ? 'Describe a setup change…' : 'Ask about the science…'} disabled={!availability?.available || busy} />
      <button type="submit" aria-label="Send question" disabled={!availability?.available || busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />}</button>
    </form>
    {!availability?.available && <p className="assistant-footnote"><CloudOff size={14} aria-hidden="true"/>{availability?.reason ?? 'Checking OpenAI availability…'}<button onClick={() => void checkAvailability()} type="button">Retry</button></p>}
    {failedPrompt && availability?.available && <button className="assistant-retry" type="button" onClick={() => void sendPrompt(failedPrompt.prompt, failedPrompt.operation)} disabled={busy}><RotateCcw size={13} aria-hidden="true"/> Retry last question</button>}
    <dialog className="assistant-dialog" ref={dialogRef} onClose={() => setExpanded(false)} aria-labelledby="assistant-dialog-title" onCancel={() => setExpanded(false)}>
      <div className="assistant-dialog-header">
        <div><span className="assistant-dialog-eyebrow"><Sparkles size={14} aria-hidden="true"/> OpenAI</span><h2 id="assistant-dialog-title">Experiment assistant</h2></div>
        <button className="icon-button" type="button" onClick={() => setExpanded(false)} aria-label="Close assistant"><X size={17}/></button>
      </div>
      <div className="assistant-dialog-context"><b>{ACTIVITIES[recipe.activityId].name}</b><span>{WORLDS[recipe.worldId].name} · {summaries[recipe.worldId] ? 'measured result available' : 'setup guidance'}</span></div>
      <Transcript messages={messages} busy={busy} id="assistant-dialog" expanded onApply={applySuggestion} />
      {promptSuggestions.length > 0 && <div className="assistant-suggestions dialog-suggestions" aria-label="Suggested questions">{promptSuggestions.map(suggestion => <button key={suggestion.label} type="button" onClick={() => selectSuggestion(suggestion)} disabled={!availability?.available || busy}>{suggestion.label}</button>)}</div>}
      <form className="assistant-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="assistant-input-dialog">Follow-up question</label>
        <input id="assistant-input-dialog" value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder={operation === 'command' ? 'Describe a setup change…' : 'Ask about the science…'} disabled={!availability?.available || busy} />
        <button type="submit" aria-label="Send question" disabled={!availability?.available || busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />}</button>
      </form>
      {failedPrompt && availability?.available && <button className="assistant-retry" type="button" onClick={() => void sendPrompt(failedPrompt.prompt, failedPrompt.operation)} disabled={busy}><RotateCcw size={13} aria-hidden="true"/> Retry last question</button>}
    </dialog>
  </section>;
}
