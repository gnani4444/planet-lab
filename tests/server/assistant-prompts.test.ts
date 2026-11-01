import {expect,it} from 'vitest';
import {getAssistantPrompts} from '@/components/lab/assistant-prompts';
import {DEFAULT_PARAMS, type ActivityId, type ExperimentRecipe} from '@/domain';
it('offers honest setup guidance before measurement and measured comparisons only after both runs exist',()=>{
 for(const activityId of Object.keys(DEFAULT_PARAMS) as ActivityId[]) {
  const recipe={schemaVersion:1,seed:42,worldId:'mars',activityId,params:DEFAULT_PARAMS[activityId]} as ExperimentRecipe;
  const before=getAssistantPrompts({recipe,hasMeasuredResult:false,hasEarthComparison:false});
  expect(before.some(item=>item.label==='Explain this result')).toBe(false);
  expect(before.some(item=>item.label.includes('different from Earth'))).toBe(false);
  const measured=getAssistantPrompts({recipe,hasMeasuredResult:true,hasEarthComparison:true});
  expect(measured.some(item=>item.label==='Explain this result')).toBe(true);
  expect(measured.some(item=>item.label.includes('different from Earth'))).toBe(true);
 }
});
