# Task: Security Check

Verify security posture of the NousAI app.

## Batch Checks (run in parallel via Desktop Commander)

Use `mcp__Desktop_Commander__start_process` to execute:

```powershell
# Run simultaneously
$jobs = @(
  { npm audit --json 2>&1 },                                    # Dependency vulns
  { grep -r "window.katex" src/ 2>&1 },                        # CDN usage (should be 0)
  { grep -r "dangerouslySetInnerHTML" src/ 2>&1 },             # XSS risk
  { grep -r "eval(" src/ 2>&1 },                               # Code injection
  { grep -rn "console.log" src/ 2>&1 | grep -i "password\|token\|key\|secret" }, # Credential leaks
) | ForEach-Object { Start-Job -ScriptBlock $_ }
$jobs | Wait-Job | Receive-Job
```

## Firebase Security Rules
- Use `mcp__plugin_firebase_firebase__firebase_get_security_rules` to review current Firestore rules
- Verify: users can only read/write their own documents
- Check: no `.read: true` or `.write: true` at root level

## Auth / Session
- Use `mcp__playwright__browser_navigate` to test:
  - Unauthenticated access to dashboard → should redirect to login
  - Accessing another user's data URL → should 403

## Firestore Data Exposure
- Verify no sensitive fields stored in plaintext in Firestore
- Check: API keys stored only in `.env`, never committed to git (`git log -S "sk-" --all`)

## Pass Criteria
- 0 high/critical npm audit vulnerabilities
- 0 credential leaks in console.log
- Firestore rules: users locked to their own UID
- No unauthenticated dashboard access
