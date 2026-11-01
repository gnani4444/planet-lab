import {expect, test, type Page} from '@playwright/test';

const gravity = {earth:9.80665, moon:1.62, mars:3.71, mercury:3.7, venus:8.87, titan:1.35};
async function setup(page:Page, activity:'Free fall'|'Bounce', world:keyof typeof gravity) {
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button',{name:new RegExp(`${activity} preview`)}).click();
  await page.locator('#world-select').selectOption(world);
}
async function finish(page:Page) {
  await page.getByRole('button',{name:/^Run$/}).click();
  await expect(page.getByRole('heading',{name:'Run result',exact:true})).toBeVisible({timeout:25000});
}
async function metric(page:Page,label:string) {
  const text=await page.locator('.measurement').filter({has:page.getByText(label,{exact:true})}).locator('strong').innerText();
  return Number.parseFloat(text);
}

for(const world of Object.keys(gravity) as (keyof typeof gravity)[]) {
  test(`Rapier vacuum free fall matches independent equations on ${world}`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await setup(page,'Free fall',world);
    await page.locator('#parameter-heightM').fill('2');
    await finish(page);
    const expectedTime=Math.sqrt(4/gravity[world]);
    const expectedSpeed=Math.sqrt(4*gravity[world]);
    expect(Math.abs(await metric(page,'Airtime')-expectedTime)).toBeLessThan(0.025);
    expect(Math.abs(await metric(page,'Impact speed')-expectedSpeed)/expectedSpeed).toBeLessThan(0.03);
    expect(errors).toEqual([]);
  });
}

for(const restitution of [0,0.01,0.7,0.95]) {
  test(`Rapier first rebound obeys restitution ${restitution}`,async({page})=>{
    await setup(page,'Bounce','mercury');
    await page.locator('#parameter-restitution').fill(String(restitution));
    await finish(page);
    expect(Math.abs(await metric(page,'Rebound height')-3*restitution**2)).toBeLessThan(0.045);
    expect(Math.abs(await metric(page,'Energy retained')-100*restitution**2)).toBeLessThan(1.6);
    expect(Math.abs(await metric(page,'Airtime')-Math.sqrt(6/gravity.mercury))).toBeLessThan(0.025);
    expect(Math.abs(await metric(page,'Impact speed')-Math.sqrt(6*gravity.mercury))).toBeLessThan(0.1);
  });
}

test('Venus minimum-mass drop matches an independent quadratic-drag solution',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page,'Free fall','venus');
  await page.locator('#parameter-heightM').fill('2');
  await page.locator('#parameter-massKg').fill('0.1');
  await page.getByRole('checkbox').check();
  await finish(page);
  const terminalSpeed=Math.sqrt(2*0.1*gravity.venus/(65*0.47*Math.PI*0.18**2));
  const z=2*gravity.venus/terminalSpeed**2;
  const expectedTime=terminalSpeed/gravity.venus*(z+Math.log1p(Math.sqrt(-Math.expm1(-2*z))));
  expect(Math.abs(await metric(page,'Impact speed')-terminalSpeed)/terminalSpeed).toBeLessThan(0.035);
  expect(Math.abs(await metric(page,'Airtime')-expectedTime)/expectedTime).toBeLessThan(0.035);
  expect(errors).toEqual([]);
});

test('Titan bounce comparison preserves the rebound energy and local recovery',async({page})=>{
  await setup(page,'Bounce','titan');
  await page.getByRole('button',{name:'Compare with Earth',exact:true}).click();
  await finish(page);
  const rebound=page.locator('.measurement').filter({has:page.getByText('Rebound height',{exact:true})});
  await expect(rebound).toContainText('Earth:');
  const earthRebound=Number.parseFloat((await rebound.locator('small').first().innerText()).replace('Earth:',''));
  expect(Math.abs(await metric(page,'Rebound height')-earthRebound)).toBeLessThan(0.045);
  await page.reload();
  await expect(page.locator('#world-select')).toHaveValue('titan');
  await expect(page.locator('#parameter-restitution')).toHaveValue('0.7');
});

test('fast Venus projectile matches an independent converged RK4 reference',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Projectile preview/}).click();
  await page.locator('#world-select').selectOption('venus');
  await page.locator('#parameter-massKg').fill('0.1');
  await page.locator('#parameter-speedMps').fill('30');
  await page.locator('#parameter-angleDeg').fill('45');
  await page.locator('#parameter-releaseHeightM').fill('2');
  await page.getByRole('checkbox').check();
  await finish(page);
  // Independent RK4 oracle in tests/physics/audit.test.ts; halving its 0.0001 s step changes results by <1e-7.
  // Browser tolerances include the UI's displayed two-decimal rounding.
  expect(Math.abs(await metric(page,'Airtime')-3.0219997206192293)).toBeLessThan(0.06);
  expect(Math.abs(await metric(page,'Range')-0.23587298388641087)).toBeLessThan(0.01);
  expect(Math.abs(await metric(page,'Impact speed')-0.755307433672611)).toBeLessThan(0.03);
});

test('six worlds and six activities stay accessible on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page,'Bounce','venus');
  await expect(page.locator('#world-select option')).toHaveCount(6);
  await expect(page.getByRole('button',{name:/preview/})).toHaveCount(6);
  await expect(page.locator('#parameter-restitution')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Step',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
});
