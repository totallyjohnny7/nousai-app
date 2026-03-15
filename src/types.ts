/* ── Plugin data.json types ────────────────────────────── */

export interface PdfCard {
  question: string
  answer: string
  type: 'mcq' | 'vocab'
  choices?: string[]
}

export interface CanvasEvent {
  title: string;
  start: string;
  end: string;
  description: string;
  uid: string;
  location: string;
  allDay: boolean;
  completed: boolean;
}

export interface QuizAnswer {
  question: {
    type: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
  };
  userAnswer: string;
  correct: boolean;
  timeMs: number;
}

export interface QuizAttempt {
  id: string;
  name: string;
  subject: string;
  subtopic: string;
  date: string;
  questionCount: number;
  score: number;
  correct: number;
  mode: string;
  questions: unknown[];
  answers: QuizAnswer[];
  folder?: string;
}

export interface FlashcardItem {
  front: string;
  back: string;
  topic?: string;
  media?: {
    type: 'youtube' | 'image' | 'video';
    src: string;
    side: 'front' | 'back' | 'both';
    caption?: string;
  };
}

export interface CourseTopic {
  id: string;
  name: string;
  status?: string;
  completed?: boolean;
  subtopics?: { id: string; name: string; status?: string; content?: string }[];
  links?: string[]; // IDs of linked topics
  summary?: string; // AI-generated topic summary
  prerequisites?: string[]; // IDs of prerequisite topics
  difficulty?: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes?: number;
}

export interface CourseModule {
  id: string;
  name: string;
  topicIds: string[]; // ordered list of CourseTopic IDs in this module
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
  color: string;
  topics: CourseTopic[];
  flashcards: FlashcardItem[];
  modules?: CourseModule[];
}

export interface CoachData {
  courses: Course[];
  sessions: unknown[];
  streak: number;
  totalStudyMinutes: number;
  weeklyPlan: unknown;
}

export interface ProficiencyEntry {
  subject: string;
  subtopic: string;
  attempts: { date: string; percentage: number }[];
  proficiencyScore: number;
  isProficient: boolean;
  currentStreak: number;
  bestStreak: number;
}

export interface ProficiencyData {
  settings: {
    proficiencyThreshold: number;
    minAttempts: number;
    recentWeight: number;
  };
  subjects: Record<string, Record<string, ProficiencyEntry>>;
}

export interface SRCard {
  key: string;
  subject: string;
  subtopic: string;
  S: number;
  D: number;
  reps: number;
  lapses: number;
  state: string;
  lastReview: string;
  nextReview: string;
  elapsedDays: number;
  scheduledDays: number;
  history: { date: string; grade: number; S: number; D: number; R: number; interval: number }[];
  questionText?: string;
  needsElaboration?: boolean;
}

export interface SRData {
  cards: SRCard[];
}

export interface TimerState {
  swRunning: boolean;
  swAccumulatedMs: number;
  swResumedAt: string | null;
  swCourseId: string;
  swType: string;
  pomoRunning: boolean;
  pomoEndTime: string | null;
  pomoWorkMin: number;
  pomoBreakMin: number;
  pomoLongBreakMin: number;
  pomoPhase: string;
  pomoSession: number;
  pomoTotalSessions: number;
  pomoRemainingMs: number;
  savedAt: number;
}

export interface Badge {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  earnedAt: string;
}

export interface GamificationData {
  xp: number;
  level: number;
  totalQuizzes: number;
  totalCorrect: number;
  totalAnswered: number;
  totalMinutes: number;
  streak: number;
  bestStreak: number;
  streakFreezes: number;
  lastStudyDate: string | null;
  perfectScores: number;
  badges: Badge[];
  dailyGoal: {
    todayXp: number;
    todayMinutes: number;
    todayQuestions: number;
    targetXp: number;
  };
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  courseId?: string;
  topicIds?: string[];
  createdAt: string;
  updatedAt: string;
  type: 'note' | 'quiz' | 'flashcard' | 'ai-output' | 'match';
  labHtml?: string;
  pinned?: boolean;
}

export interface Drawing {
  id: string;
  name: string;
  data: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  folder?: string;
  template?: string;
}

export interface StudySession {
  id: string;
  courseId: string;
  type: string;
  durationMs: number;
  date: string;
  notes?: string;
  topicId?: string; // #92 Time-Per-Topic Tracking
}

export interface WeeklyPlan {
  weekOf: string;
  notes?: string;
  days: {
    day: string;
    blocks: { courseId: string; type: string; minutes: number; description: string; done?: boolean }[];
  }[];
}

export interface Assignment {
  id: string;
  name: string;
  courseId: string;
  dueDate: string;
  type: string;
  weight?: number;
  completed?: boolean;
}

export interface StudyBlock {
  id: string;
  date: string; // ISO date string
  courseId: string;
  courseName: string;
  topic: string;
  durationMin: number;
  type: 'review' | 'learn' | 'practice' | 'exam-prep';
  done?: boolean;
}

export interface StudySchedule {
  id: string;
  courseName: string;
  examDate: string;
  hoursPerWeek: number;
  blocks: StudyBlock[];
  createdAt: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
  extendedProperties?: { private?: Record<string, string> };
}

export interface QuizAnnotation {
  id: string;
  contentId: string;       // question ID (fc-* or jpq_* etc.)
  subjectTag: string;      // course name / subject label
  textContent?: string;    // markdown text note
  canvasStorageKey?: string; // IDB key for canvas PNG (never synced to Firestore)
  createdAt: string;
  updatedAt: string;
}

export interface AIChatSession {
  id: string;
  title: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginData {
  quizHistory: QuizAttempt[];
  coachData: CoachData;
  proficiencyData: ProficiencyData;
  srData: SRData;
  timerState: TimerState;
  gamificationData: GamificationData;
  quizBank: Record<string, unknown>;
  notes?: Note[];
  drawings?: Drawing[];
  studySessions?: StudySession[];
  weeklyPlan?: WeeklyPlan;
  assignments?: Assignment[];
  matchSets?: { id: string; name: string; subject: string; pairs: { term: string; definition: string }[]; createdAt: string }[];
  knowledgeWeb?: { id: string; from: string; to: string; relation: string }[];
  studySchedules?: StudySchedule[];
  annotations?: QuizAnnotation[];
  aiChatSessions?: AIChatSession[];
  goals?: StudyGoal[];
  weeklyQuests?: WeeklyQuest[];
  userProfile?: { avatarEmoji?: string; customDisplayName?: string; bio?: string; };
  loginHistory?: { timestamp: string; device: string; }[];
  notificationPrefs?: { reviewReminders: boolean; streakAlerts: boolean; pomodoroAlerts: boolean; reminderTime: string; };
  [key: string]: unknown;
}

export interface StudyGoal {
  id: string;
  type: 'finish_course' | 'xp' | 'streak' | 'quizzes';
  label: string;
  target: number;
  progress: number;
  deadline?: string;
  courseId?: string;
  createdAt: string;
}

export interface WeeklyQuest {
  id: string;
  label: string;
  target: number;
  progress: number;
  xpReward: number;
  weekKey: string; // YYYY-WNN
  completed: boolean;
}

export interface NousAIData {
  settings: {
    aiProvider: string;
    canvasUrl: string;
    canvasToken: string;
    canvasIcalUrl: string;
    canvasEvents: CanvasEvent[];
    lastCanvasSync?: string;
    canvasCourseMapping?: Record<string, number>;
    theme?: 'light' | 'dark' | 'system';
    cardShortcuts?: Record<string, string>;
    [key: string]: unknown;
  };
  pluginData: PluginData;
}

// ── Nous AI Panel — Page Context ─────────────────────────
export interface PageContext {
  page: string          // Display name, e.g. "Flashcards"
  summary: string       // One-line summary, e.g. "Reviewing: Cell Biology — 12 cards due"
  activeItem?: string   // Content of the focused item (card front/back, open note, current question)
  fullContent?: string  // Broader page content (all cards, all note titles, quiz history)
}

// ── Nous AI Panel — Attached File ────────────────────────
export interface AttachedFile {
  name: string
  type: 'image' | 'pdf' | 'text'
  content: string       // base64 data URL for images; extracted UTF-8 text for pdf/text
  mimeType: string
  sizeBytes: number
}
