# Task: UX Check

Verify the user experience across key flows on production.

## Production URL
https://nousai-app.vercel.app

## Flows to Test
Use `/automated-ui-test` skill for structured test runs. Playwright is the primary tool.

### 1. Login Flow
- Navigate to app → click Sign In → fill credentials → verify Dashboard loads
- Check: no flash of unauthenticated content, loading state is smooth

### 2. Dashboard Navigation
- Click each of the 4 tabs (Overview, Courses, Analytics, Plan)
- Verify: no crashes, data loads, no console errors

### 3. Course Interaction
- Open a course → click into a topic → verify notes/cards render
- Check: KaTeX math renders correctly (not raw LaTeX strings)

### 4. AI Tool
- Trigger one AI tool (flashcard generation or quiz)
- Verify: streaming response works, ToolErrorBoundary doesn't trigger

### 5. E-ink Mode Toggle
- If accessible, toggle e-ink mode
- Verify: `html.eink` class applied, animations disabled, colors override correctly

## Tool Usage
- `mcp__playwright__browser_navigate` — page navigation
- `mcp__playwright__browser_click` — interactions
- `mcp__playwright__browser_console_messages` — check for JS errors
- `mcp__playwright__browser_take_screenshot` — capture failures
- `mcp__kapture__screenshot` — bulk screenshots for comparison

## Report Format
```
FLOW: [name]
STATUS: PASS / FAIL
Issues: [list or "none"]
Screenshot: [path if failure]
```
