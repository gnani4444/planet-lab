import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
const tour = (page: Page) => page.getByRole('dialog', { name: /Welcome to Planet Lab|Choose an activity|Pick your world|Adjust the setup|Run, pause and inspect|Read the results|Compare with Earth|Ask OpenAI why|Keep your experiments|Explore the scene|You’re ready to experiment/ });

test('first-visit tour can be skipped, stays dismissed and replays with keyboard focus', async ({ page }) => {
  await page.goto('/');
  const dialog = tour(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText('Step 1 of 11');
  await dialog.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator('.feature-tour')).not.toBeVisible();
  await page.goto('/lab');
  await expect(page.locator('.feature-tour')).not.toBeVisible();
  const replay = page.getByRole('button', { name: 'Take a tour', exact: true });
  await replay.click();
  await expect(dialog.getByRole('heading', { name: 'Welcome to Planet Lab', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading', { name: 'Choose an activity', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Welcome to Planet Lab', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(replay).toBeFocused();
});

test('complete feature walkthrough preserves the recipe and makes no cloud or AI requests', async ({ page }) => {
  const cloudActions: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/assistant|\/auth\/v1|\/rest\/v1/.test(request.url())) cloudActions.push(request.url()); });
  await page.goto('/');
  const dialog = tour(page);
  await dialog.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await page.locator('#world-select').selectOption('titan');
  await page.locator('#parameter-launchSpeedMps').fill('12');
  await page.getByRole('button', { name: 'Take a tour', exact: true }).click();
  await dialog.getByRole('button', { name: 'Start tour', exact: true }).click();
  for (let step = 2; step <= 11; step++) {
    await expect(dialog.getByRole('status')).toHaveText(`Step ${step} of 11`);
    await expect(page.locator('.tour-spotlight')).toBeVisible();
    const bounds = await page.locator('.tour-card').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
    await dialog.getByRole('button', { name: step === 11 ? 'Finish tour' : 'Next', exact: true }).click();
  }
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#world-select')).toHaveValue('titan');
  await expect(page.locator('#parameter-launchSpeedMps')).toHaveValue('12');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  expect(cloudActions).toEqual([]);
  await page.reload();
  await expect(page.locator('.feature-tour')).not.toBeVisible();
});

test('mobile tour reveals each panel, fits the viewport and restores the original tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const dialog = tour(page);
  await dialog.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await page.getByRole('tab', { name: 'Ask', exact: true }).click();
  await page.getByRole('button', { name: 'Take a tour', exact: true }).click();
  await dialog.getByRole('button', { name: 'Start tour', exact: true }).click();
  for (let step = 2; step <= 11; step++) {
    await expect(dialog.getByRole('status')).toHaveText(`Step ${step} of 11`);
    if (step === 2 || step === 4) await expect(page.locator('.lab-shell')).toHaveAttribute('data-mobile-tab', 'setup');
    if (step === 6) await expect(page.locator('.lab-shell')).toHaveAttribute('data-mobile-tab', 'results');
    if (step === 8) await expect(page.locator('.lab-shell')).toHaveAttribute('data-mobile-tab', 'ask');
    const bounds = await page.locator('.tour-card').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await dialog.getByRole('button', { name: step === 11 ? 'Finish tour' : 'Next', exact: true }).click();
  }
  await expect(page.locator('.lab-shell')).toHaveAttribute('data-mobile-tab', 'ask');
  await expect(page.getByRole('button', { name: 'Take a tour', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('tablet activity menu stays reachable beside the tour trigger', async ({page}) => {
  await page.setViewportSize({width:800,height:768});
  await page.goto('/');
  await tour(page).getByRole('button',{name:'Start tour',exact:true}).click();
  await expect(tour(page).getByRole('heading',{name:'Choose an activity',exact:true})).toBeVisible();
  const menu=page.getByRole('button',{name:'Open activity selection',exact:true});
  await expect(menu).toBeVisible();
  const menuBounds=await menu.boundingBox();
  expect(menuBounds!.x+menuBounds!.width).toBeLessThanOrEqual(800);
  const header=await page.locator('.lab-header').evaluate(element=>({scroll:element.scrollWidth,client:element.clientWidth}));
  expect(header.scroll).toBeLessThanOrEqual(header.client);
  await page.keyboard.press('Escape');
  await menu.click();
  await expect(page.locator('.mobile-activity-menu').getByRole('button',{name:/Free fall preview/})).toBeVisible();
});
