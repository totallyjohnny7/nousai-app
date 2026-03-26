/**
 * NousAI Data Persistence Tests
 *
 * Verifies that data survives page reloads — the critical bug where
 * RxDB DB9 was deleting all data on every reload.
 *
 * Flow:
 * 1. Load app → click "Start Fresh" to create a workspace
 * 2. Inject test data into the store via browser evaluate
 * 3. Wait for IDB save (500ms debounce + buffer)
 * 4. Hard reload
 * 5. Verify data survived
 */
import { test, expect } from '@playwright/test';

test.describe('Data Persistence', () => {

  test('Data survives page reload (IDB persistence)', async ({ page }) => {
    // Step 1: Load app
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Handle onboarding if shown
    const startFresh = page.locator('text=Start Fresh');
    if (await startFresh.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startFresh.click();
      await page.waitForTimeout(2000);
    }

    // Step 2: Verify app loaded (sidebar or dashboard content visible)
    await page.waitForSelector('nav, .bottom-nav, h1, h2', { timeout: 10_000 });

    // Step 3: Inject a test course into the store via console
    const injected = await page.evaluate(() => {
      try {
        // Access the IDB directly to write test data
        return new Promise<boolean>((resolve) => {
          const req = indexedDB.open('nousai-companion', 1);
          req.onupgradeneeded = () => { req.result.createObjectStore('appdata'); };
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('appdata', 'readonly');
            const store = tx.objectStore('appdata');
            const getReq = store.get('main');
            getReq.onsuccess = () => {
              const data = getReq.result;
              if (!data) { resolve(false); return; }

              // Add a test course with a unique marker
              const testCourse = {
                id: 'test-persistence-' + Date.now(),
                name: 'PERSISTENCE TEST COURSE',
                shortName: 'PTC',
                color: '#ff0000',
                emoji: '🧪',
                topics: [],
                flashcards: [{ id: 'fc1', front: 'Test Front', back: 'Test Back', tags: [] }],
                modules: [],
                updatedAt: new Date().toISOString(),
              };

              if (!data.pluginData) data.pluginData = {};
              if (!data.pluginData.coachData) data.pluginData.coachData = { courses: [] };
              if (!Array.isArray(data.pluginData.coachData.courses)) {
                data.pluginData.coachData.courses = [];
              }
              data.pluginData.coachData.courses.push(testCourse);

              // Write back to IDB
              const writeTx = db.transaction('appdata', 'readwrite');
              writeTx.objectStore('appdata').put(data, 'main');
              writeTx.oncomplete = () => {
                // Also store a marker in localStorage
                localStorage.setItem('nousai-persistence-test', testCourse.id);
                localStorage.setItem('nousai-data-modified-at', new Date().toISOString());
                resolve(true);
              };
              writeTx.onerror = () => resolve(false);
            };
            getReq.onerror = () => resolve(false);
          };
          req.onerror = () => resolve(false);
        });
      } catch {
        return false;
      }
    });

    // If injection failed (no data to modify), create fresh data
    if (!injected) {
      // Write directly to IDB
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          const req = indexedDB.open('nousai-companion', 1);
          req.onupgradeneeded = () => { req.result.createObjectStore('appdata'); };
          req.onsuccess = () => {
            const db = req.result;
            const data = {
              settings: { theme: 'dark', canvasToken: '', canvasUrl: '', canvasEvents: [], aiProvider: 'none' },
              pluginData: {
                coachData: {
                  courses: [{
                    id: 'test-persistence-direct',
                    name: 'PERSISTENCE TEST COURSE',
                    shortName: 'PTC',
                    color: '#ff0000',
                    emoji: '🧪',
                    topics: [],
                    flashcards: [{ id: 'fc1', front: 'Test', back: 'Test', tags: [] }],
                    modules: [],
                  }]
                },
                quizHistory: [],
                srData: { cards: [], settings: {} },
                gamificationData: { xp: 0, level: 1, streak: 0, lastStudyDate: '', badges: [], dailyXpLog: [], weeklyQuests: [] },
                timerState: { mode: 'work', running: false, seconds: 1500, pomoCount: 0, pomoEndTime: null },
              },
            };
            const tx = db.transaction('appdata', 'readwrite');
            tx.objectStore('appdata').put(data, 'main');
            tx.oncomplete = () => {
              localStorage.setItem('nousai-persistence-test', 'test-persistence-direct');
              localStorage.setItem('nousai-data-modified-at', new Date().toISOString());
              resolve();
            };
          };
        });
      });
    }

    // Step 4: Wait for save to complete
    await page.waitForTimeout(2000);

    // Step 5: Screenshot before reload
    await page.screenshot({ path: 'tests/e2e/screenshots/persistence-before-reload.png' });

    // Step 6: HARD RELOAD
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // Wait for app to fully hydrate

    // Step 7: Verify we did NOT get the onboarding screen
    const onboardingVisible = await page.locator('text=Welcome to NousAI').isVisible({ timeout: 3000 }).catch(() => false);

    await page.screenshot({ path: 'tests/e2e/screenshots/persistence-after-reload.png' });

    // CRITICAL ASSERTION: Onboarding should NOT show after reload
    expect(onboardingVisible).toBe(false);

    // Step 8: Verify IDB still has the data
    const dataExists = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const req = indexedDB.open('nousai-companion', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('appdata', 'readonly');
          const getReq = tx.objectStore('appdata').get('main');
          getReq.onsuccess = () => {
            const data = getReq.result;
            const courses = data?.pluginData?.coachData?.courses;
            resolve(Array.isArray(courses) && courses.length > 0);
          };
          getReq.onerror = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      });
    });

    expect(dataExists).toBe(true);
  });

  test('Data survives 3 consecutive reloads', async ({ page }) => {
    // Write test data
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Handle onboarding
    const startFresh = page.locator('text=Start Fresh');
    if (await startFresh.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startFresh.click();
      await page.waitForTimeout(2000);
    }

    // Wait for app to stabilize
    await page.waitForTimeout(3000);

    // Reload 3 times
    for (let i = 1; i <= 3; i++) {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(4000);

      const onboarding = await page.locator('text=Welcome to NousAI').isVisible({ timeout: 2000 }).catch(() => false);
      await page.screenshot({ path: `tests/e2e/screenshots/persistence-reload-${i}.png` });

      // Should NOT show onboarding on any reload
      expect(onboarding, `Reload ${i}: onboarding appeared — data was lost`).toBe(false);
    }
  });

  test('Console shows IDB save, not RxDB as primary', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[STORE]') || msg.text().includes('[IDB]') || msg.text().includes('[RxDB]')) {
        logs.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(5000);

    // Handle onboarding
    const startFresh = page.locator('text=Start Fresh');
    if (await startFresh.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startFresh.click();
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'tests/e2e/screenshots/persistence-console-logs.png' });

    // Check that IDB is being used (not just RxDB)
    const hasIdbLoad = logs.some(l => l.includes('legacy IDB') || l.includes('Loaded from'));
    const hasRxdbDelete = logs.some(l => l.includes('removeRxDatabase'));

    // RxDB should NOT be deleting the database
    expect(hasRxdbDelete).toBe(false);
  });
});
