import {expect,test,type Page} from '@playwright/test';
const owner='b4d1d8e7-55a8-444e-8e94-48f4f65a14b2';
async function guestAuth(page:Page){
 const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'test-signature'].join('.');
 await page.route('**/auth/v1/**',route=>route.fulfill({json:{access_token:jwt,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:{id:owner,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}}));
}
test.use({viewport:{width:1440,height:900}});
test('explanation works before a run, opens readable chat and carries bounded follow-up context',async({page})=>{
 let signIns=0;await page.route('**/auth/v1/**',route=>{signIns++;return route.fulfill({status:503,json:{error:'Auth is deliberately offline'}});}); const requests:Record<string,unknown>[]=[];
 await page.route('**/api/assistant',async route=>{
  if(route.request().method()==='GET') return route.fulfill({json:{available:true}});
  const body=route.request().postDataJSON();requests.push(body);
  return route.fulfill({json:{requestId:body.requestId,basedOnRevision:body.revision,result:{kind:'explanation',text:'Gravity shapes the path. No measurement is available yet.',metricRefs:[]}}});
 });
 await page.goto('/');
 await page.getByRole('button',{name:'What should I expect?',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Experiment assistant'});
 await expect(dialog).toBeVisible();await expect(dialog.getByText('Gravity shapes the path. No measurement is available yet.',{exact:true})).toBeVisible();
 expect(signIns).toBe(0);expect(requests[0].operation).toBe('explain');expect(requests[0].summary).toBeUndefined();expect(requests[0].history).toEqual([]);
 await dialog.getByLabel('Follow-up question').fill('Explain that more simply.');await dialog.getByRole('button',{name:'Send question',exact:true}).click();
 await expect.poll(()=>requests.length).toBe(2);expect(requests[1].history).toEqual([{role:'user',content:'Explain what this setup should show before I run it.'},{role:'assistant',content:'Gravity shapes the path. No measurement is available yet.'}]);
 await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
 const ids=await page.locator('[id]').evaluateAll(elements=>elements.map(element=>element.id));expect(new Set(ids).size).toBe(ids.length);
});
test('validated AI setup waits for Apply and then uses normal controls',async({page})=>{
 await guestAuth(page);
 await page.route('**/api/assistant',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{available:true}});
  const body=route.request().postDataJSON();return route.fulfill({json:{requestId:body.requestId,basedOnRevision:body.revision,result:{kind:'command',text:'Try a Titan drop to isolate gravity.',command:{type:'configure',recipe:{schemaVersion:1,activityId:'free-fall',worldId:'titan',seed:42,params:{heightM:5,massKg:1,dragEnabled:false}},run:false}}}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Change setup',exact:true}).click();await page.getByLabel('Ask about this experiment',{exact:true}).fill('Prepare a Titan free fall.');await page.getByRole('button',{name:'Send question',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Experiment assistant'});await expect(dialog.getByRole('button',{name:'Apply setup',exact:true})).toBeVisible();
 await expect(page.locator('#world-select')).toHaveValue('mars');await dialog.getByRole('button',{name:'Apply setup',exact:true}).click();
 await expect(page.locator('#world-select')).toHaveValue('titan');await expect(dialog.getByText('Titan · setup guidance',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('#parameter-heightM')).toHaveValue('5');await expect(page.getByRole('button',{name:'Run',exact:true})).toBeEnabled();
});
test('clearing an in-flight question does not restore a late reply or error',async({page})=>{
 await guestAuth(page);let answer:()=>void=()=>{};let started=false;
 const released=new Promise<void>(resolve=>{answer=resolve;});
 await page.route('**/api/assistant',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{available:true}});
  const body=route.request().postDataJSON();started=true;await released;
  await route.fulfill({json:{requestId:body.requestId,basedOnRevision:body.revision,result:{kind:'explanation',text:'This late answer should stay cleared.',metricRefs:[]}}}).catch(()=>{});
 });
 await page.goto('/');await page.getByRole('button',{name:'What should I expect?',exact:true}).click();await expect.poll(()=>started).toBe(true);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Clear conversation',exact:true}).click();answer();
 await expect(page.locator('.assistant-message')).toHaveCount(0);await expect(page.getByText('This late answer should stay cleared.',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Ask about this experiment',{exact:true})).toBeEnabled();
});
