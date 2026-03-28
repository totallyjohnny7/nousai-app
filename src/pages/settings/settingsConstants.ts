import type { AIFeatureSlot } from './settingsTypes'

export const PROVIDER_INFO: Record<string, { label: string; color: string; url: string; keyPrefix: string }> = {
  openai: { label: 'OpenAI', color: '#10a37f', url: 'https://platform.openai.com/api-keys', keyPrefix: 'sk-' },
  anthropic: { label: 'Anthropic', color: '#d4a574', url: 'https://console.anthropic.com/settings/keys', keyPrefix: 'sk-ant-' },
  openrouter: { label: 'OpenRouter', color: '#6366f1', url: 'https://openrouter.ai/keys', keyPrefix: 'sk-or-' },
  google: { label: 'Google AI', color: '#4285f4', url: 'https://aistudio.google.com/apikey', keyPrefix: 'AI' },
  groq: { label: 'Groq', color: '#f55036', url: 'https://console.groq.com/keys', keyPrefix: 'gsk_' },
  mistral: { label: 'Mistral', color: '#f97316', url: 'https://console.mistral.ai/api-keys', keyPrefix: '' },
  custom: { label: 'Custom', color: '#888', url: '', keyPrefix: '' },
}

export const SLOT_INFO: Record<AIFeatureSlot, { label: string; description: string }> = {
  chat:       { label: 'Chat & Tutor',  description: 'AI Tutor, chat, Feynman mode, quiz chat' },
  generation: { label: 'Generation',    description: 'Flashcard, quiz, course & schedule generation' },
  analysis:   { label: 'Analysis',      description: 'Fact-check, TLDR, re-explain, formula analysis' },
  ocr:        { label: 'PDF & Image OCR', description: 'Document / image text extraction (requires Mistral key for OCR)' },
  japanese:   { label: 'Japanese',      description: 'Japanese study tools, JP quiz & flashcards' },
  physics:    { label: 'Physics',       description: 'Physics lab simulation code generation' },
  omni:       { label: 'Omni Protocol', description: 'Omni Protocol study session AI calls' },
}

export const OPENAI_MODELS = [
  { value: 'gpt-5.4', label: 'GPT-5.4 (Latest - Mar 2026)' },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex (Agentic Coding)' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'o3-mini', label: 'o3-mini (Reasoning)' },
  { value: 'o1', label: 'o1 (Reasoning)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
]

export const ANTHROPIC_MODELS = [
  { value: 'claude-opus-4-6-20260217', label: 'Claude Opus 4.6 (Latest - Feb 2026)' },
  { value: 'claude-sonnet-4-6-20260217', label: 'Claude Sonnet 4.6 (1M context)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
]

export const OPENROUTER_MODELS = [
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6 (Latest)' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 (Latest)' },
  { value: 'openai/gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  { value: 'openai/o3-mini', label: 'o3-mini (Reasoning)' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
  { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
  { value: 'deepseek/deepseek-chat-v3', label: 'DeepSeek V3' },
  { value: 'mistralai/mistral-large-2411', label: 'Mistral Large' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
]

export const GOOGLE_MODELS = [
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Latest)' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
]

export const MISTRAL_MODELS = [
  { value: 'mistral-large-latest', label: 'Mistral Large (Latest)' },
  { value: 'mistral-medium-latest', label: 'Mistral Medium' },
  { value: 'mistral-small-latest', label: 'Mistral Small' },
  { value: 'mistral-nemo', label: 'Mistral Nemo' },
  { value: 'codestral-latest', label: 'Codestral (Code)' },
]

export const GROQ_MODELS = [
  { value: 'llama-4-maverick', label: 'Llama 4 Maverick' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Instant)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
]

export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Japanese',
  'Chinese', 'Korean', 'Portuguese', 'Italian', 'Russian',
  'Arabic', 'Hindi',
]

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
