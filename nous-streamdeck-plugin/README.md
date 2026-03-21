# Nous AI — Stream Deck Plugin

Elgato Stream Deck plugin for the Nous AI Omni Learning System.

## Setup

```bash
npm install
npm run build
npx @elgato/cli link    # Symlink to Stream Deck app for development
npx @elgato/cli dev     # Hot-reload during development
```

## Architecture

- Plugin (Node.js) hosts WebSocket server on `ws://localhost:8765`
- Nous web app (browser) connects as WS client
- Button presses send `DeckAction` messages to the browser
- Browser sends `NousState` updates every second during study sessions

## Actions

| UUID | Button | Description |
|------|--------|-------------|
| `com.nousai.omni.start` | ⚡ OMNI | Start 60-min Omni Protocol |
| `com.nousai.grade.again` | ❌ AGAIN | Grade card: Again |
| `com.nousai.grade.hard` | 😰 HARD | Grade card: Hard |
| `com.nousai.grade.good` | ✅ GOOD | Grade card: Good |
| `com.nousai.grade.easy` | 🚀 EASY | Grade card: Easy |
| `com.nousai.feature.focuslock` | 🔒 FOCUS | Toggle Focus Lock |
| `com.nousai.feature.interleave` | 🔀 MIX | Toggle Interleave Mode |

## Distribution

```bash
npx @elgato/cli validate  # Check manifest
npx @elgato/cli pack       # Create .streamDeckPlugin file
```
