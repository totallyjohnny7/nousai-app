# OpenRouter Advanced Features — Full Integration Roadmap

> **Source:** Complete OpenRouter documentation at https://openrouter.ai/docs/quickstart
> **Date:** 2026-03-26
> **Current state:** OpenRouter is integrated as a provider but only uses basic chat completions with image support. All advanced features below are untapped.

---

## Feature Inventory (35 features, mapped to NousAI)

### A. Multimodal Capabilities

| # | Feature | Status | OpenRouter API | NousAI Tools That Benefit |
|---|---------|--------|----------------|--------------------------|
| 1 | Image inputs | **Done** | `image_url` content part | ScreenLassoTool, HandwritingOverlay, SolverMode |
| 2 | Image generation | Missing | `modalities: ['image','text']`, `image_config: { aspect_ratio, image_size }` | FlashcardGenTool (diagrams), MindMapTool, PhysicsSimTool |
| 3 | PDF inputs | Missing | `type: 'file'` content part + `file-parser` plugin | PdfUploaderTool, OcrTool — use ANY model, not just Mistral OCR |
| 4 | Audio input | Missing | `type: 'input_audio'` content part (base64, wav/mp3/etc) | DictateTool — send audio to AI for transcription+analysis in one step |
| 5 | Audio output | Missing | `modalities: ['text','audio']`, `audio: { voice, format }` | JpStudyTool (pronunciation), TutorTool (spoken explanations) |
| 6 | Video input | Missing | `type: 'video_url'` content part (URL or base64) | VideoTool — analyze lecture videos directly |

#### Implementation: Expand `AIContentPart` type

```typescript
// src/utils/ai.ts — expand union
export type AIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }           // PDF
  | { type: 'input_audio'; input_audio: { data: string; format: string } }    // Audio
  | { type: 'video_url'; video_url: { url: string } }                         // Video
```

#### PDF Input Example (OpenRouter format)
```typescript
{
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Summarize this document' },
      { type: 'file', file: { filename: 'notes.pdf', file_data: 'data:application/pdf;base64,...' } }
    ]
  }],
  plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }]  // free engine
}
```

#### Image Generation Example
```typescript
{
  model: 'google/gemini-2.5-flash-image',
  messages: [{ role: 'user', content: 'Draw a diagram of mitosis phases' }],
  modalities: ['image', 'text'],
  image_config: { aspect_ratio: '16:9', image_size: '1K' }
}
// Response: choices[0].message.images[].image_url.url = "data:image/png;base64,..."
```

#### Audio Input Example
```typescript
{
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Transcribe and summarize this lecture' },
      { type: 'input_audio', input_audio: { data: base64Audio, format: 'wav' } }
    ]
  }]
}
```

---

### B. Routing & Reliability

| # | Feature | Status | OpenRouter API | Benefit |
|---|---------|--------|----------------|---------|
| 7 | Model fallbacks | Missing | `models: ['primary', 'fallback1', 'fallback2']` | Auto-failover when primary model is down |
| 8 | Provider routing | Missing | `provider: { sort, order, only, ignore }` | Cost/speed optimization for students |
| 9 | Performance thresholds | Missing | `provider: { preferred_min_throughput, preferred_max_latency }` | Consistent response times |
| 10 | Auto Exacto | Free | Automatic for tool-calling requests | Better tool-call routing (no config needed) |
| 11 | Max price | Missing | `provider: { max_price: { prompt: N, completion: N } }` | Budget protection |
| 12 | Data policy | Missing | `provider: { data_collection: 'deny', zdr: true }` | Privacy for sensitive study data |
| 13 | Require parameters | Missing | `provider: { require_parameters: true }` | Ensure JSON/tools actually supported |
| 14 | Uptime optimization | Free | Default load balancing | Already active, no config needed |

#### Model Fallbacks Example
```typescript
{
  model: 'google/gemini-3-flash-preview',
  models: ['google/gemini-3-flash-preview', 'anthropic/claude-sonnet-4.5', 'openai/gpt-4o'],
  messages: [...]
}
// If Gemini is down, tries Claude, then GPT-4o automatically
```

#### Provider Routing Example
```typescript
{
  model: 'google/gemini-3-flash-preview',
  provider: {
    sort: 'throughput',             // fastest provider wins
    allow_fallbacks: true,
    data_collection: 'deny',        // no data-storing providers
    max_price: { prompt: 1, completion: 3 }  // max $/M tokens
  }
}
```

---

### C. Model Variants

| # | Variant | Status | Effect | Best For |
|---|---------|--------|--------|----------|
| 15 | `:free` | Partial* | Free tier of model | Students on budget |
| 16 | `:nitro` | Missing | Sort by throughput | Fast generation (FlashcardGenTool) |
| 17 | `:online` | Missing | Web search enabled | FactCheckTool, current events |
| 18 | `:thinking` | Missing | Extended reasoning | Analysis slot, complex problems |
| 19 | `:extended` | Missing | Extended context window | OmniProtocol, long sessions |
| 20 | `:exacto` | Missing | Quality-first tool routing | Tool-calling accuracy |
| 21 | `:floor` | Missing | Sort by lowest price | Budget optimization |

*`:free` is detected in study-gen code but not user-selectable in Settings UI.

#### Usage
```typescript
// Just append to model slug:
{ model: 'google/gemini-3-flash-preview:online' }  // web search
{ model: 'google/gemini-3-flash-preview:nitro' }    // fastest provider
{ model: 'google/gemini-3-flash-preview:free' }     // free tier
{ model: 'deepseek/deepseek-r1:thinking' }          // reasoning mode
```

---

### D. Routers

| # | Router | Status | Model ID | Use Case |
|---|--------|--------|----------|----------|
| 22 | Auto Router | **Done** | `openrouter/auto` | Default for all 7 feature slots |
| 23 | Body Builder | Missing | `openrouter/bodybuilder` | Compare answers across models (free) |
| 24 | Free Models Router | Missing | `openrouter/free` | Zero-cost random free model |

---

### E. Plugins

| # | Plugin | Status | API | NousAI Benefit |
|---|--------|--------|-----|----------------|
| 25 | Web Search | Missing | `plugins: [{ id: 'web', max_results: 5 }]` | FactCheckTool verification, TutorTool current info |
| 26 | Response Healing | Missing | `plugins: [{ id: 'response-healing' }]` | Fix malformed JSON from FlashcardGen, QuizGen, CourseGen |
| 27 | Context Compression | Missing | `plugins: [{ id: 'context-compression' }]` | OmniProtocol & AIChatTool long sessions (replaces hard 40-msg cut) |
| 28 | File Parser (PDF) | Missing | `plugins: [{ id: 'file-parser', pdf: { engine } }]` | PdfUploaderTool with any model |

#### Web Search Plugin Example
```typescript
{
  model: 'google/gemini-3-flash-preview',
  messages: [{ role: 'user', content: 'Is this claim true: ...' }],
  plugins: [
    { id: 'web', max_results: 3, search_prompt: 'Verify with these sources:' }
  ]
}
// Response includes annotations with url_citation objects
```

#### Response Healing — Auto-fix JSON
```typescript
{
  model: 'google/gemini-3-flash-preview',
  messages: [...],
  response_format: { type: 'json_schema', json_schema: { name: 'flashcards', schema: {...} } },
  plugins: [{ id: 'response-healing' }]  // fixes missing brackets, trailing commas, etc.
}
```

---

### F. Advanced Features

| # | Feature | Status | API | NousAI Benefit |
|---|---------|--------|-----|----------------|
| 29 | Structured Outputs | Missing | `response_format: { type: 'json_schema', json_schema: {...} }` | Reliable JSON from all gen tools (vs current `json_object`) |
| 30 | Tool/Function Calling | Missing | `tools: [...]`, `tool_choice` | Agentic tutoring, multi-step research |
| 31 | Reasoning Tokens | Missing | `reasoning: { effort, max_tokens, exclude }` | FactCheckTool, PrerequisiteTool quality boost |
| 32 | Prompt Caching | Missing | `cache_control: { type: 'ephemeral' }` on messages | Cost savings on repeated system prompts |
| 33 | Presets | Missing | `model: '@preset/slug'` | Saved AI configs per workflow |
| 34 | Message Transforms | Missing | Context compression plugin | Long conversation handling |
| 35 | Guardrails | Missing | API-based spending limits, model allowlists | Student budget protection |

#### Structured Outputs (upgrade from json_object)
```typescript
// CURRENT (unreliable):
{ response_format: { type: 'json_object' } }

// UPGRADE (schema-validated):
{
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'flashcards',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string' },
                back: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } }
              },
              required: ['front', 'back'],
              additionalProperties: false
            }
          }
        },
        required: ['cards'],
        additionalProperties: false
      }
    }
  }
}
```

#### Reasoning Tokens
```typescript
// For analysis-heavy tools (FactCheck, Prerequisites, Omni):
{
  model: 'google/gemini-3-flash-preview',
  messages: [...],
  reasoning: {
    effort: 'high',     // xhigh | high | medium | low | minimal | none
    exclude: false       // include reasoning in response for transparency
  }
}
// Response: choices[0].message.reasoning = "Let me think through this..."
```

#### Prompt Caching (Anthropic via OpenRouter)
```typescript
// Cache large system prompts (e.g., OmniProtocol 4000-word study guide):
{
  messages: [{
    role: 'system',
    content: [{
      type: 'text',
      text: 'You are an expert tutor. Here is the study material:'
    }, {
      type: 'text',
      text: 'HUGE_STUDY_GUIDE_TEXT',
      cache_control: { type: 'ephemeral' }  // cached 5 min, 0.1x read cost
    }]
  }]
}
```

---

## Priority Implementation Order

### Tier 1 — Implement Now (high impact, low effort)
1. **Model variants** — dropdown in Settings, append suffix to model slug
2. **Model fallbacks** — `models` array in OpenRouter requests
3. **Provider routing** — `provider.sort` dropdown in Settings
4. **Web search plugin** — toggle in Settings, add `plugins` to request
5. **Reasoning tokens** — toggle + effort level, add `reasoning` to request
6. **Structured outputs** — upgrade `json_object` → `json_schema` with schemas

### Tier 2 — Implement Next (high impact, medium effort)
7. PDF inputs via OpenRouter file content type
8. Response healing plugin for JSON requests
9. Context compression plugin for long chats
10. Image generation with modalities parameter

### Tier 3 — Implement Later (medium impact, higher effort)
11. Audio input for DictateTool
12. Audio output for JpStudyTool/TutorTool
13. Video input for VideoTool
14. Tool/function calling support
15. Prompt caching for system messages
16. Presets system for saved AI configs
17. Guardrails/spending limits

---

## Settings UI Changes Needed

When provider is `openrouter`, add under Advanced Options:

```
OpenRouter Features
├── Model Variant:     [none ▼] (:free, :nitro, :online, :thinking, :extended, :exacto, :floor)
├── Fallback Model:    [________________________] (e.g. anthropic/claude-sonnet-4.5)
├── Provider Sort:     [Auto ▼] (Auto, Price, Throughput, Latency)
├── Web Search:        [toggle] "Augment responses with web results (+$0.02/req)"
├── Reasoning:         [toggle] + [medium ▼] (minimal, low, medium, high, xhigh)
└── Response Healing:  [toggle] "Auto-fix malformed JSON responses"
```

## localStorage Keys

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `nousai-ai-or-variant` | string | `''` | Model variant suffix |
| `nousai-ai-or-fallback` | string | `''` | Fallback model ID |
| `nousai-ai-or-sort` | string | `'auto'` | Provider sort |
| `nousai-ai-or-websearch` | string | `'false'` | Web search toggle |
| `nousai-ai-or-reasoning` | string | `'false'` | Reasoning toggle |
| `nousai-ai-or-reasoning-effort` | string | `'medium'` | Reasoning effort |
| `nousai-ai-or-healing` | string | `'false'` | Response healing toggle |
