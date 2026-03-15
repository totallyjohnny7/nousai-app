# Task: Data Quality Check

Verify data integrity between IndexedDB, Firestore, and the UI.

## Steps
1. **Query Firestore via REST API** (faster than navigating UI):
   - Use `mcp__Desktop_Commander__start_process` to run a Node script:
   ```
   node -e "
   const https = require('https');
   // GET users/{uid} doc from Firestore REST API
   // Replace UID with actual user UID from Firebase console
   const url = 'https://firestore.googleapis.com/v1/projects/nousai-dc038/databases/(default)/documents/users';
   https.get(url, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>console.log(d)); });
   "
   ```
   - Or log into the app via Playwright and read the Zustand store from DevTools
   - Record: number of courses, topics per course, flashcard counts, notes counts
2. **Navigate UI with Playwright** to verify counts match:
   - Use `mcp__playwright__browser_navigate` to open https://nousai-app.vercel.app
   - Navigate to Dashboard → Courses tab, count visible courses
   - Spot-check 2-3 courses for topic/card counts matching Firestore
3. **Check sync state**:
   - Look for any conflict modal appearing on load
   - Check DevTools console for sync errors via `mcp__playwright__browser_console_messages`
4. **Verify compression**:
   - Check that cloud data is being gzip compressed (data should be <1MB in Firestore)

## Pass Criteria
- UI counts match Firestore counts
- No sync conflicts on clean load
- No console errors related to sync or data
- Firestore document size < 1MB

## Tool Priority
1. `mcp__plugin_firebase_firebase__firebase_read_resources` — query DB first
2. `mcp__playwright__*` — then verify UI matches
