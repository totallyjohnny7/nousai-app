# Contributing to NousAI

## Getting Started

1. Fork the repo
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/nousai-app.git`
3. Install dependencies: `npm install`
4. Start dev server: `npm run dev`

## Development Workflow

1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes
3. Ensure build passes: `npm run build`
4. Commit with a descriptive message
5. Push and open a PR

## AI Agent Development

This repo uses Claude Code via GitHub Actions. Tag `@claude` in any issue to get AI-assisted development.

- **Standard tasks** (UI, bugs, small features) → handled by Claude Sonnet
- **Complex tasks** (architecture, refactor, security) → auto-upgraded to Claude Opus

See [`AGENTS.md`](./AGENTS.md) for full codebase context that AI agents use.

## Coding Standards

- **TypeScript**: strict mode, no `any` casts, interfaces in `src/types.ts`
- **State**: use `updatePluginData()` for partial updates, functional updaters for reading previous state
- **CSS**: custom properties in `:root`, never inline styles for themeable values
- **Components**: lazy-load pages, wrap AI tools in `<ToolErrorBoundary>`
- **AI models**: use Gemini/Mistral/DeepSeek via OpenRouter (never Anthropic via OpenRouter)

## Deploy Checklist

- [ ] `npm run build` passes (zero TS errors)
- [ ] Deploy: `npm run build && vercel --prod --yes --archive=tgz`
- [ ] Clear PWA cache in browser after deploy
- [ ] Test on https://studynous.com with real account
- [ ] No `.env` files or API keys in commits
