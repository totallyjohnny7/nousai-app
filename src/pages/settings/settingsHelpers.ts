import type { AIConfig, AIFeatureSlot, AIProvider, SlotConfig, StudyPrefs, DisplayPrefs } from './settingsTypes'

// ─── AI Config localStorage helpers ─────────────────────────
export function getAIConfig(): AIConfig {
  return {
    provider: (localStorage.getItem('nousai-ai-provider') || 'none') as AIProvider,
    apiKey: localStorage.getItem('nousai-ai-apikey') || '',
    model: localStorage.getItem('nousai-ai-model') || '',
    baseUrl: localStorage.getItem('nousai-ai-baseurl') || '',
    customModel: localStorage.getItem('nousai-ai-custom-model') || '',
    temperature: parseFloat(localStorage.getItem('nousai-ai-temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('nousai-ai-max-tokens') || '2048'),
    systemPrompt: localStorage.getItem('nousai-ai-system-prompt') || '',
    streaming: localStorage.getItem('nousai-ai-streaming') !== 'false',
    responseFormat: localStorage.getItem('nousai-ai-response-format') || 'text',
    orVariant: localStorage.getItem('nousai-ai-or-variant') || '',
    orFallback: localStorage.getItem('nousai-ai-or-fallback') || '',
    orSort: localStorage.getItem('nousai-ai-or-sort') || 'auto',
    orWebSearch: localStorage.getItem('nousai-ai-or-websearch') === 'true',
    orReasoning: localStorage.getItem('nousai-ai-or-reasoning') === 'true',
    orReasoningEffort: localStorage.getItem('nousai-ai-or-reasoning-effort') || 'medium',
    orHealing: localStorage.getItem('nousai-ai-or-healing') === 'true',
  }
}

export function saveAIConfig(config: AIConfig) {
  localStorage.setItem('nousai-ai-provider', config.provider)
  localStorage.setItem('nousai-ai-apikey', config.apiKey)
  localStorage.setItem('nousai-ai-model', config.model)
  localStorage.setItem('nousai-ai-baseurl', config.baseUrl)
  localStorage.setItem('nousai-ai-custom-model', config.customModel)
  localStorage.setItem('nousai-ai-temperature', String(config.temperature))
  localStorage.setItem('nousai-ai-max-tokens', String(config.maxTokens))
  localStorage.setItem('nousai-ai-system-prompt', config.systemPrompt)
  localStorage.setItem('nousai-ai-streaming', String(config.streaming))
  localStorage.setItem('nousai-ai-response-format', config.responseFormat)
  localStorage.setItem('nousai-ai-or-variant', config.orVariant)
  localStorage.setItem('nousai-ai-or-fallback', config.orFallback)
  localStorage.setItem('nousai-ai-or-sort', config.orSort)
  localStorage.setItem('nousai-ai-or-websearch', String(config.orWebSearch))
  localStorage.setItem('nousai-ai-or-reasoning', String(config.orReasoning))
  localStorage.setItem('nousai-ai-or-reasoning-effort', config.orReasoningEffort)
  localStorage.setItem('nousai-ai-or-healing', String(config.orHealing))
}

// ─── Feature Slot Config helpers ────────────────────────────
export function getSlotConfig(slot: AIFeatureSlot): SlotConfig {
  return {
    provider: localStorage.getItem(`nousai-ai-slot-${slot}-provider`) || '',
    apiKey:   localStorage.getItem(`nousai-ai-slot-${slot}-apikey`) || '',
    model:    localStorage.getItem(`nousai-ai-slot-${slot}-model`) || '',
  }
}

export function saveSlotConfig(slot: AIFeatureSlot, cfg: SlotConfig) {
  if (!cfg.provider) {
    localStorage.removeItem(`nousai-ai-slot-${slot}-provider`)
    localStorage.removeItem(`nousai-ai-slot-${slot}-apikey`)
    localStorage.removeItem(`nousai-ai-slot-${slot}-model`)
  } else {
    localStorage.setItem(`nousai-ai-slot-${slot}-provider`, cfg.provider)
    localStorage.setItem(`nousai-ai-slot-${slot}-apikey`, cfg.apiKey)
    localStorage.setItem(`nousai-ai-slot-${slot}-model`, cfg.model)
  }
}

// ─── Study Prefs helpers ────────────────────────────────────
export function getStudyPrefs(): StudyPrefs {
  return {
    dailyXpGoal: parseInt(localStorage.getItem('nousai-pref-daily-xp') || '100'),
    quizQuestionCount: parseInt(localStorage.getItem('nousai-pref-quiz-count') || '20'),
    flashcardAutoFlip: localStorage.getItem('nousai-pref-flashcard-flip') || 'off',
    pomoWork: parseInt(localStorage.getItem('nousai-pref-pomo-work') || '20'),
    pomoBreak: parseInt(localStorage.getItem('nousai-pref-pomo-break') || '10'),
    language: localStorage.getItem('nousai-pref-language') || 'English',
    difficulty: localStorage.getItem('nousai-pref-difficulty') || 'Medium',
    soundEffects: localStorage.getItem('nousai-pref-sound') !== 'false',
  }
}

export function saveStudyPrefs(prefs: StudyPrefs) {
  localStorage.setItem('nousai-pref-daily-xp', String(prefs.dailyXpGoal))
  localStorage.setItem('nousai-pref-quiz-count', String(prefs.quizQuestionCount))
  localStorage.setItem('nousai-pref-flashcard-flip', prefs.flashcardAutoFlip)
  localStorage.setItem('nousai-pref-pomo-work', String(prefs.pomoWork))
  localStorage.setItem('nousai-pref-pomo-break', String(prefs.pomoBreak))
  localStorage.setItem('nousai-pref-language', prefs.language)
  localStorage.setItem('nousai-pref-difficulty', prefs.difficulty)
  localStorage.setItem('nousai-pref-sound', String(prefs.soundEffects))
}

// ─── Display Prefs helpers ──────────────────────────────────
export function getDisplayPrefs(): DisplayPrefs {
  return {
    fontSize: localStorage.getItem('nousai-pref-fontsize') || 'medium',
    compactMode: localStorage.getItem('nousai-pref-compact') === 'true',
    accentColor: localStorage.getItem('nousai-pref-accent') || '#F5A623',
    highContrast: localStorage.getItem('nousai-pref-highcontrast') === 'true',
    colorBlind: localStorage.getItem('nousai-pref-colorblind') === 'true',
    reducedMotion: localStorage.getItem('nousai-pref-reducedmotion') === 'true',
  }
}

export function saveDisplayPrefs(prefs: DisplayPrefs) {
  localStorage.setItem('nousai-pref-fontsize', prefs.fontSize)
  localStorage.setItem('nousai-pref-compact', String(prefs.compactMode))
  localStorage.setItem('nousai-pref-accent', prefs.accentColor)
  localStorage.setItem('nousai-pref-highcontrast', String(prefs.highContrast))
  localStorage.setItem('nousai-pref-colorblind', String(prefs.colorBlind))
  localStorage.setItem('nousai-pref-reducedmotion', String(prefs.reducedMotion))
  const sizes: Record<string, string> = { small: '13px', medium: '15px', large: '17px' }
  document.documentElement.style.setProperty('--base-font-size', sizes[prefs.fontSize] || '15px')
  document.documentElement.classList.toggle('compact-mode', prefs.compactMode)
  document.documentElement.style.setProperty('--color-accent', prefs.accentColor)
  document.documentElement.toggleAttribute('data-high-contrast', prefs.highContrast)
  document.documentElement.toggleAttribute('data-colorblind', prefs.colorBlind)
  document.documentElement.toggleAttribute('data-reduced-motion', prefs.reducedMotion)
}

// ─── Blank workspace helper ─────────────────────────────────
export function createBlankWorkspace() {
  return {
    settings: {
      aiProvider: '',
      canvasUrl: '',
      canvasToken: '',
      canvasIcalUrl: '',
      canvasEvents: [],
    },
    pluginData: {
      quizHistory: [],
      coachData: { courses: [], sessions: [], streak: 0, totalStudyMinutes: 0, weeklyPlan: null },
      proficiencyData: { settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 }, subjects: {} },
      srData: { cards: [] },
      timerState: {
        swRunning: false, swAccumulatedMs: 0, swResumedAt: null, swCourseId: '', swType: 'review',
        pomoRunning: false, pomoEndTime: null, pomoWorkMin: 20, pomoBreakMin: 10,
        pomoLongBreakMin: 15, pomoPhase: 'idle', pomoSession: 0, pomoTotalSessions: 0,
        pomoRemainingMs: 0, savedAt: Date.now(),
      },
      gamificationData: {
        xp: 0, level: 1, totalQuizzes: 0, totalCorrect: 0, totalAnswered: 0,
        totalMinutes: 0, streak: 0, bestStreak: 0, streakFreezes: 0,
        lastStudyDate: null, perfectScores: 0,
        badges: [], dailyGoal: { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 100 },
      },
      quizBank: {},
      notes: [],
      drawings: [],
      studySessions: [],
      matchSets: [],
    },
  }
}

// ─── Formatting helpers ─────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
