// ─── Settings Types ─────────────────────────────────────────
export type SectionId = 'account' | 'ai' | 'extensions' | 'study' | 'display' | 'permissions' | 'data' | 'howto' | 'appinfo' | 'spotify' | 'inputdevices' | 'guide'

export type AIProvider = 'none' | 'openai' | 'anthropic' | 'openrouter' | 'google' | 'groq' | 'mistral' | 'custom'

export type AIFeatureSlot = 'chat' | 'generation' | 'analysis' | 'ocr' | 'japanese' | 'physics' | 'omni'

export interface SlotConfig { provider: string; apiKey: string; model: string }

export type AIConfig = {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl: string
  customModel: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  streaming: boolean
  responseFormat: string
  orVariant: string
  orFallback: string
  orSort: string
  orWebSearch: boolean
  orReasoning: boolean
  orReasoningEffort: string
  orHealing: boolean
}

export type StudyPrefs = {
  dailyXpGoal: number
  quizQuestionCount: number
  flashcardAutoFlip: string
  pomoWork: number
  pomoBreak: number
  language: string
  difficulty: string
  soundEffects: boolean
}

export type DisplayPrefs = {
  fontSize: string
  compactMode: boolean
  accentColor: string
  highContrast: boolean
  colorBlind: boolean
  reducedMotion: boolean
}
