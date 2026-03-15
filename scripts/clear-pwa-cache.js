/**
 * clear-pwa-cache.js
 *
 * Claude Code PostToolUse hook — fires after every Bash tool call.
 * Only clears the PWA cache when the command was a `vercel --prod` deploy.
 *
 * Claude Code passes a JSON payload on stdin:
 *   { "tool_name": "Bash", "tool_input": { "command": "..." }, "tool_response": { ... } }
 */

const { chromium } = require('@playwright/test');

const PROD_URL = 'https://nousai-app.vercel.app';

async function clearCache() {
  console.log('[PWA Cache] Clearing service workers and caches on', PROD_URL);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const result = await page.evaluate(async () => {
    const swRegs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(swRegs.map(r => r.unregister()));
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map(k => caches.delete(k)));
    return { swCount: swRegs.length, cacheCount: cacheKeys.length };
  });

  console.log(`[PWA Cache] Done — unregistered ${result.swCount} SW(s), cleared ${result.cacheCount} cache(s)`);
  await browser.close();
}

async function main() {
  // Read hook payload from stdin
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  let command = '';
  try {
    const payload = JSON.parse(input);
    command = payload?.tool_input?.command ?? '';
  } catch {
    // No stdin or not JSON — skip
    process.exit(0);
  }

  // Only run after a vercel prod deploy
  if (!command.includes('vercel') || !command.includes('--prod')) {
    process.exit(0);
  }

  await clearCache();
}

main().catch(err => {
  console.error('[PWA Cache] Failed:', err.message);
  process.exit(0); // never block Claude on cache clear failure
});
