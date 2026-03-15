/**
 * Gamification / XP System
 * Ported from NousAI Obsidian plugin
 */

import type { GamificationData, Badge } from '../types';

// ─── Badge Definitions ──────────────────────────────────

interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (data: GamificationData) => boolean;
}

const BADGE_DEFS: BadgeDef[] = [
  { id: 'first_quiz', name: 'First Quiz', icon: '🎯', description: 'Complete your first quiz', check: d => d.totalQuizzes >= 1 },
  { id: 'quiz_veteran', name: 'Quiz Veteran', icon: '🏆', description: 'Complete 10 quizzes', check: d => d.totalQuizzes >= 10 },
  { id: 'week_warrior', name: 'Week Warrior', icon: '🔥', description: '7-day study streak', check: d => d.streak >= 7 },
  { id: 'monthly_master', name: 'Monthly Master', icon: '👑', description: '30-day study streak', check: d => d.streak >= 30 },
  { id: 'dedicated', name: 'Dedicated', icon: '⏰', description: 'Study for 10 hours total', check: d => d.totalMinutes >= 600 },
  { id: 'scholar', name: 'Scholar', icon: '📚', description: 'Study for 50 hours total', check: d => d.totalMinutes >= 3000 },
  { id: 'perfectionist', name: 'Perfectionist', icon: '💯', description: 'Get a perfect quiz score', check: d => d.perfectScores >= 1 },
  { id: 'rising_star', name: 'Rising Star', icon: '⭐', description: 'Reach level 5', check: d => Math.floor(d.xp / 100) + 1 >= 5 },
  { id: 'ascendant', name: 'Ascendant', icon: '🚀', description: 'Reach level 10', check: d => Math.floor(d.xp / 100) + 1 >= 10 },
  // #62 15 More Badges
  { id: 'centurion', name: 'Centurion', icon: '💯', description: 'Complete 100 quizzes', check: d => d.totalQuizzes >= 100 },
  { id: 'marathon', name: 'Marathon', icon: '🏃', description: '30-day study streak', check: d => d.bestStreak >= 30 },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', description: 'Answer 500 questions total', check: d => d.totalAnswered >= 500 },
  { id: 'early_bird', name: 'Early Bird', icon: '🐦', description: 'Answer 1,000 questions total', check: d => d.totalAnswered >= 1000 },
  { id: 'math_wizard', name: 'Math Wizard', icon: '🧙', description: 'Get 10 perfect scores', check: d => d.perfectScores >= 10 },
  { id: 'speed_demon', name: 'Speed Demon', icon: '⚡', description: '5 perfect scores in a row (best streak)', check: d => (d.bestStreak || 0) >= 5 && d.perfectScores >= 5 },
  { id: 'grinder', name: 'Grinder', icon: '⚙️', description: 'Study 100 hours total', check: d => d.totalMinutes >= 6000 },
  { id: 'legend', name: 'Legend', icon: '🌟', description: 'Reach level 25', check: d => Math.floor(d.xp / 100) + 1 >= 25 },
  { id: 'quiz_master_50', name: 'Quiz Master', icon: '🎓', description: 'Complete 50 quizzes', check: d => d.totalQuizzes >= 50 },
  { id: 'correct_500', name: 'Accuracy Pro', icon: '🎯', description: '500 correct answers total', check: d => (d.totalCorrect || 0) >= 500 },
  { id: 'xp_1000', name: 'XP Hoarder', icon: '💎', description: 'Earn 1,000 XP', check: d => d.xp >= 1000 },
  { id: 'xp_5000', name: 'XP Legend', icon: '👾', description: 'Earn 5,000 XP', check: d => d.xp >= 5000 },
  { id: 'streak_14', name: 'Two Weeks', icon: '📆', description: '14-day study streak', check: d => d.streak >= 14 },
  { id: 'study_25h', name: 'Study Hard', icon: '📖', description: 'Study for 25 hours total', check: d => d.totalMinutes >= 1500 },
  { id: 'perfect_5', name: 'High Scorer', icon: '🌠', description: 'Get 5 perfect quiz scores', check: d => d.perfectScores >= 5 },
];

// ─── Level Titles ───────────────────────────────────────

const TITLES = [
  'Novice', 'Apprentice', 'Student', 'Scholar', 'Adept',
  'Expert', 'Master', 'Sage', 'Grandmaster', 'Legend'
];

// ─── Core Functions ─────────────────────────────────────

/** Calculate level from XP (every 100 XP = 1 level) */
export function getLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

/** Get XP progress within current level (0-99) */
export function getLevelProgress(xp: number): number {
  return xp % 100;
}

/** Get title for a level */
export function getTitle(level: number): string {
  const idx = Math.min(Math.floor((level - 1) / 2), TITLES.length - 1);
  return TITLES[idx];
}

// ─── #68 Unlockable Accent Themes ───────────────────────
export interface ThemePreset {
  id: string;
  name: string;
  color: string;
  unlockLevel: number;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'amber',   name: 'Amber (Default)', color: '#F5A623', unlockLevel: 1  },
  { id: 'mint',    name: 'Mint',            color: '#4ade80', unlockLevel: 5  },
  { id: 'sky',     name: 'Sky Blue',        color: '#60a5fa', unlockLevel: 10 },
  { id: 'rose',    name: 'Rose',            color: '#f472b6', unlockLevel: 15 },
  { id: 'violet',  name: 'Violet',          color: '#a78bfa', unlockLevel: 20 },
  { id: 'gold',    name: 'Gold',            color: '#fbbf24', unlockLevel: 25 },
];

// ─── #67 Combo Multipliers ───────────────────────────────

/** Get XP multiplier based on consecutive correct answer combo */
export function getComboMultiplier(combo: number): number {
  if (combo >= 20) return 3.0;
  if (combo >= 10) return 2.0;
  if (combo >= 5) return 1.5;
  return 1.0;
}

/** Get combo tier label */
export function getComboLabel(combo: number): string | null {
  if (combo >= 20) return '🔥 MEGA COMBO x3!';
  if (combo >= 10) return '⚡ SUPER COMBO x2!';
  if (combo >= 5) return '✨ COMBO x1.5!';
  return null;
}

/** Calculate XP to award for a quiz */
export function quizXp(correct: number, total: number, isAdaptive: boolean = false): number {
  let xp = correct * 5;
  if (correct === total && total > 0) xp += 20; // Perfect bonus
  if (isAdaptive) xp = Math.round(xp * 1.3);   // Adaptive bonus
  return xp;
}

/** Calculate XP for a single question answer with combo bonus */
export function answerXp(isCorrect: boolean, combo: number): number {
  if (!isCorrect) return 0;
  const base = 5;
  return Math.round(base * getComboMultiplier(combo));
}

/** Calculate XP to award for study time */
export function studyTimeXp(minutes: number): number {
  return Math.round(minutes * 2);
}

/** Award quiz XP and update gamification data */
export function awardQuizXp(
  data: GamificationData,
  correct: number,
  total: number,
  isAdaptive: boolean = false
): GamificationData {
  const xpGain = quizXp(correct, total, isAdaptive);
  const isPerfect = correct === total && total > 0;

  const updated: GamificationData = {
    ...data,
    xp: data.xp + xpGain,
    level: Math.floor((data.xp + xpGain) / 100) + 1,
    totalQuizzes: data.totalQuizzes + 1,
    totalCorrect: data.totalCorrect + correct,
    totalAnswered: data.totalAnswered + total,
    perfectScores: isPerfect ? data.perfectScores + 1 : data.perfectScores,
    dailyGoal: {
      ...data.dailyGoal,
      todayXp: data.dailyGoal.todayXp + xpGain,
      todayQuestions: data.dailyGoal.todayQuestions + total,
    },
  };

  // Update streak (with freeze support)
  // Use local date (not UTC) so streaks reset at local midnight, not UTC midnight
  function localDateStr(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const today = localDateStr();
  const lastDate = data.lastStudyDate;
  if (lastDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = localDateStr(yesterday);
    if (lastDate === yStr) {
      updated.streak = data.streak + 1;
    } else if (lastDate !== today) {
      // Check if a streak freeze can save us (missed 1 day only)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const tdaStr = localDateStr(twoDaysAgo);
      if (lastDate === tdaStr && (data.streakFreezes || 0) > 0) {
        // Use a freeze - streak continues!
        updated.streakFreezes = (data.streakFreezes || 0) - 1;
        updated.streak = data.streak + 1;
      } else {
        updated.streak = 1;
      }
    }
  } else {
    updated.streak = 1;
  }
  updated.lastStudyDate = today;
  updated.bestStreak = Math.max(updated.streak, data.bestStreak || 0);

  // Check badges
  updated.badges = checkBadges(updated);

  return updated;
}

/** Award study time XP */
export function awardStudyTimeXp(data: GamificationData, minutes: number): GamificationData {
  const xpGain = studyTimeXp(minutes);

  const updated: GamificationData = {
    ...data,
    xp: data.xp + xpGain,
    level: Math.floor((data.xp + xpGain) / 100) + 1,
    totalMinutes: data.totalMinutes + minutes,
    dailyGoal: {
      ...data.dailyGoal,
      todayXp: data.dailyGoal.todayXp + xpGain,
      todayMinutes: data.dailyGoal.todayMinutes + minutes,
    },
  };

  updated.badges = checkBadges(updated);
  return updated;
}

/** Check all badge conditions and return earned badges */
export function checkBadges(data: GamificationData): Badge[] {
  const earned: Badge[] = [...(data.badges || [])];
  const earnedIds = new Set(earned.map(b => b.id));

  for (const def of BADGE_DEFS) {
    if (!earnedIds.has(def.id) && def.check(data)) {
      earned.push({
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        earnedAt: new Date().toISOString(),
      });
    }
  }

  return earned;
}

/** Reset daily goals if the day has changed (uses local date, not UTC) */
export function resetDailyIfNeeded(data: GamificationData): GamificationData {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lastDate = data.lastStudyDate;

  if (lastDate !== today) {
    return {
      ...data,
      dailyGoal: {
        ...data.dailyGoal,
        todayXp: 0,
        todayMinutes: 0,
        todayQuestions: 0,
      },
    };
  }
  return data;
}

/** Get all badge definitions (for displaying locked badges) */
export function getAllBadgeDefs(): Array<{ id: string; name: string; icon: string; description: string }> {
  return BADGE_DEFS.map(({ id, name, icon, description }) => ({ id, name, icon, description }));
}

/** Daily goal targets */
export const DAILY_TARGETS = {
  xp: 100,
  minutes: 30,
  questions: 20,
};

// ─── #65 Weekly Quests ───────────────────────────────────

import type { WeeklyQuest } from '../types';

/** Get the ISO week key for a date (YYYY-WNN) */
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

interface QuestTemplate { id: string; label: string; target: number; xpReward: number }

const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: 'weekly_reviews', label: 'Complete 20 reviews', target: 20, xpReward: 100 },
  { id: 'weekly_streak', label: 'Maintain a 5-day streak', target: 5, xpReward: 150 },
  { id: 'weekly_questions', label: 'Answer 50 questions', target: 50, xpReward: 120 },
  { id: 'weekly_minutes', label: 'Study for 60 minutes', target: 60, xpReward: 80 },
  { id: 'weekly_perfect', label: 'Get 3 perfect quiz scores', target: 3, xpReward: 200 },
  { id: 'weekly_xp', label: 'Earn 200 XP this week', target: 200, xpReward: 50 },
];

/** Generate 3 weekly quests for the current week */
export function generateWeeklyQuests(weekKey: string): WeeklyQuest[] {
  // Use week key as seed to pick consistent quests per week
  const seed = weekKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const picked: QuestTemplate[] = [];
  const used = new Set<number>();
  let i = 0;
  while (picked.length < 3) {
    const idx = (seed + i * 7) % QUEST_TEMPLATES.length;
    if (!used.has(idx)) { used.add(idx); picked.push(QUEST_TEMPLATES[idx]); }
    i++;
  }
  return picked.map(t => ({
    id: `${weekKey}-${t.id}`,
    label: t.label,
    target: t.target,
    progress: 0,
    xpReward: t.xpReward,
    weekKey,
    completed: false,
  }));
}

/** Get or generate quests for the current week */
export function getCurrentWeekQuests(existing: WeeklyQuest[] | undefined): WeeklyQuest[] {
  const weekKey = getWeekKey();
  const thisWeek = (existing || []).filter(q => q.weekKey === weekKey);
  if (thisWeek.length >= 3) return thisWeek;
  return generateWeeklyQuests(weekKey);
}

/** Buy a streak freeze with XP (costs 50 XP, max 3 freezes) */
export function buyStreakFreeze(data: GamificationData): GamificationData | null {
  const freezes = data.streakFreezes || 0;
  if (freezes >= 3) return null;  // Max 3 freezes
  if (data.xp < 50) return null;  // Not enough XP
  return {
    ...data,
    xp: data.xp - 50,
    level: data.level, // Preserve level — spending XP on freezes should not regress level
    streakFreezes: freezes + 1,
  };
}
