# Task: Check Code

Run a full code quality check on the NousAI-App codebase.

## Steps
1. Run TypeScript build: `cd NousAI-App && npm run build` — must pass with zero errors
2. Grep for any `any` casts: `grep -r ": any" src/` — flag anything not marked intentional
3. Check all new interfaces are in `src/types.ts` (not scattered in components)
4. Scan for direct state mutations (spreading `data.pluginData` instead of `updatePluginData()`)
5. Check all page-level components use `lazy()` imports
6. Check all AI-powered components are wrapped in `ToolErrorBoundary`
7. Scan for hardcoded inline styles that should be CSS vars

## Tool Usage
- Use `Bash` for build + grep checks
- Use `mcp__Desktop_Commander__start_process` to run multiple grep checks in parallel
- Report pass/fail per check with line references
