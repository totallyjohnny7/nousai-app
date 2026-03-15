# AI Tool Pipeline

## Overview
How user text flows through the AI tool system to produce rendered output.

## Flow
1. **Input text** — user types or pastes content (or a course topic is passed automatically)
2. **callAI()** — central function in `src/utils/ai.ts`, handles all providers
3. **Provider selection** — reads `settings.aiProvider` (OpenAI, Claude, Groq, Gemini, etc.)
4. **In-memory cache check** — avoids redundant API calls for identical inputs
   - Cache hit → return cached result instantly
   - Cache miss → make streaming API call
5. **Streaming output** — SSE / ReadableStream for progressive rendering
6. **Rendered output** — Markdown via `renderMd.ts`, math via KaTeX (`import katex from 'katex'`)

## Error Isolation
`ToolErrorBoundary` wraps each AI tool component. If one tool throws (bad API key, parse error, etc.), only that tool shows an error state — the rest of the page continues working.

## AI Tools
Located in `src/components/aitools/`:
- `OcrTool` — image to text via AI vision
- `DictateTool` — speech to text
- `AnalogyTool` — generate analogies for concepts
- `MindMapTool` — concept map generation
- `FactCheckTool` — Valyu-powered fact verification
- `CourseGenTool` — AI course outline generation
- `OmiTool`, `JpStudyTool`, `PhysicsSimTool`, `RenameTool`

## Key Files
- `src/utils/ai.ts` — `callAI()`, provider routing, streaming, cache
- `src/utils/valyu.ts` — Valyu API integration (fact checking / context verification)
- `src/utils/renderMd.ts` — markdown rendering
- `src/components/ToolErrorBoundary.tsx` — crash isolation
- `src/components/aitools/shared.ts` — shared types + helpers
