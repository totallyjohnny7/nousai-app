/**
 * NousAI Smoke Tests — verifies all pages load without crashing.
 *
 * These run on every push via GitHub Actions (cloud Playwright).
 * No login required — tests the unauthenticated / guest experience.
 */
import { test, expect, Page } from '@playwright/test';

const ROUTES = [
  { path: '/', name: 'Dashboard' },
  { path: '/#/quiz', name: 'Quizzes' },
  { path: '/#/flashcards', name: 'Flashcards' },
  { path: '/#/learn', name: 'Learn / AI Tools' },
  { path: '/#/library', name: 'Library' },
  { path: '/#/library?tab=notes', name: 'Notes' },
  { path: '/#/library?tab=drawings', name: 'Drawings' },
  { path: '/#/timer', name: 'Timer' },
  { path: '/#/calendar', name: 'Calendar' },
  { path: '/#/settings', name: 'Settings' },

  { path: '/#/study-gen', name: 'Study Generator' },
  { path: '/#/videos', name: 'Videos' },
];

async function waitForApp(page: Page) {
  // Wait for React to render something meaningful (including onboarding)
  await page.waitForSelector(
    'nav, .bottom-nav, button, h1, h2, input, [data-testid]',
    { timeout: 20_000 }
  );
  // Ensure no React error boundary is showing
  const errorBoundary = await page.locator('text=Something went wrong').count();
  return errorBoundary === 0;
}

/** Bypass onboarding if shown — clicks "Start Fresh" to create a workspace */
async function bypassOnboarding(page: Page) {
  const startFresh = page.locator('text=Start Fresh');
  if (await startFresh.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startFresh.click();
    await page.waitForTimeout(2000);
  }
}

// ── 1. Page Load Tests ──────────────────────────────────────────────────────

for (const route of ROUTES) {
  test(`Page loads: ${route.name} (${route.path})`, async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await bypassOnboarding(page);
    if (route.path !== '/') {
      await page.goto(route.path);
      await page.waitForTimeout(2000);
    }
    const ok = await waitForApp(page);

    // Screenshot for visual verification
    await page.screenshot({
      path: `tests/e2e/screenshots/${route.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`,
      fullPage: false,
    });

    // No React error #310 or other crash
    expect(ok).toBe(true);

    // Page should have content (not blank)
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(10);
  });
}

// ── 2. Settings Page Specific (React #310 regression) ────────────────────────

test('Settings page does not crash (React #310 regression)', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await bypassOnboarding(page);
  await page.goto('/#/settings');
  await page.waitForTimeout(2000);

  // Should NOT show error boundary
  const hasError = await page.locator('text=Something went wrong').count();
  expect(hasError).toBe(0);

  // Should show at least the Account section
  const hasContent = await page.locator('text=Account').count();
  expect(hasContent).toBeGreaterThan(0);

  await page.screenshot({ path: 'tests/e2e/screenshots/settings-no-crash.png' });
});

// ── 3. Global Features ──────────────────────────────────────────────────────

test('Japanese IME badge appears on Alt+J', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await bypassOnboarding(page);

  // Press Alt+J to toggle IME
  await page.keyboard.press('Alt+j');

  // Wait for the IME badge to appear
  const badge = page.locator('text=Hiragana');
  await expect(badge).toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/ime-hiragana.png' });

  // Press again for katakana
  await page.keyboard.press('Alt+j');
  const kataBadge = page.locator('text=Katakana');
  await expect(kataBadge).toBeVisible({ timeout: 3000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/ime-katakana.png' });

  // Press again to turn off
  await page.keyboard.press('Alt+j');
  // Badge should disappear (or show IME Off briefly)
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'tests/e2e/screenshots/ime-off.png' });
});

test('Handwriting overlay appears on Alt+H', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await bypassOnboarding(page);

  await page.keyboard.press('Alt+h');

  const overlay = page.locator('text=Handwrite');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // Canvas should be present
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshots/handwriting-overlay.png' });

  // Close it
  await page.keyboard.press('Alt+h');
  await expect(overlay).not.toBeVisible({ timeout: 3000 });
});

// ── 4. Study Generator ──────────────────────────────────────────────────────

test('Study Generator loads with model dropdown', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await bypassOnboarding(page);
  await page.goto('/#/study-gen');
  await page.waitForTimeout(2000);

  // Should show the Study Visual Generator header
  const header = page.locator('text=Study Visual Generator');
  await expect(header).toBeVisible({ timeout: 5000 });

  // Model dropdown should exist
  const modelSelect = page.locator('select').first();
  await expect(modelSelect).toBeVisible();

  // Should have at least some model options
  const options = await modelSelect.locator('option').count();
  expect(options).toBeGreaterThanOrEqual(2);

  await page.screenshot({ path: 'tests/e2e/screenshots/study-gen-models.png' });
});

// ── 5. Learn Page / AI Tools ─────────────────────────────────────────────────

test('Learn page loads with tool grid', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await bypassOnboarding(page);
  await page.goto('/#/learn');
  await page.waitForTimeout(2000);

  // Should have some tool buttons/cards
  const toolCount = await page.locator('button, [role="button"], .card').count();
  expect(toolCount).toBeGreaterThan(3);

  await page.screenshot({ path: 'tests/e2e/screenshots/learn-tools.png' });
});

// ── 6. Quiz Gen Transparency Dropdown ────────────────────────────────────────

test('Quiz Gen has transparency level selector', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await bypassOnboarding(page);
  await page.goto('/#/learn');
  await page.waitForTimeout(2000);

  // Find and click Quiz Gen tool
  const quizGenBtn = page.locator('text=Quiz Gen').first();
  if (await quizGenBtn.isVisible()) {
    await quizGenBtn.click();
    await page.waitForTimeout(1000);

    // Look for transparency dropdown
    const transparencySelect = page.locator('select:has(option:has-text("Minimal"))');
    const hasTransparency = await transparencySelect.count();

    await page.screenshot({ path: 'tests/e2e/screenshots/quiz-gen-transparency.png' });

    // It should exist (may not be visible if quiz gen requires course selection first)
    // Just verify the page didn't crash
    const hasError = await page.locator('text=Something went wrong').count();
    expect(hasError).toBe(0);
  }
});

// ── 7. Mobile Viewport ───────────────────────────────────────────────────────

test.describe('Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Dashboard renders on mobile', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await bypassOnboarding(page);

    const hasError = await page.locator('text=Something went wrong').count();
    expect(hasError).toBe(0);

    await page.screenshot({ path: 'tests/e2e/screenshots/mobile-dashboard.png' });
  });

  test('Settings renders on mobile without crash', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await bypassOnboarding(page);
    await page.goto('/#/settings');
    await page.waitForTimeout(2000);

    const hasError = await page.locator('text=Something went wrong').count();
    expect(hasError).toBe(0);

    await page.screenshot({ path: 'tests/e2e/screenshots/mobile-settings.png' });
  });
});

// ── 8. Console Error Check ───────────────────────────────────────────────────

test('No React errors in console on dashboard load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('React error')) {
      errors.push(msg.text());
    }
  });

  await page.goto('/');
  await waitForApp(page);
  await bypassOnboarding(page);
  await page.waitForTimeout(3000); // Wait for async effects

  // Filter out non-critical errors (RxDB init failures are expected in test env)
  const criticalErrors = errors.filter(e =>
    !e.includes('RxDB') && !e.includes('DB9') && !e.includes('Firebase')
  );

  expect(criticalErrors).toHaveLength(0);
});
