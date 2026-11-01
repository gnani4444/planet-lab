import {expect, test, type Page} from '@playwright/test';
test.use({viewport: {width: 1440, height: 900}});
const run = (page: Page) => page.getByRole('button', {name: /^Run$/});
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: /Planet Lab/i, level: 1})).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
}
async function metric(page: Page, name: string) {
  const text = await page.locator('.measurement').filter({has: page.getByText(name, {exact: true})}).locator('strong').first().innerText();
  return Number.parseFloat(text);
}
test('rover measures real flight, compares Earth, and resets stale results', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await run(page).click();
  await expect(page.getByRole('heading', {name: 'Run result'})).toBeVisible({timeout: 20000});
  const speed = 8; const theta = 25 * Math.PI / 180; const g = 3.71;
  const expectedTime = (speed * Math.sin(theta) + Math.sqrt((speed * Math.sin(theta)) ** 2 + 2*g*0.3))/g;
  expect(Math.abs((await metric(page, 'Airtime') - expectedTime) / expectedTime)).toBeLessThan(0.02);
  expect(Math.abs((await metric(page, 'Range') - speed*Math.cos(theta)*expectedTime) / (speed*Math.cos(theta)*expectedTime))).toBeLessThan(0.02);
  await page.getByRole('button', {name: 'Compare with Earth', exact: true}).click();
  await run(page).click();
  await expect(page.getByRole('heading', {name: 'Run result'})).toBeVisible({timeout: 15000});
  await expect(page.locator('.measurement').filter({has:page.getByText('Range', {exact:true})})).toContainText('Earth:');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', {name: 'Reset', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Measurements'})).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', {name:'Run result'})).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('four activities work and a changed recipe survives refresh', async ({page}) => {
  await ready(page);
  await page.locator('#world-select').selectOption('earth');
  await page.getByRole('button', {name: /Projectile preview/}).click();
  await page.locator('#parameter-speedMps').fill('5');
  await run(page).click();
  await expect(page.getByRole('heading', {name:'Run result'})).toBeVisible({timeout: 15000});
  expect(await metric(page, 'Range')).toBeGreaterThan(0);
  await page.getByRole('button', {name: /Pendulum preview/}).click();
  await page.locator('#parameter-initialAngleDeg').fill('5');
  await run(page).click();
  await expect(page.getByRole('heading', {name:'Run result'})).toBeVisible({timeout: 25000});
  const expected = 2*Math.PI*Math.sqrt(2/9.80665);
  expect(Math.abs((await metric(page, 'Period') - expected)/expected)).toBeLessThan(0.03);
  await page.getByRole('button', {name: /Wind tunnel preview/}).click();
  await page.locator('#world-select').selectOption('moon');
  await run(page).click();
  await expect(page.getByRole('heading', {name:'Run result'})).toBeVisible();
  expect(await metric(page, 'Drag force')).toBe(0);
  await page.locator('#parameter-windSpeedMps').fill('18');
  await page.waitForTimeout(300); await page.reload();
  await expect(page.locator('#world-select')).toHaveValue('moon');
  await expect(page.locator('#parameter-windSpeedMps')).toHaveValue('18');
});
test('mobile layout, guest save state, and reduced motion remain usable', async ({page}) => {
  await page.route('**/api/assistant', route => route.fulfill({json:{available:false,reason:'Assistant temporarily unavailable.'}}));
  await page.route('**/auth/v1/**', route => route.fulfill({status:503,json:{message:'Cloud unavailable for this outage test.'}}));
  await page.setViewportSize({width:390,height:844}); await page.emulateMedia({reducedMotion:'reduce'});
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(run(page)).toBeVisible();
  await page.getByRole('button', {name:'Saved experiments', exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/unavailable|Could not start a guest cloud session/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:'Step', exact:true}).click();
  await expect(page.getByRole('button', {name:'Resume', exact:true})).toBeVisible();
  await page.getByRole('tab', {name:'Ask', exact:true}).click();
  await expect(page.getByLabel('Ask about this experiment')).toBeDisabled();
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(e=>e.id));
  expect(new Set(ids).size).toBe(ids.length);
});
test('zero-speed release reports clearance and a fresh run replaces completed data', async ({page}) => {
  await ready(page); await page.locator('#world-select').selectOption('earth');
  await page.getByRole('button', {name:/Projectile preview/}).click();
  await page.locator('#parameter-massKg').fill('0');
  await expect(page.locator('#parameter-massKg')).toHaveAttribute('aria-invalid','true');
  await page.locator('#parameter-massKg').fill('0.1');
  await expect(page.locator('#parameter-massKg')).toHaveAttribute('aria-invalid','false');
  await page.locator('#parameter-speedMps').fill('0');
  await page.locator('#parameter-releaseHeightM').fill('0.5');
  await run(page).click();
  await expect(page.getByRole('heading', {name:'Run result'})).toBeVisible({timeout:15000});
  expect(await metric(page, 'Range')).toBe(0); expect(await metric(page, 'Peak height')).toBeCloseTo(0.5, 2);
  const expectedTime = Math.sqrt(1/9.80665);
  expect(Math.abs((await metric(page, 'Airtime')-expectedTime)/expectedTime)).toBeLessThan(0.03);
  await page.getByRole('button', {name:'Run again', exact:true}).click();
  await expect(page.getByRole('heading', {name:'Run result'})).toBeVisible({timeout:15000});
  expect(await metric(page, 'Range')).toBe(0);
});
test('WebGL failure shows an honest reference view and preserves setup controls', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if(type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByText('3D scene unavailable', {exact:true})).toBeVisible({timeout:15000});
  await expect(page.getByText('Controlled-launch ballistic estimate', {exact:true})).toBeVisible();
  await expect(page.locator('#parameter-launchSpeedMps')).toBeEnabled();
  await expect(page.getByRole('heading', {name:'Run result'})).toHaveCount(0);
});
