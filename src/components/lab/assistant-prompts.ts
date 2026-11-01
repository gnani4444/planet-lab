import type { ActivityId, ExperimentRecipe } from '@/domain';

export type AssistantPrompt = {
  label: string;
  prompt: string;
  operation: 'explain' | 'command';
};

const activityQuestions: Record<ActivityId, string> = {
  'rover-ramp': 'How does the ramp angle change the rover’s path?',
  projectile: 'How do launch angle and drag change the flight?',
  pendulum: 'What sets the pendulum’s period?',
  'wind-tunnel': 'How do speed and shape affect drag?',
  'free-fall': 'How does gravity affect the fall?',
  bounce: 'Where does the bounce energy go?',
};

const activitySetups: Record<ActivityId, {label: string; prompt: string}> = {
  'rover-ramp': {label: 'Try Moon rover', prompt: 'Set up the rover on the Moon at the current launch speed and angle, and leave it ready.'},
  projectile: {label: 'Try air resistance', prompt: 'Enable drag for this projectile, keep all other inputs unchanged, and leave it ready.'},
  pendulum: {label: 'Try a longer string', prompt: 'Set the pendulum length to three metres, keep the current world and other inputs, and leave it ready.'},
  'wind-tunnel': {label: 'Try a flat plate', prompt: 'Change the object to a plate, keep the current airflow and area, and leave it ready.'},
  'free-fall': {label: 'Try Moon free fall', prompt: 'Set up free fall on the Moon and run it.'},
  bounce: {label: 'Try no rebound', prompt: 'Set the bounce restitution coefficient to exactly 0, keep the current world and all other inputs unchanged, and leave it ready.'},
};

export function getAssistantPrompts({
  recipe,
  hasMeasuredResult,
  hasEarthComparison,
}: {
  recipe: ExperimentRecipe;
  hasMeasuredResult: boolean;
  hasEarthComparison: boolean;
}): AssistantPrompt[] {
  const activityId: ActivityId = recipe.activityId;
  return [
    hasMeasuredResult
      ? { label: 'Explain this result', prompt: 'Explain this result in plain language.', operation: 'explain' }
      : { label: 'What should I expect?', prompt: 'Explain what this setup should show before I run it.', operation: 'explain' },
    { label: 'Ask about this activity', prompt: activityQuestions[activityId], operation: 'explain' },
    hasEarthComparison
      ? { label: 'Why is it different from Earth?', prompt: 'Why is this result different from Earth?', operation: 'explain' }
      : { label: 'Does mass matter?', prompt: 'Does mass affect this experiment, and why?', operation: 'explain' },
    { ...activitySetups[activityId], operation: 'command' },
  ];
}
