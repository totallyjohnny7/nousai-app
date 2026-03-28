# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in NousAI, please report it responsibly.

**Email**: reallyjustjohnny6@gmail.com

**Subject line**: `[SECURITY] NousAI — brief description`

### What to Report

- Authentication bypass or session hijacking
- Data exposure (other users' study data, API keys)
- Cross-site scripting (XSS)
- Firestore security rule bypasses
- Service worker or PWA cache poisoning
- API endpoint abuse (omi-webhook, omi-proxy, extension-sync)

### What NOT to Report

- Feature requests or UI bugs (use [GitHub Issues](https://github.com/totallyjohnny7/nousai-app/issues))
- Denial of service against Vercel infrastructure
- Social engineering

## Response Timeline

- **Acknowledgment**: within 48 hours
- **Assessment**: within 1 week
- **Fix**: as fast as possible, depending on severity

## Scope

- Production: https://studynous.com
- API endpoints: `/api/omi-proxy`, `/api/omi-webhook`, `/api/extension-sync`, `/api/canvas-proxy`
- Firebase project: `nousai-dc038`
- Client-side storage: IndexedDB, localStorage, service worker caches
