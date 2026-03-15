# Task: Product Quality Check

End-to-end product quality verification — features work as designed.

## Scope
Verify all major features are functional on production: https://nousai-app.vercel.app

## Checklist

### Core Features
- [ ] Spaced repetition (FSRS): cards due today show up in review session
- [ ] Gamification: XP increments after completing a review, streak updates
- [ ] AI generation: flashcard/quiz generation returns results, no timeouts
- [ ] Notes: can create, edit, and save notes within a topic
- [ ] Cloud sync: changes sync to Firestore within ~30s (check network tab)

### Data Integrity
- [ ] Streak freeze purchase deducts XP correctly
- [ ] Cross-tab sync: open two tabs, change data in one, verify other updates

### Error Handling
- [ ] ToolErrorBoundary catches AI crashes (force an error to verify)
- [ ] Conflict modal appears when appropriate (simulate with stale data if possible)

## Tool Usage
- Use `mcp__playwright__*` for all page interaction and verification
- Use `mcp__playwright__browser_network_requests` to verify sync API calls
- Use `mcp__plugin_firebase_firebase__firebase_read_resources` to confirm XP/streak changes persisted in Firestore

## Pass Criteria
All checkboxes above pass with no console errors during normal flows.
