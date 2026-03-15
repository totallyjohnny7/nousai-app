# Task: Technical Stress Test

Run batch health checks and stress test the app under load conditions.

## Batch Health Checks (run in parallel via Desktop Commander)

Use `mcp__Desktop_Commander__start_process` to run a single PowerShell script:

```powershell
# Batch checks — run simultaneously
$checks = @(
  { npm run build 2>&1 | Select-String "error" },           # Build errors
  { npx tsc --noEmit 2>&1 | Select-String "error" },       # TypeScript strict
  { npx vite-bundle-visualizer 2>&1 },                      # Bundle size
)
$jobs = $checks | ForEach-Object { Start-Job -ScriptBlock $_ }
$jobs | Wait-Job | Receive-Job
```

## Performance Checks (Playwright)
1. Navigate to https://nousai-app.vercel.app
2. Open DevTools Performance tab via `mcp__playwright__browser_evaluate`
3. Load a large course (many topics/cards)
4. Check: no layout thrashing, no >16ms render frames
5. Check memory: no leaks after opening/closing 5 courses

## Load Simulation
- Open 3 Playwright tabs simultaneously to the app
- Trigger AI generation in each tab
- Verify no rate-limit errors, all return results

## Sync Stress
- Make 10 rapid note edits (use `mcp__playwright__browser_type` + debounce check)
- Verify only 1 Firestore write occurs (debounced sync queue working)

## Pass Criteria
- Build: 0 TypeScript errors
- Bundle: < 2MB gzipped
- No memory leaks after 10 course opens
- Sync queue debounces correctly (1 write per burst)
