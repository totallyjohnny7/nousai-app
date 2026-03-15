/**
 * 100-Day Usage Simulation
 * Simulates realistic student behavior over 100 days to stress-test all systems.
 * Run via: import { runSimulation } from './simulate100days'; runSimulation();
 */

import type {
  NousAIData, GamificationData, ProficiencyEntry, ProficiencyData,
  SRCard, QuizAttempt, QuizAnswer, Course, CourseTopic, FlashcardItem,
  StudySession, Note, Assignment, WeeklyPlan, CanvasEvent, Badge,
  TimerState, StudySchedule, StudyBlock
} from '../types';

// ─── Helpers ────────────────────────────────────────────

function dateStr(d: Date): string { return d.toISOString().split('T')[0]; }
function isoStr(d: Date): string { return d.toISOString(); }
function uid(): string { return Math.random().toString(36).slice(2, 10); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

// ─── Badge Definitions (mirrored from gamification.ts) ──

const BADGE_DEFS = [
  { id: 'first_quiz', name: 'First Quiz', icon: '🎯', description: 'Complete your first quiz', check: (d: GamificationData) => d.totalQuizzes >= 1 },
  { id: 'quiz_veteran', name: 'Quiz Veteran', icon: '🏆', description: 'Complete 10 quizzes', check: (d: GamificationData) => d.totalQuizzes >= 10 },
  { id: 'week_warrior', name: 'Week Warrior', icon: '🔥', description: '7-day study streak', check: (d: GamificationData) => d.streak >= 7 },
  { id: 'monthly_master', name: 'Monthly Master', icon: '👑', description: '30-day study streak', check: (d: GamificationData) => d.streak >= 30 },
  { id: 'dedicated', name: 'Dedicated', icon: '⏰', description: 'Study for 10 hours total', check: (d: GamificationData) => d.totalMinutes >= 600 },
  { id: 'scholar', name: 'Scholar', icon: '📚', description: 'Study for 50 hours total', check: (d: GamificationData) => d.totalMinutes >= 3000 },
  { id: 'perfectionist', name: 'Perfectionist', icon: '💯', description: 'Get a perfect quiz score', check: (d: GamificationData) => d.perfectScores >= 1 },
  { id: 'rising_star', name: 'Rising Star', icon: '⭐', description: 'Reach level 5', check: (d: GamificationData) => Math.floor(d.xp / 100) + 1 >= 5 },
  { id: 'ascendant', name: 'Ascendant', icon: '🚀', description: 'Reach level 10', check: (d: GamificationData) => Math.floor(d.xp / 100) + 1 >= 10 },
];

function checkBadges(data: GamificationData, simDate: Date): Badge[] {
  const earned: Badge[] = [...(data.badges || [])];
  const earnedIds = new Set(earned.map(b => b.id));
  for (const def of BADGE_DEFS) {
    if (!earnedIds.has(def.id) && def.check(data)) {
      earned.push({ id: def.id, name: def.name, icon: def.icon, description: def.description, earnedAt: isoStr(simDate) });
    }
  }
  return earned;
}

// ─── FSRS constants (mirrored from fsrs.ts) ────────────

const W = [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0092, 1.5988, 0.1176, 1.0013, 2.1214, 0.0904, 0.3025, 2.1214, 0.2498, 2.9466, 0.4891, 0.6468];
const FACTOR = 19 / 81;
const FSRS_DECAY = -0.5;

function fsrsRetrievability(t: number, S: number): number { return Math.pow(1 + FACTOR * t / S, FSRS_DECAY); }
function fsrsOptimalInterval(S: number): number {
  const t = (S / FACTOR) * (Math.pow(0.9, 1 / FSRS_DECAY) - 1);
  return Math.max(1, Math.min(365, Math.round(t)));
}
function fsrsInitD(grade: number): number { return clamp(W[4] - Math.exp(W[5] * (grade - 1)) + 1, 1, 10); }
function fsrsInitS(grade: number): number { return Math.max(0.1, W[grade - 1]); }
function fsrsNextD(D: number, grade: number): number {
  const D03 = W[4] - Math.exp(W[5] * 2) + 1;
  return clamp(W[7] * D03 + (1 - W[7]) * (D - W[6] * (grade - 3)), 1, 10);
}
function fsrsNextSSuccess(D: number, S: number, R: number, grade: number): number {
  const hp = grade === 2 ? W[15] : 1;
  const eb = grade === 4 ? W[16] : 1;
  return Math.max(0.1, S * (1 + Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hp * eb));
}
function fsrsNextSFail(D: number, S: number, R: number): number {
  return Math.max(0.1, Math.min(S, W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R))));
}

function simReviewCard(card: SRCard, grade: number, simDate: Date): SRCard {
  const updated = { ...card, history: [...(card.history || [])] };
  if (card.reps === 0 || card.state === 'new') {
    updated.S = fsrsInitS(grade);
    updated.D = fsrsInitD(grade);
    updated.state = 'learning';
  } else {
    const elapsed = Math.max(0, (simDate.getTime() - new Date(card.lastReview).getTime()) / 86400000);
    const R = fsrsRetrievability(elapsed, card.S);
    updated.D = fsrsNextD(card.D, grade);
    if (grade === 1) {
      updated.S = fsrsNextSFail(updated.D, card.S, R);
      updated.lapses = card.lapses + 1;
      updated.state = 'learning';
    } else {
      updated.S = fsrsNextSSuccess(updated.D, card.S, R, grade);
      updated.state = updated.S >= 21 ? 'review' : 'learning'; // mature threshold
    }
    updated.history.push({ date: isoStr(simDate), grade, S: updated.S, D: updated.D, R, interval: fsrsOptimalInterval(updated.S) });
  }
  updated.reps = card.reps + 1;
  updated.elapsedDays = card.lastReview ? Math.max(0, (simDate.getTime() - new Date(card.lastReview).getTime()) / 86400000) : 0;
  updated.scheduledDays = fsrsOptimalInterval(updated.S);
  updated.lastReview = isoStr(simDate);
  const next = new Date(simDate);
  next.setDate(next.getDate() + updated.scheduledDays);
  updated.nextReview = isoStr(next);
  return updated;
}

// ─── Course Definitions (similar to user's real courses) ─

const COURSES: Course[] = [
  {
    id: 'sim-biol3020', name: '26SP BIOL 3020 70883', shortName: 'Molecular Biology', color: '#ef4444',
    topics: [
      { id: 'mb-t1', name: 'Cell Membranes', subtopics: [{ id: 'mb-t1-s1', name: 'Lipid Bilayer' }, { id: 'mb-t1-s2', name: 'Membrane Proteins' }, { id: 'mb-t1-s3', name: 'Transport Mechanisms' }] },
      { id: 'mb-t2', name: 'DNA Replication', subtopics: [{ id: 'mb-t2-s1', name: 'Origin of Replication' }, { id: 'mb-t2-s2', name: 'Leading & Lagging Strand' }, { id: 'mb-t2-s3', name: 'DNA Repair' }] },
      { id: 'mb-t3', name: 'Gene Expression', subtopics: [{ id: 'mb-t3-s1', name: 'Transcription' }, { id: 'mb-t3-s2', name: 'Translation' }, { id: 'mb-t3-s3', name: 'Post-translational Modification' }] },
      { id: 'mb-t4', name: 'Cell Cycle', subtopics: [{ id: 'mb-t4-s1', name: 'Mitosis' }, { id: 'mb-t4-s2', name: 'Meiosis' }, { id: 'mb-t4-s3', name: 'Cell Cycle Checkpoints' }] },
      { id: 'mb-t5', name: 'Cellular Respiration', subtopics: [{ id: 'mb-t5-s1', name: 'Glycolysis' }, { id: 'mb-t5-s2', name: 'Krebs Cycle' }, { id: 'mb-t5-s3', name: 'Electron Transport Chain' }] },
    ],
    flashcards: Array.from({ length: 40 }, (_, i) => ({ front: `MolBio Q${i + 1}`, back: `MolBio A${i + 1}` })),
  },
  {
    id: 'sim-biol4230', name: '26SP BIOL 4230 71234', shortName: 'Evolution', color: '#22c55e',
    topics: [
      { id: 'ev-t1', name: 'Natural Selection', subtopics: [{ id: 'ev-t1-s1', name: 'Directional Selection' }, { id: 'ev-t1-s2', name: 'Stabilizing Selection' }] },
      { id: 'ev-t2', name: 'Population Genetics', subtopics: [{ id: 'ev-t2-s1', name: 'Hardy-Weinberg' }, { id: 'ev-t2-s2', name: 'Genetic Drift' }] },
      { id: 'ev-t3', name: 'Speciation', subtopics: [{ id: 'ev-t3-s1', name: 'Allopatric' }, { id: 'ev-t3-s2', name: 'Sympatric' }] },
      { id: 'ev-t4', name: 'Phylogenetics', subtopics: [{ id: 'ev-t4-s1', name: 'Cladistics' }, { id: 'ev-t4-s2', name: 'Molecular Clocks' }] },
    ],
    flashcards: Array.from({ length: 30 }, (_, i) => ({ front: `Evo Q${i + 1}`, back: `Evo A${i + 1}` })),
  },
  {
    id: 'sim-japn1110', name: '26SP JAPN 1110 60123', shortName: 'Japanese', color: '#a855f7',
    topics: [
      { id: 'jp-t1', name: 'Hiragana', subtopics: [{ id: 'jp-t1-s1', name: 'Basic Characters' }, { id: 'jp-t1-s2', name: 'Dakuten' }] },
      { id: 'jp-t2', name: 'Katakana', subtopics: [{ id: 'jp-t2-s1', name: 'Basic Characters' }, { id: 'jp-t2-s2', name: 'Loan Words' }] },
      { id: 'jp-t3', name: 'Grammar', subtopics: [{ id: 'jp-t3-s1', name: 'Particles' }, { id: 'jp-t3-s2', name: 'Verb Conjugation' }] },
      { id: 'jp-t4', name: 'Vocabulary', subtopics: [{ id: 'jp-t4-s1', name: 'Numbers' }, { id: 'jp-t4-s2', name: 'Greetings' }] },
    ],
    flashcards: Array.from({ length: 50 }, (_, i) => ({ front: `日本語 Q${i + 1}`, back: `Japanese A${i + 1}` })),
  },
  {
    id: 'sim-phys1120', name: '26SP PHYS 1120 50456', shortName: 'Physics', color: '#3b82f6',
    topics: [
      { id: 'ph-t1', name: 'Electrostatics', subtopics: [{ id: 'ph-t1-s1', name: "Coulomb's Law" }, { id: 'ph-t1-s2', name: 'Electric Fields' }] },
      { id: 'ph-t2', name: 'Circuits', subtopics: [{ id: 'ph-t2-s1', name: "Ohm's Law" }, { id: 'ph-t2-s2', name: 'Kirchhoff Rules' }] },
      { id: 'ph-t3', name: 'Magnetism', subtopics: [{ id: 'ph-t3-s1', name: 'Magnetic Fields' }, { id: 'ph-t3-s2', name: 'Electromagnetic Induction' }] },
    ],
    flashcards: Array.from({ length: 35 }, (_, i) => ({ front: `Physics Q${i + 1}`, back: `Physics A${i + 1}` })),
  },
  {
    id: 'sim-premed', name: 'Pre-Med Studies', shortName: 'Pre-Med', color: '#f59e0b',
    topics: [
      { id: 'pm-t1', name: 'Anatomy', subtopics: [{ id: 'pm-t1-s1', name: 'Skeletal System' }, { id: 'pm-t1-s2', name: 'Muscular System' }] },
      { id: 'pm-t2', name: 'Physiology', subtopics: [{ id: 'pm-t2-s1', name: 'Cardiovascular' }, { id: 'pm-t2-s2', name: 'Respiratory' }] },
    ],
    flashcards: Array.from({ length: 25 }, (_, i) => ({ front: `PreMed Q${i + 1}`, back: `PreMed A${i + 1}` })),
  },
];

const ALL_TOPICS: { courseId: string; courseName: string; topicName: string; subtopicName: string }[] = [];
for (const c of COURSES) {
  for (const t of c.topics) {
    for (const s of (t.subtopics || [])) {
      ALL_TOPICS.push({ courseId: c.id, courseName: c.shortName, topicName: t.name, subtopicName: s.name });
    }
  }
}

// ─── Canvas Events (exams, assignments) ─────────────────

function generateCanvasEvents(startDate: Date): CanvasEvent[] {
  const events: CanvasEvent[] = [];
  const courses = ['Molecular Biology', 'Evolution', 'Japanese', 'Physics', 'Pre-Med'];
  // Midterms around day 40, finals around day 90
  for (const c of courses) {
    const midterm = new Date(startDate);
    midterm.setDate(midterm.getDate() + rand(35, 45));
    events.push({
      title: `${c} Midterm Exam`, start: isoStr(midterm), end: isoStr(midterm),
      description: `Midterm exam for ${c}`, uid: uid(), location: 'Science Hall', allDay: true, completed: false,
    });
    const final = new Date(startDate);
    final.setDate(final.getDate() + rand(85, 100));
    events.push({
      title: `${c} Final Exam`, start: isoStr(final), end: isoStr(final),
      description: `Final exam for ${c}`, uid: uid(), location: 'Exam Center', allDay: true, completed: false,
    });
    // Weekly homework
    for (let w = 1; w <= 14; w++) {
      const hw = new Date(startDate);
      hw.setDate(hw.getDate() + w * 7);
      if (hw.getTime() - startDate.getTime() < 100 * 86400000) {
        events.push({
          title: `${c} HW ${w}`, start: isoStr(hw), end: isoStr(hw),
          description: `Homework week ${w}`, uid: uid(), location: '', allDay: true,
          completed: (hw.getTime() < Date.now()),
        });
      }
    }
  }
  return events;
}

// ─── Main Simulation ────────────────────────────────────

export function runSimulation(): { data: NousAIData; log: string[] } {
  const log: string[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 100); // Start 100 days ago

  // Initialize gamification
  let gam: GamificationData = {
    xp: 0, level: 1, totalQuizzes: 0, totalCorrect: 0, totalAnswered: 0,
    totalMinutes: 0, streak: 0, bestStreak: 0, streakFreezes: 0,
    lastStudyDate: null, perfectScores: 0,
    badges: [], dailyGoal: { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 100 },
  };

  // Initialize proficiency
  const profData: ProficiencyData = {
    settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 },
    subjects: {},
  };

  // Initialize SR cards (one per flashcard across all courses)
  let srCards: SRCard[] = [];
  for (const c of COURSES) {
    for (let i = 0; i < c.flashcards.length; i++) {
      srCards.push({
        key: `${c.id}-card-${i}`,
        subject: c.shortName,
        subtopic: c.topics[i % c.topics.length]?.name || 'General',
        S: 0, D: 5, reps: 0, lapses: 0, state: 'new',
        lastReview: isoStr(startDate),
        nextReview: isoStr(startDate), // All due from day 1
        elapsedDays: 0, scheduledDays: 0, history: [],
      });
    }
  }

  const quizHistory: QuizAttempt[] = [];
  const studySessions: StudySession[] = [];
  const notes: Note[] = [];
  const assignments: Assignment[] = [];

  // Day-by-day simulation
  for (let day = 0; day < 100; day++) {
    const simDate = new Date(startDate);
    simDate.setDate(simDate.getDate() + day);
    const ds = dateStr(simDate);
    const isWeekend = simDate.getDay() === 0 || simDate.getDay() === 6;

    // Reset daily goals
    gam = { ...gam, dailyGoal: { ...gam.dailyGoal, todayXp: 0, todayMinutes: 0, todayQuestions: 0 } };

    // ── Skip days (simulate missed days) ──
    // Miss ~12% of days (weekends more likely to miss)
    const missChance = isWeekend ? 0.25 : 0.08;
    if (Math.random() < missChance) {
      log.push(`Day ${day} (${ds}): SKIPPED`);
      continue;
    }

    // ── Streak logic ──
    const yesterday = new Date(simDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = dateStr(yesterday);
    if (gam.lastStudyDate) {
      if (gam.lastStudyDate === yStr) {
        gam.streak += 1;
      } else if (gam.lastStudyDate !== ds) {
        // Missed a day - try streak freeze
        const twoDaysAgo = new Date(simDate);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const tdaStr = dateStr(twoDaysAgo);
        if (gam.lastStudyDate === tdaStr && gam.streakFreezes > 0) {
          gam.streakFreezes--;
          gam.streak += 1;
          log.push(`Day ${day} (${ds}): STREAK FREEZE used! Streak continues at ${gam.streak}`);
        } else {
          log.push(`Day ${day} (${ds}): Streak broken (was ${gam.streak})`);
          gam.streak = 1;
        }
      }
    } else {
      gam.streak = 1;
    }
    gam.lastStudyDate = ds;
    gam.bestStreak = Math.max(gam.streak, gam.bestStreak);

    // ── Buy streak freezes strategically ──
    if (gam.streakFreezes < 2 && gam.xp >= 100 && day > 20 && Math.random() < 0.15) {
      gam.xp -= 50;
      gam.level = Math.floor(gam.xp / 100) + 1;
      gam.streakFreezes++;
      log.push(`Day ${day} (${ds}): Bought streak freeze (now ${gam.streakFreezes}/3, XP=${gam.xp})`);
    }

    // ── Quizzes (1-3 per active day) ──
    const quizzesThisDay = rand(1, isWeekend ? 1 : 3);
    for (let q = 0; q < quizzesThisDay; q++) {
      const topic = pick(ALL_TOPICS);
      const questionCount = pick([5, 10, 15, 20]);
      // Score improves over time (simulates learning)
      const baseScore = Math.min(95, 40 + day * 0.5 + Math.random() * 20);
      const correct = Math.min(questionCount, Math.round(questionCount * baseScore / 100));
      const score = Math.round((correct / questionCount) * 100);
      const isPerfect = correct === questionCount;
      const isAdaptive = Math.random() < 0.3;

      // XP calculation
      let xpGain = correct * 5;
      if (isPerfect) xpGain += 20;
      if (isAdaptive) xpGain = Math.round(xpGain * 1.3);

      gam.xp += xpGain;
      gam.level = Math.floor(gam.xp / 100) + 1;
      gam.totalQuizzes++;
      gam.totalCorrect += correct;
      gam.totalAnswered += questionCount;
      if (isPerfect) gam.perfectScores++;
      gam.dailyGoal.todayXp += xpGain;
      gam.dailyGoal.todayQuestions += questionCount;

      // Build quiz answers
      const answers: QuizAnswer[] = [];
      for (let i = 0; i < questionCount; i++) {
        const isCorrect = i < correct;
        answers.push({
          question: {
            type: pick(['multiple_choice', 'true_false', 'fill_blank']),
            question: `${topic.topicName}: Question ${i + 1} about ${topic.subtopicName}`,
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: `Explanation for ${topic.subtopicName} concept ${i + 1}`,
          },
          userAnswer: isCorrect ? 'A' : 'B',
          correct: isCorrect,
          timeMs: rand(3000, 45000),
        });
      }

      quizHistory.push({
        id: uid(),
        name: `${topic.topicName} Quiz`,
        subject: topic.courseName,
        subtopic: topic.subtopicName,
        date: isoStr(simDate),
        questionCount,
        score,
        correct,
        mode: isAdaptive ? 'adaptive' : pick(['standard', 'timed', 'practice']),
        questions: [],
        answers,
      });

      // Update proficiency
      if (!profData.subjects[topic.courseName]) profData.subjects[topic.courseName] = {};
      if (!profData.subjects[topic.courseName][topic.subtopicName]) {
        profData.subjects[topic.courseName][topic.subtopicName] = {
          subject: topic.courseName, subtopic: topic.subtopicName,
          attempts: [], proficiencyScore: 0, isProficient: false, currentStreak: 0, bestStreak: 0,
        };
      }
      const entry = profData.subjects[topic.courseName][topic.subtopicName];
      entry.attempts.push({ date: ds, percentage: score });

      // Recalculate proficiency using weighted average
      const atts = entry.attempts.map(a => a.percentage);
      const half = Math.ceil(atts.length / 2);
      const recent = atts.slice(-half);
      const older = atts.slice(0, atts.length - half);
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const olderAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;
      entry.proficiencyScore = Math.round(recentAvg * 0.7 + olderAvg * 0.3);
      entry.isProficient = atts.length >= 3 && entry.proficiencyScore >= 85;
      entry.currentStreak = score >= 85 ? entry.currentStreak + 1 : 0;
      entry.bestStreak = Math.max(entry.currentStreak, entry.bestStreak);
    }

    // ── Study Sessions (1-2 per day) ──
    const sessionsThisDay = rand(1, 2);
    for (let s = 0; s < sessionsThisDay; s++) {
      const course = pick(COURSES);
      const mins = rand(15, 60);
      const xpGain = Math.round(mins * 2);
      gam.xp += xpGain;
      gam.level = Math.floor(gam.xp / 100) + 1;
      gam.totalMinutes += mins;
      gam.dailyGoal.todayXp += xpGain;
      gam.dailyGoal.todayMinutes += mins;

      studySessions.push({
        id: uid(),
        courseId: course.id,
        type: pick(['review', 'practice', 'learn', 'flashcard', 'exam-prep']),
        durationMs: mins * 60000,
        date: isoStr(simDate),
      });
    }

    // ── SR Card Reviews ──
    const dueCards = srCards.filter(c => new Date(c.nextReview).getTime() <= simDate.getTime());
    const reviewCount = Math.min(dueCards.length, rand(10, 30));
    const toReview = dueCards.slice(0, reviewCount);
    for (const card of toReview) {
      // Grade based on how many times reviewed + randomness
      const baseGrade = card.reps >= 3 ? 3.5 : 2.5;
      const grade = clamp(Math.round(baseGrade + (Math.random() - 0.3)), 1, 4) as 1 | 2 | 3 | 4;
      const updated = simReviewCard(card, grade, simDate);
      const idx = srCards.findIndex(c => c.key === card.key);
      if (idx >= 0) srCards[idx] = updated;
    }

    // ── Notes (occasional) ──
    if (Math.random() < 0.15) {
      const course = pick(COURSES);
      const topic = pick(course.topics);
      notes.push({
        id: uid(),
        title: `${topic.name} Notes - Day ${day}`,
        content: `Study notes for ${topic.name} covering key concepts and examples.`,
        folder: course.shortName,
        tags: [course.shortName.toLowerCase(), topic.name.toLowerCase()],
        courseId: course.id,
        createdAt: isoStr(simDate),
        updatedAt: isoStr(simDate),
        type: pick(['note', 'quiz', 'flashcard', 'ai-output']),
      });
    }

    // ── Assignments (weekly) ──
    if (day % 7 === 0 && day > 0) {
      const course = pick(COURSES);
      assignments.push({
        id: uid(),
        name: `${course.shortName} Assignment Week ${Math.ceil(day / 7)}`,
        courseId: course.id,
        dueDate: isoStr(new Date(simDate.getTime() + 7 * 86400000)),
        type: pick(['homework', 'lab report', 'essay', 'problem set']),
        weight: rand(5, 15),
        completed: day < 80, // Later assignments not done yet
      });
    }

    // Check badges
    gam.badges = checkBadges(gam, simDate);

    log.push(`Day ${day} (${ds}): streak=${gam.streak} XP=${gam.xp} Lv=${gam.level} quizzes=${quizzesThisDay} sessions=${sessionsThisDay} cards=${reviewCount}/${dueCards.length} badges=${gam.badges.length}`);
  }

  // ── Build final NousAIData ──
  const canvasEvents = generateCanvasEvents(startDate);

  // Generate a weekly plan for this week
  const thisMonday = new Date();
  thisMonday.setDate(thisMonday.getDate() - thisMonday.getDay() + 1);
  const weeklyPlan: WeeklyPlan = {
    weekOf: dateStr(thisMonday),
    notes: 'Auto-generated study plan',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
      day: d,
      blocks: COURSES.slice(0, 3).map(c => ({
        courseId: c.id,
        type: pick(['review', 'practice', 'learn']),
        minutes: rand(20, 45),
        description: `Study ${c.shortName}`,
        done: i < new Date().getDay() - 1,
      })),
    })),
  };

  // Generate study schedules
  const studySchedules: StudySchedule[] = COURSES.slice(0, 3).map(c => {
    const blocks: StudyBlock[] = [];
    for (let w = 0; w < 12; w++) {
      for (let d = 0; d < 5; d++) {
        const blockDate = new Date(startDate);
        blockDate.setDate(blockDate.getDate() + w * 7 + d);
        blocks.push({
          id: uid(),
          date: isoStr(blockDate),
          courseId: c.id,
          courseName: c.shortName,
          topic: pick(c.topics).name,
          durationMin: rand(20, 45),
          type: pick(['review', 'learn', 'practice', 'exam-prep']),
          done: blockDate.getTime() < Date.now(),
        });
      }
    }
    return {
      id: uid(),
      courseName: c.shortName,
      examDate: isoStr(new Date(Date.now() + rand(20, 60) * 86400000)),
      hoursPerWeek: rand(5, 12),
      blocks,
      createdAt: isoStr(startDate),
    };
  });

  const data: NousAIData = {
    settings: {
      aiProvider: 'none',
      canvasUrl: 'https://canvas.university.edu',
      canvasToken: '',
      canvasIcalUrl: '',
      canvasEvents,
    },
    pluginData: {
      quizHistory,
      coachData: {
        courses: COURSES,
        sessions: studySessions,
        streak: gam.streak,
        totalStudyMinutes: gam.totalMinutes,
        weeklyPlan,
      },
      proficiencyData: profData,
      srData: { cards: srCards },
      timerState: {
        swRunning: false, swAccumulatedMs: 0, swResumedAt: null, swCourseId: '', swType: 'review',
        pomoRunning: false, pomoEndTime: null, pomoWorkMin: 25, pomoBreakMin: 5,
        pomoLongBreakMin: 15, pomoPhase: 'idle', pomoSession: 0, pomoTotalSessions: 0,
        pomoRemainingMs: 0, savedAt: Date.now(),
      },
      gamificationData: gam,
      quizBank: {},
      notes,
      drawings: [],
      studySessions,
      weeklyPlan,
      assignments,
      matchSets: [
        {
          id: uid(), name: 'Biology Key Terms', subject: 'Molecular Biology',
          pairs: Array.from({ length: 8 }, (_, i) => ({ term: `Term ${i + 1}`, definition: `Definition ${i + 1}` })),
          createdAt: isoStr(new Date()),
        },
      ],
      studySchedules,
    },
  };

  // ── Final Stats ──
  log.push(`\n══════ SIMULATION COMPLETE ══════`);
  log.push(`Total XP: ${gam.xp}`);
  log.push(`Level: ${gam.level}`);
  log.push(`Current Streak: ${gam.streak}`);
  log.push(`Best Streak: ${gam.bestStreak}`);
  log.push(`Total Quizzes: ${gam.totalQuizzes}`);
  log.push(`Total Study Minutes: ${gam.totalMinutes}`);
  log.push(`Perfect Scores: ${gam.perfectScores}`);
  log.push(`Badges: ${gam.badges.map(b => b.name).join(', ')}`);
  log.push(`Streak Freezes: ${gam.streakFreezes}/3`);
  log.push(`SR Cards: ${srCards.length} total, ${srCards.filter(c => c.state === 'new').length} new, ${srCards.filter(c => c.state === 'learning').length} learning, ${srCards.filter(c => c.state === 'review').length} review`);
  log.push(`Quiz History: ${quizHistory.length} attempts`);
  log.push(`Study Sessions: ${studySessions.length}`);
  log.push(`Notes: ${notes.length}`);
  log.push(`Assignments: ${assignments.length}`);
  log.push(`Canvas Events: ${canvasEvents.length}`);
  log.push(`Proficiency Subjects: ${Object.keys(profData.subjects).length}`);
  const profEntries = Object.values(profData.subjects).flatMap(s => Object.values(s));
  log.push(`Proficiency Entries: ${profEntries.length} (${profEntries.filter(e => e.isProficient).length} proficient)`);

  return { data, log };
}

// ─── Kid Course Definitions ─────────────────────────────

const KID_COURSES: Course[] = [
  {
    id: 'kid-sci', name: 'Awesome Science', shortName: 'Science', color: '#22c55e',
    topics: [
      {
        id: 'ks-t1', name: 'Animals & Habitats', subtopics: [
          { id: 'ks-t1-s1', name: 'Rainforest Animals' },
          { id: 'ks-t1-s2', name: 'Ocean Creatures' },
          { id: 'ks-t1-s3', name: 'Desert Animals' },
        ],
      },
      {
        id: 'ks-t2', name: 'Space & Planets', subtopics: [
          { id: 'ks-t2-s1', name: 'Solar System' },
          { id: 'ks-t2-s2', name: 'Moon Phases' },
          { id: 'ks-t2-s3', name: 'Stars' },
        ],
      },
      {
        id: 'ks-t3', name: 'Weather', subtopics: [
          { id: 'ks-t3-s1', name: 'Clouds' },
          { id: 'ks-t3-s2', name: 'Rain Cycle' },
          { id: 'ks-t3-s3', name: 'Seasons' },
        ],
      },
    ],
    flashcards: [
      { front: 'How many legs does a spider have?', back: '8 legs!' },
      { front: 'What is the biggest planet?', back: 'Jupiter!' },
      { front: 'What gas do plants breathe in?', back: 'Carbon dioxide!' },
      { front: 'What do you call a baby frog?', back: 'A tadpole!' },
      { front: 'How many planets are in our solar system?', back: '8 planets!' },
      { front: 'What is the closest star to Earth?', back: 'The Sun!' },
      { front: 'What are clouds made of?', back: 'Tiny water droplets!' },
      { front: 'Which animal is the tallest?', back: 'The giraffe!' },
      { front: 'What causes rain?', back: 'Water evaporates and condenses in clouds!' },
      { front: 'What season comes after winter?', back: 'Spring!' },
      { front: 'Do dolphins breathe air or water?', back: 'Air! They are mammals!' },
      { front: 'What planet has rings?', back: 'Saturn!' },
      { front: 'What animal has the longest neck?', back: 'The giraffe!' },
      { front: 'Is the moon a planet or a satellite?', back: 'A satellite (it orbits Earth)!' },
      { front: 'What do caterpillars turn into?', back: 'Butterflies!' },
    ],
  },
  {
    id: 'kid-math', name: 'Fun Math', shortName: 'Math', color: '#3b82f6',
    topics: [
      {
        id: 'km-t1', name: 'Addition & Subtraction', subtopics: [
          { id: 'km-t1-s1', name: 'Adding 1-digit' },
          { id: 'km-t1-s2', name: 'Adding 2-digit' },
          { id: 'km-t1-s3', name: 'Subtraction' },
        ],
      },
      {
        id: 'km-t2', name: 'Shapes', subtopics: [
          { id: 'km-t2-s1', name: 'Circles & Squares' },
          { id: 'km-t2-s2', name: 'Triangles' },
          { id: 'km-t2-s3', name: '3D Shapes' },
        ],
      },
      {
        id: 'km-t3', name: 'Measurement', subtopics: [
          { id: 'km-t3-s1', name: 'Length' },
          { id: 'km-t3-s2', name: 'Weight' },
          { id: 'km-t3-s3', name: 'Time' },
        ],
      },
    ],
    flashcards: [
      { front: 'What is 7 + 5?', back: '12!' },
      { front: 'What is 15 - 8?', back: '7!' },
      { front: 'How many sides does a triangle have?', back: '3 sides!' },
      { front: 'What is 9 + 9?', back: '18!' },
      { front: 'How many sides does a square have?', back: '4 sides!' },
      { front: 'What shape is a ball?', back: 'A sphere!' },
      { front: 'What is 20 - 13?', back: '7!' },
      { front: 'How many minutes in an hour?', back: '60 minutes!' },
      { front: 'What comes after 99?', back: '100!' },
      { front: 'What shape has no corners?', back: 'A circle!' },
      { front: 'What is 6 + 7?', back: '13!' },
      { front: 'How many hours in a day?', back: '24 hours!' },
      { front: 'What is half of 10?', back: '5!' },
      { front: 'How many inches in a foot?', back: '12 inches!' },
      { front: 'What is double 8?', back: '16!' },
    ],
  },
  {
    id: 'kid-read', name: 'Reading Adventures', shortName: 'Reading', color: '#f59e0b',
    topics: [
      {
        id: 'kr-t1', name: 'Phonics', subtopics: [
          { id: 'kr-t1-s1', name: 'Short Vowels' },
          { id: 'kr-t1-s2', name: 'Long Vowels' },
          { id: 'kr-t1-s3', name: 'Consonant Blends' },
        ],
      },
      {
        id: 'kr-t2', name: 'Sight Words', subtopics: [
          { id: 'kr-t2-s1', name: 'Common Words' },
          { id: 'kr-t2-s2', name: 'Action Words' },
        ],
      },
      {
        id: 'kr-t3', name: 'Story Time', subtopics: [
          { id: 'kr-t3-s1', name: 'Characters' },
          { id: 'kr-t3-s2', name: 'Plot' },
          { id: 'kr-t3-s3', name: 'Setting' },
        ],
      },
    ],
    flashcards: [
      { front: 'What sound does "sh" make?', back: 'Like in "ship" and "shoe"!' },
      { front: 'What is the vowel in "cat"?', back: 'The letter "a"!' },
      { front: 'Spell the word for a furry pet that barks', back: 'D-O-G!' },
      { front: 'What is the opposite of "big"?', back: 'Small!' },
      { front: 'What does "ch" sound like?', back: 'Like in "cheese" and "chair"!' },
      { front: 'What rhymes with "hat"?', back: 'Cat, bat, mat, sat!' },
      { front: 'Who is the main person in a story called?', back: 'The character (or hero)!' },
      { front: 'Where a story takes place is called the...?', back: 'Setting!' },
      { front: 'What is a group of sentences about one idea?', back: 'A paragraph!' },
      { front: 'What comes at the end of a sentence?', back: 'A period (.) or question mark (?)!' },
      { front: 'What is the long vowel sound in "cake"?', back: 'The long "a" sound!' },
      { front: 'What word means "to go fast"?', back: 'Run!' },
      { front: 'What is the beginning of a story called?', back: 'The introduction!' },
      { front: 'What are the ABCs called?', back: 'The alphabet!' },
      { front: 'What is a word that means the same as "happy"?', back: 'Glad, joyful, cheerful!' },
    ],
  },
];

const KID_ALL_TOPICS: { courseId: string; courseName: string; topicName: string; subtopicName: string }[] = [];
for (const c of KID_COURSES) {
  for (const t of c.topics) {
    for (const s of (t.subtopics || [])) {
      KID_ALL_TOPICS.push({ courseId: c.id, courseName: c.shortName, topicName: t.name, subtopicName: s.name });
    }
  }
}

// ─── Kid-friendly quiz question templates ────────────────

const KID_QUESTION_TEMPLATES: Record<string, string[]> = {
  'Rainforest Animals': ['Which animal lives in the rainforest?', 'What color is a toucan\'s beak?', 'How do monkeys move through trees?', 'What is a jaguar?', 'Name an animal that lives in trees'],
  'Ocean Creatures': ['How many arms does an octopus have?', 'What is the biggest animal in the ocean?', 'Do jellyfish have brains?', 'What is a group of fish called?', 'Can seahorses swim fast?'],
  'Desert Animals': ['How does a camel survive without water?', 'What animal has a shell in the desert?', 'Are all snakes dangerous?', 'What does a roadrunner eat?', 'Where do meerkats live?'],
  'Solar System': ['Which planet is closest to the Sun?', 'What planet do we live on?', 'Is Pluto a planet?', 'Which planet is red?', 'How many planets orbit the Sun?'],
  'Moon Phases': ['What is a full moon?', 'Does the moon make its own light?', 'How long is one moon cycle?', 'What is a crescent moon?', 'Can we see the moon during the day?'],
  'Stars': ['What is the closest star?', 'Why do stars twinkle?', 'What is a constellation?', 'Are all stars the same size?', 'What color are the hottest stars?'],
  'Clouds': ['What are clouds made of?', 'What is a fluffy white cloud called?', 'Do clouds weigh anything?', 'What are dark rain clouds called?', 'How high are clouds?'],
  'Rain Cycle': ['Where does rain come from?', 'What is evaporation?', 'Where does water go after it rains?', 'What is condensation?', 'Why are puddles gone the next day?'],
  'Seasons': ['How many seasons are there?', 'Which season is the hottest?', 'When do leaves fall off trees?', 'What season comes after summer?', 'Why do we have seasons?'],
  'Adding 1-digit': ['What is 3 + 4?', 'What is 5 + 2?', 'What is 8 + 1?', 'What is 6 + 3?', 'What is 7 + 2?'],
  'Adding 2-digit': ['What is 12 + 15?', 'What is 21 + 34?', 'What is 10 + 25?', 'What is 33 + 11?', 'What is 40 + 18?'],
  'Subtraction': ['What is 10 - 3?', 'What is 15 - 7?', 'What is 20 - 5?', 'What is 9 - 4?', 'What is 18 - 9?'],
  'Circles & Squares': ['How many corners does a circle have?', 'How many sides does a square have?', 'What shape is a wheel?', 'What shape is a window?', 'Are all sides of a square equal?'],
  'Triangles': ['How many sides does a triangle have?', 'How many corners does a triangle have?', 'What shape is a pizza slice?', 'Can a triangle have a curved side?', 'What is the pointy part of a triangle called?'],
  '3D Shapes': ['What shape is a ball?', 'What shape is a box?', 'How is a cube different from a square?', 'What shape is a can?', 'What is a 3D triangle called?'],
  'Length': ['What do we use to measure length?', 'Is a ruler or a yardstick longer?', 'How many inches in a foot?', 'What unit measures long distances?', 'Which is longer: a pencil or a bus?'],
  'Weight': ['What do we use to measure weight?', 'Which is heavier: a feather or a rock?', 'How many ounces in a pound?', 'What unit measures very heavy things?', 'Does a balloon weigh a lot?'],
  'Time': ['How many minutes in an hour?', 'How many hours in a day?', 'What does the short hand on a clock show?', 'How many days in a week?', 'What comes after Tuesday?'],
  'Short Vowels': ['What is the short vowel in "cat"?', 'What is the short vowel in "pig"?', 'Say the short "o" sound', 'Which word has a short "e": bed or bead?', 'What is the short "u" sound in "cup"?'],
  'Long Vowels': ['What is the long "a" sound in "cake"?', 'Which word has a long "i": kite or kit?', 'What makes a vowel sound long?', 'Say the long "o" sound', 'Does "cute" have a long or short "u"?'],
  'Consonant Blends': ['What blend starts "blue"?', 'What blend starts "tree"?', 'What sound does "str" make?', 'What blend starts "play"?', 'Name a word that starts with "cl"'],
  'Common Words': ['Spell the word "the"', 'Spell the word "said"', 'What word means "also"?', 'Spell the word "where"', 'How do you spell "because"?'],
  'Action Words': ['What word means to move fast?', 'What is an action word?', 'Is "jump" an action word?', 'Name an action word for eating', 'What does "sprint" mean?'],
  'Characters': ['Who is the main person in a story?', 'Can an animal be a character?', 'What is a villain?', 'How do we learn about characters?', 'What is a hero?'],
  'Plot': ['What is a plot?', 'What happens at the beginning of a story?', 'What is the problem in a story called?', 'What is the ending of a story called?', 'What is a cliffhanger?'],
  'Setting': ['What is a setting?', 'Name a setting for a story', 'Can a setting be in space?', 'Does the setting include the time?', 'Why is the setting important?'],
};

// ─── Kid Simulation (7-year-old boy, 60 days) ────────────

export function runKidSim(): { data: NousAIData; log: string[] } {
  const log: string[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60); // Start 60 days ago

  // Initialize gamification
  let gam: GamificationData = {
    xp: 0, level: 1, totalQuizzes: 0, totalCorrect: 0, totalAnswered: 0,
    totalMinutes: 0, streak: 0, bestStreak: 0, streakFreezes: 0,
    lastStudyDate: null, perfectScores: 0,
    badges: [], dailyGoal: { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 50 },
  };

  // Initialize proficiency
  const profData: ProficiencyData = {
    settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 },
    subjects: {},
  };

  // Initialize SR cards (one per flashcard across all kid courses)
  let srCards: SRCard[] = [];
  for (const c of KID_COURSES) {
    for (let i = 0; i < c.flashcards.length; i++) {
      srCards.push({
        key: `${c.id}-card-${i}`,
        subject: c.shortName,
        subtopic: c.topics[i % c.topics.length]?.name || 'General',
        S: 0, D: 5, reps: 0, lapses: 0, state: 'new',
        lastReview: isoStr(startDate),
        nextReview: isoStr(startDate),
        elapsedDays: 0, scheduledDays: 0, history: [],
      });
    }
  }

  const quizHistory: QuizAttempt[] = [];
  const studySessions: StudySession[] = [];
  const notes: Note[] = [];

  // Day-by-day simulation (60 days)
  for (let day = 0; day < 60; day++) {
    const simDate = new Date(startDate);
    simDate.setDate(simDate.getDate() + day);
    const ds = dateStr(simDate);
    const dayOfWeek = simDate.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Reset daily goals
    gam = { ...gam, dailyGoal: { ...gam.dailyGoal, todayXp: 0, todayMinutes: 0, todayQuestions: 0 } };

    // ── Skip days (~45% miss rate — kid schedule is inconsistent) ──
    // Weekdays: school days, might study after school (miss ~50%)
    // Weekends: more free time, slightly more likely to play (miss ~35%)
    const missChance = isWeekend ? 0.35 : 0.50;
    if (Math.random() < missChance) {
      log.push(`Day ${day} (${ds}): SKIPPED (kid busy/no study)`);
      continue;
    }

    // ── Streak logic (no streak freezes for kid) ──
    const yesterday = new Date(simDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = dateStr(yesterday);
    if (gam.lastStudyDate) {
      if (gam.lastStudyDate === yStr) {
        gam.streak += 1;
      } else if (gam.lastStudyDate !== ds) {
        // Kid doesn't use streak freezes — streak just resets
        log.push(`Day ${day} (${ds}): Streak broken (was ${gam.streak})`);
        gam.streak = 1;
      }
    } else {
      gam.streak = 1;
    }
    gam.lastStudyDate = ds;
    gam.bestStreak = Math.max(gam.streak, gam.bestStreak);

    // ── One quiz per active day (kid attention span) ──
    const topic = pick(KID_ALL_TOPICS);
    const questionCount = rand(3, 5); // Kid-sized quizzes
    // Score: starts ~50-60%, improves to ~75-85% over 60 days
    const progress = day / 60;
    const baseScore = 50 + progress * 30 + (Math.random() * 10 - 5);
    const clampedScore = clamp(Math.round(baseScore), 20, 100);
    const correct = Math.min(questionCount, Math.round(questionCount * clampedScore / 100));
    const score = Math.round((correct / questionCount) * 100);
    const isPerfect = correct === questionCount;

    // XP: simpler for kid
    let xpGain = correct * 5;
    if (isPerfect) xpGain += 10;

    gam.xp += xpGain;
    gam.level = Math.floor(gam.xp / 100) + 1;
    gam.totalQuizzes++;
    gam.totalCorrect += correct;
    gam.totalAnswered += questionCount;
    if (isPerfect) gam.perfectScores++;
    gam.dailyGoal.todayXp += xpGain;
    gam.dailyGoal.todayQuestions += questionCount;

    // Build quiz answers with kid-appropriate questions
    const answers: QuizAnswer[] = [];
    const templateQuestions = KID_QUESTION_TEMPLATES[topic.subtopicName] || [`What do you know about ${topic.subtopicName}?`, `Tell me about ${topic.subtopicName}`, `${topic.subtopicName} question`, `Fun fact about ${topic.subtopicName}?`, `Quiz time: ${topic.subtopicName}`];
    for (let i = 0; i < questionCount; i++) {
      const isCorrect = i < correct;
      answers.push({
        question: {
          type: pick(['multiple_choice', 'true_false']),
          question: templateQuestions[i % templateQuestions.length],
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: `Great job! This is about ${topic.subtopicName}.`,
        },
        userAnswer: isCorrect ? 'A' : 'B',
        correct: isCorrect,
        timeMs: rand(5000, 25000), // Kids take a bit longer per question
      });
    }

    quizHistory.push({
      id: uid(),
      name: `${topic.topicName} Quiz`,
      subject: topic.courseName,
      subtopic: topic.subtopicName,
      date: isoStr(simDate),
      questionCount,
      score,
      correct,
      mode: pick(['standard', 'practice']), // No adaptive for kid
      questions: [],
      answers,
    });

    // Update proficiency
    if (!profData.subjects[topic.courseName]) profData.subjects[topic.courseName] = {};
    if (!profData.subjects[topic.courseName][topic.subtopicName]) {
      profData.subjects[topic.courseName][topic.subtopicName] = {
        subject: topic.courseName, subtopic: topic.subtopicName,
        attempts: [], proficiencyScore: 0, isProficient: false, currentStreak: 0, bestStreak: 0,
      };
    }
    const entry = profData.subjects[topic.courseName][topic.subtopicName];
    entry.attempts.push({ date: ds, percentage: score });

    // Recalculate proficiency using weighted average (same logic as adult sim)
    const atts = entry.attempts.map(a => a.percentage);
    const half = Math.ceil(atts.length / 2);
    const recent = atts.slice(-half);
    const older = atts.slice(0, atts.length - half);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;
    entry.proficiencyScore = Math.round(recentAvg * 0.7 + olderAvg * 0.3);
    entry.isProficient = atts.length >= 3 && entry.proficiencyScore >= 85;
    entry.currentStreak = score >= 85 ? entry.currentStreak + 1 : 0;
    entry.bestStreak = Math.max(entry.currentStreak, entry.bestStreak);

    // ── Study Session (1 per active day, short — 5 to 20 min) ──
    const course = pick(KID_COURSES);
    const mins = rand(5, 20);
    const sessionXp = Math.round(mins * 2);
    gam.xp += sessionXp;
    gam.level = Math.floor(gam.xp / 100) + 1;
    gam.totalMinutes += mins;
    gam.dailyGoal.todayXp += sessionXp;
    gam.dailyGoal.todayMinutes += mins;

    studySessions.push({
      id: uid(),
      courseId: course.id,
      type: pick(['review', 'practice', 'flashcard']),
      durationMs: mins * 60000,
      date: isoStr(simDate),
    });

    // ── SR Card Reviews (5-10 per day — short review sessions) ──
    const dueCards = srCards.filter(c => new Date(c.nextReview).getTime() <= simDate.getTime());
    const reviewCount = Math.min(dueCards.length, rand(5, 10));
    const toReview = dueCards.slice(0, reviewCount);
    for (const card of toReview) {
      // Kid grades: mostly 2-3, occasionally 4, rarely 1
      const baseGrade = card.reps >= 2 ? 3 : 2.3;
      const grade = clamp(Math.round(baseGrade + (Math.random() - 0.3)), 1, 4) as 1 | 2 | 3 | 4;
      const updated = simReviewCard(card, grade, simDate);
      const idx = srCards.findIndex(c => c.key === card.key);
      if (idx >= 0) srCards[idx] = updated;
    }

    // ── Notes (very rare — 3-4 total over 60 days, dictated to parent) ──
    if (Math.random() < 0.06) {
      const noteCourse = pick(KID_COURSES);
      const noteTopic = pick(noteCourse.topics);
      const kidNoteContents = [
        `I learned that ${noteTopic.name.toLowerCase()} is really cool! My favorite part was learning about ${pick(noteTopic.subtopics || [{ id: '', name: 'stuff' }]).name.toLowerCase()}.`,
        `Today we did ${noteTopic.name.toLowerCase()} and I got most of the answers right! Mom helped me understand the hard parts.`,
        `${noteTopic.name} is fun. I want to learn more about ${pick(noteTopic.subtopics || [{ id: '', name: 'things' }]).name.toLowerCase()} tomorrow.`,
        `Dad helped me study ${noteTopic.name.toLowerCase()} today. I can remember the answers better now!`,
      ];
      notes.push({
        id: uid(),
        title: `${noteTopic.name} - Day ${day}`,
        content: pick(kidNoteContents),
        folder: noteCourse.shortName,
        tags: [noteCourse.shortName.toLowerCase(), noteTopic.name.toLowerCase()],
        courseId: noteCourse.id,
        createdAt: isoStr(simDate),
        updatedAt: isoStr(simDate),
        type: 'note',
      });
    }

    // Check badges
    gam.badges = checkBadges(gam, simDate);

    log.push(`Day ${day} (${ds}): streak=${gam.streak} XP=${gam.xp} Lv=${gam.level} quiz=1(${correct}/${questionCount}) session=${mins}min cards=${reviewCount}/${dueCards.length} badges=${gam.badges.length}`);
  }

  // ── Build match sets (kid loves match game) ──
  const matchSets = KID_COURSES.map(c => ({
    id: uid(),
    name: `${c.shortName} Match Game`,
    subject: c.shortName,
    pairs: c.flashcards.slice(0, 8).map(fc => ({
      term: fc.front.replace('?', ''),
      definition: fc.back.replace('!', ''),
    })),
    createdAt: isoStr(new Date(startDate.getTime() + rand(0, 10) * 86400000)),
  }));

  // ── Build final NousAIData ──
  const data: NousAIData = {
    settings: {
      aiProvider: 'none',
      canvasUrl: '',
      canvasToken: '',
      canvasIcalUrl: '',
      canvasEvents: [], // Kid doesn't use Canvas
    },
    pluginData: {
      quizHistory,
      coachData: {
        courses: KID_COURSES,
        sessions: studySessions,
        streak: gam.streak,
        totalStudyMinutes: gam.totalMinutes,
        weeklyPlan: undefined,
      },
      proficiencyData: profData,
      srData: { cards: srCards },
      timerState: {
        swRunning: false, swAccumulatedMs: 0, swResumedAt: null, swCourseId: '', swType: 'review',
        pomoRunning: false, pomoEndTime: null, pomoWorkMin: 15, pomoBreakMin: 5,
        pomoLongBreakMin: 10, pomoPhase: 'idle', pomoSession: 0, pomoTotalSessions: 0,
        pomoRemainingMs: 0, savedAt: Date.now(),
      },
      gamificationData: gam,
      quizBank: {},
      notes,
      drawings: [],
      studySessions,
      weeklyPlan: undefined,
      assignments: [], // No assignments for kid
      matchSets,
      studySchedules: [], // No study schedules for kid
    },
  };

  // ── Final Stats ──
  log.push(`\n══════ KID SIMULATION COMPLETE ══════`);
  log.push(`Profile: 7-year-old "Little Explorer"`);
  log.push(`Duration: 60 days`);
  log.push(`Total XP: ${gam.xp}`);
  log.push(`Level: ${gam.level}`);
  log.push(`Current Streak: ${gam.streak}`);
  log.push(`Best Streak: ${gam.bestStreak}`);
  log.push(`Total Quizzes: ${gam.totalQuizzes}`);
  log.push(`Total Study Minutes: ${gam.totalMinutes}`);
  log.push(`Perfect Scores: ${gam.perfectScores}`);
  log.push(`Badges: ${gam.badges.map(b => b.name).join(', ') || '(none)'}`);
  log.push(`SR Cards: ${srCards.length} total, ${srCards.filter(c => c.state === 'new').length} new, ${srCards.filter(c => c.state === 'learning').length} learning, ${srCards.filter(c => c.state === 'review').length} review`);
  log.push(`Quiz History: ${quizHistory.length} attempts`);
  log.push(`Study Sessions: ${studySessions.length}`);
  log.push(`Notes: ${notes.length}`);
  log.push(`Match Sets: ${matchSets.length}`);
  log.push(`Canvas Events: 0 (kid mode)`);
  log.push(`Assignments: 0 (kid mode)`);
  log.push(`Proficiency Subjects: ${Object.keys(profData.subjects).length}`);
  const profEntries = Object.values(profData.subjects).flatMap(s => Object.values(s));
  log.push(`Proficiency Entries: ${profEntries.length} (${profEntries.filter(e => e.isProficient).length} proficient)`);

  return { data, log };
}

// ─── New Semester Simulation ─────────────────────────────
// Simulates a freshman college student's first 30 days of their first semester.
// Lower skill, more missed days, shorter sessions, standard quizzes only.

const NSEM_COURSES: Course[] = [
  {
    id: 'nsem-cs1010', name: 'CS 1010 - Introduction to Computer Science', shortName: 'Intro CS', color: '#06b6d4',
    topics: [
      { id: 'nsem-cs-t1', name: 'Variables & Data Types', subtopics: [{ id: 'nsem-cs-t1-s1', name: 'Integers and Floats' }, { id: 'nsem-cs-t1-s2', name: 'Strings and Booleans' }, { id: 'nsem-cs-t1-s3', name: 'Type Conversion' }] },
      { id: 'nsem-cs-t2', name: 'Control Flow', subtopics: [{ id: 'nsem-cs-t2-s1', name: 'If-Else Statements' }, { id: 'nsem-cs-t2-s2', name: 'While Loops' }, { id: 'nsem-cs-t2-s3', name: 'For Loops' }] },
      { id: 'nsem-cs-t3', name: 'Functions', subtopics: [{ id: 'nsem-cs-t3-s1', name: 'Defining Functions' }, { id: 'nsem-cs-t3-s2', name: 'Parameters and Return Values' }, { id: 'nsem-cs-t3-s3', name: 'Scope and Lifetime' }] },
      { id: 'nsem-cs-t4', name: 'Lists and Arrays', subtopics: [{ id: 'nsem-cs-t4-s1', name: 'Indexing and Slicing' }, { id: 'nsem-cs-t4-s2', name: 'Iteration Over Collections' }] },
    ],
    flashcards: Array.from({ length: 22 }, (_, i) => ({ front: `CS Concept Q${i + 1}`, back: `CS Concept A${i + 1}` })),
  },
  {
    id: 'nsem-math1210', name: 'MATH 1210 - Calculus I', shortName: 'Calculus', color: '#8b5cf6',
    topics: [
      { id: 'nsem-ma-t1', name: 'Limits', subtopics: [{ id: 'nsem-ma-t1-s1', name: 'Intuitive Limits' }, { id: 'nsem-ma-t1-s2', name: 'One-Sided Limits' }, { id: 'nsem-ma-t1-s3', name: 'Limits at Infinity' }] },
      { id: 'nsem-ma-t2', name: 'Continuity', subtopics: [{ id: 'nsem-ma-t2-s1', name: 'Definition of Continuity' }, { id: 'nsem-ma-t2-s2', name: 'Intermediate Value Theorem' }] },
      { id: 'nsem-ma-t3', name: 'Derivatives', subtopics: [{ id: 'nsem-ma-t3-s1', name: 'Definition and Notation' }, { id: 'nsem-ma-t3-s2', name: 'Power Rule' }, { id: 'nsem-ma-t3-s3', name: 'Product and Quotient Rules' }] },
      { id: 'nsem-ma-t4', name: 'Applications of Derivatives', subtopics: [{ id: 'nsem-ma-t4-s1', name: 'Related Rates' }, { id: 'nsem-ma-t4-s2', name: 'Curve Sketching' }] },
    ],
    flashcards: Array.from({ length: 25 }, (_, i) => ({ front: `Calculus Q${i + 1}`, back: `Calculus A${i + 1}` })),
  },
  {
    id: 'nsem-engl1010', name: 'ENGL 1010 - Academic Writing', shortName: 'Writing', color: '#ec4899',
    topics: [
      { id: 'nsem-en-t1', name: 'Thesis Statements', subtopics: [{ id: 'nsem-en-t1-s1', name: 'Arguable Claims' }, { id: 'nsem-en-t1-s2', name: 'Narrowing Your Focus' }] },
      { id: 'nsem-en-t2', name: 'Paragraph Structure', subtopics: [{ id: 'nsem-en-t2-s1', name: 'Topic Sentences' }, { id: 'nsem-en-t2-s2', name: 'Evidence and Analysis' }, { id: 'nsem-en-t2-s3', name: 'Transitions' }] },
      { id: 'nsem-en-t3', name: 'Citation and Sources', subtopics: [{ id: 'nsem-en-t3-s1', name: 'MLA Format' }, { id: 'nsem-en-t3-s2', name: 'Paraphrasing vs Quoting' }] },
      { id: 'nsem-en-t4', name: 'Revision Strategies', subtopics: [{ id: 'nsem-en-t4-s1', name: 'Peer Review' }, { id: 'nsem-en-t4-s2', name: 'Self-Editing Checklist' }] },
    ],
    flashcards: Array.from({ length: 20 }, (_, i) => ({ front: `Writing Q${i + 1}`, back: `Writing A${i + 1}` })),
  },
  {
    id: 'nsem-hist1510', name: 'HIST 1510 - Western Civilization', shortName: 'History', color: '#f97316',
    topics: [
      { id: 'nsem-hi-t1', name: 'Ancient Greece', subtopics: [{ id: 'nsem-hi-t1-s1', name: 'Athenian Democracy' }, { id: 'nsem-hi-t1-s2', name: 'Spartan Society' }, { id: 'nsem-hi-t1-s3', name: 'Greek Philosophy' }] },
      { id: 'nsem-hi-t2', name: 'Roman Republic', subtopics: [{ id: 'nsem-hi-t2-s1', name: 'Senate and Magistrates' }, { id: 'nsem-hi-t2-s2', name: 'Punic Wars' }] },
      { id: 'nsem-hi-t3', name: 'Roman Empire', subtopics: [{ id: 'nsem-hi-t3-s1', name: 'Pax Romana' }, { id: 'nsem-hi-t3-s2', name: 'Fall of Rome' }] },
      { id: 'nsem-hi-t4', name: 'Medieval Europe', subtopics: [{ id: 'nsem-hi-t4-s1', name: 'Feudalism' }, { id: 'nsem-hi-t4-s2', name: 'The Crusades' }] },
    ],
    flashcards: Array.from({ length: 23 }, (_, i) => ({ front: `History Q${i + 1}`, back: `History A${i + 1}` })),
  },
];

const NSEM_ALL_TOPICS: { courseId: string; courseName: string; topicName: string; subtopicName: string }[] = [];
for (const c of NSEM_COURSES) {
  for (const t of c.topics) {
    for (const s of (t.subtopics || [])) {
      NSEM_ALL_TOPICS.push({ courseId: c.id, courseName: c.shortName, topicName: t.name, subtopicName: s.name });
    }
  }
}

// ─── Canvas Events for new semester (placement tests, orientation, first assignments) ──

function generateNsemCanvasEvents(startDate: Date): CanvasEvent[] {
  const events: CanvasEvent[] = [];
  const courseNames = ['Intro CS', 'Calculus', 'Writing', 'History'];

  // Orientation events (first few days)
  const orientDay1 = new Date(startDate);
  events.push({
    title: 'New Student Orientation - Day 1', start: isoStr(orientDay1), end: isoStr(orientDay1),
    description: 'Campus tour, student ID, and welcome session', uid: uid(), location: 'Student Union', allDay: true, completed: true,
  });
  const orientDay2 = new Date(startDate);
  orientDay2.setDate(orientDay2.getDate() + 1);
  events.push({
    title: 'New Student Orientation - Day 2', start: isoStr(orientDay2), end: isoStr(orientDay2),
    description: 'Academic advising and course registration walkthrough', uid: uid(), location: 'Advising Center', allDay: true, completed: true,
  });

  // Placement tests (days 2-4)
  const mathPlacement = new Date(startDate);
  mathPlacement.setDate(mathPlacement.getDate() + 2);
  events.push({
    title: 'Math Placement Exam', start: isoStr(mathPlacement), end: isoStr(mathPlacement),
    description: 'Determines enrollment in MATH 1210 Calculus I', uid: uid(), location: 'Testing Center', allDay: true, completed: true,
  });
  const writingPlacement = new Date(startDate);
  writingPlacement.setDate(writingPlacement.getDate() + 3);
  events.push({
    title: 'Writing Placement Essay', start: isoStr(writingPlacement), end: isoStr(writingPlacement),
    description: 'Timed essay for ENGL 1010 placement', uid: uid(), location: 'Testing Center', allDay: true, completed: true,
  });

  // First assignments and quizzes for each course
  for (const c of courseNames) {
    // Syllabus quiz (around day 5-7)
    const syllabusQuiz = new Date(startDate);
    syllabusQuiz.setDate(syllabusQuiz.getDate() + rand(5, 7));
    events.push({
      title: `${c} Syllabus Quiz`, start: isoStr(syllabusQuiz), end: isoStr(syllabusQuiz),
      description: `Complete the syllabus acknowledgment quiz for ${c}`, uid: uid(), location: '', allDay: true,
      completed: true,
    });

    // First homework (around day 10-14)
    const hw1 = new Date(startDate);
    hw1.setDate(hw1.getDate() + rand(10, 14));
    events.push({
      title: `${c} HW 1`, start: isoStr(hw1), end: isoStr(hw1),
      description: `First homework assignment for ${c}`, uid: uid(), location: '', allDay: true,
      completed: true,
    });

    // Second homework (around day 18-22)
    const hw2 = new Date(startDate);
    hw2.setDate(hw2.getDate() + rand(18, 22));
    events.push({
      title: `${c} HW 2`, start: isoStr(hw2), end: isoStr(hw2),
      description: `Second homework assignment for ${c}`, uid: uid(), location: '', allDay: true,
      completed: (hw2.getTime() < Date.now()),
    });

    // First quiz (around day 20-25)
    const quiz1 = new Date(startDate);
    quiz1.setDate(quiz1.getDate() + rand(20, 25));
    events.push({
      title: `${c} Quiz 1`, start: isoStr(quiz1), end: isoStr(quiz1),
      description: `First graded quiz for ${c}`, uid: uid(), location: 'Classroom', allDay: true,
      completed: (quiz1.getTime() < Date.now()),
    });
  }

  // Club fair (day 4)
  const clubFair = new Date(startDate);
  clubFair.setDate(clubFair.getDate() + 4);
  events.push({
    title: 'Student Club Fair', start: isoStr(clubFair), end: isoStr(clubFair),
    description: 'Explore student organizations and clubs', uid: uid(), location: 'Quad', allDay: true, completed: true,
  });

  return events;
}

// ─── Note content generators for different course styles ──

function generateCSNote(topicName: string, day: number): string {
  const codeSnippets: Record<string, string> = {
    'Variables & Data Types': `# ${topicName} - Day ${day}\n\nKey takeaways from today's lecture:\n\n\`\`\`python\n# Variable assignment\nname = "Alice"    # str\nage = 19          # int\ngpa = 3.85        # float\nis_freshman = True  # bool\n\n# Type conversion\nage_str = str(age)  # "19"\nprice = float("9.99")  # 9.99\n\`\`\`\n\nRemember: Python is dynamically typed - no need to declare types explicitly.\nProfessor emphasized that type errors are the #1 source of bugs for beginners.`,
    'Control Flow': `# ${topicName} - Day ${day}\n\n\`\`\`python\n# If-else example from class\ngrade = 85\nif grade >= 90:\n    print("A")\nelif grade >= 80:\n    print("B")\nelse:\n    print("C or below")\n\n# While loop - accumulator pattern\ntotal = 0\ni = 1\nwhile i <= 10:\n    total += i\n    i += 1\nprint(f"Sum 1-10: {total}")  # 55\n\`\`\`\n\nNOTE: Don't forget the colon after if/while! Got points off in lab for that.`,
    'Functions': `# ${topicName} - Day ${day}\n\n\`\`\`python\ndef calculate_average(scores):\n    """Return the average of a list of scores."""\n    if len(scores) == 0:\n        return 0\n    return sum(scores) / len(scores)\n\nmy_scores = [88, 92, 75, 90]\navg = calculate_average(my_scores)\nprint(f"Average: {avg:.1f}")  # 86.2\n\`\`\`\n\nKey concepts:\n- Parameters vs arguments\n- Return values vs printing\n- Docstrings for documentation`,
    'Lists and Arrays': `# ${topicName} - Day ${day}\n\n\`\`\`python\n# List operations\nfruits = ["apple", "banana", "cherry"]\nfruits.append("date")       # Add to end\nfruits.insert(1, "blueberry") # Insert at index\nprint(fruits[0:3])           # Slicing\n\n# List comprehension (professor's bonus)\nsquares = [x**2 for x in range(10)]\n\`\`\`\n\nIMPORTANT: Lists are mutable, strings are not!\nStudy group meeting Thursday to practice these.`,
  };
  return codeSnippets[topicName] || `# ${topicName} - Day ${day}\n\nLecture notes: Covered the basics of ${topicName} today.\nNeed to review the textbook chapter before next class.`;
}

function generateMathNote(topicName: string, day: number): string {
  const mathNotes: Record<string, string> = {
    'Limits': `## ${topicName} - Day ${day}\n\nDefinition: lim(x->a) f(x) = L means for every e > 0, there exists d > 0 such that\nif 0 < |x - a| < d, then |f(x) - L| < e.\n\nKey limit laws:\n- lim[f(x) + g(x)] = lim f(x) + lim g(x)\n- lim[f(x) * g(x)] = lim f(x) * lim g(x)\n- lim[f(x)/g(x)] = lim f(x) / lim g(x), provided lim g(x) != 0\n\nExample: lim(x->2) (x^2 - 4)/(x - 2) = lim(x->2) (x+2) = 4\n\nL'Hopital's rule preview - professor said we'd need this later for indeterminate forms 0/0.`,
    'Continuity': `## ${topicName} - Day ${day}\n\nA function f is continuous at x = a if:\n1. f(a) is defined\n2. lim(x->a) f(x) exists\n3. lim(x->a) f(x) = f(a)\n\nIntermediate Value Theorem:\nIf f is continuous on [a,b] and N is between f(a) and f(b),\nthen there exists c in (a,b) such that f(c) = N.\n\nUseful for proving roots exist! Example: f(x) = x^3 - x - 1\nf(1) = -1 < 0, f(2) = 5 > 0 -> root exists between 1 and 2.`,
    'Derivatives': `## ${topicName} - Day ${day}\n\nDerivative definition: f'(x) = lim(h->0) [f(x+h) - f(x)] / h\n\nBasic rules:\n- Power rule: d/dx[x^n] = nx^(n-1)\n- Constant: d/dx[c] = 0\n- Sum: d/dx[f+g] = f' + g'\n- Product: d/dx[fg] = f'g + fg'\n- Quotient: d/dx[f/g] = (f'g - fg') / g^2\n\nPractice: d/dx[3x^4 - 2x^2 + 7x - 1] = 12x^3 - 4x + 7\n\nSTUDY NOTE: Keep confusing product rule order - need more practice problems.`,
    'Applications of Derivatives': `## ${topicName} - Day ${day}\n\nRelated rates steps:\n1. Draw a diagram\n2. Write an equation relating the quantities\n3. Differentiate both sides with respect to t\n4. Substitute known values and solve\n\nExample: Ladder sliding down a wall\nx^2 + y^2 = 25, dx/dt = 2 ft/s, find dy/dt when x = 3\n2x(dx/dt) + 2y(dy/dt) = 0\ndy/dt = -x(dx/dt)/y = -3(2)/4 = -1.5 ft/s\n\nNEED TO PRACTICE: These problems are really tricky.`,
  };
  return mathNotes[topicName] || `## ${topicName} - Day ${day}\n\nLecture covered ${topicName}. Need to work through practice problems in Section 3.${day % 8 + 1}.`;
}

function generateWritingNote(topicName: string, day: number): string {
  const writingNotes: Record<string, string> = {
    'Thesis Statements': `# ${topicName} - Day ${day}\n\nA strong thesis statement should be:\n- Specific (not vague or overly broad)\n- Arguable (someone could disagree)\n- Supportable (you can find evidence)\n\nWeak: "Social media is bad."\nStrong: "Social media platforms that use algorithmic feeds reduce adolescents' ability to sustain focused attention, as demonstrated by recent longitudinal studies."\n\nPeer workshop feedback: My thesis for Essay 1 was too broad. Need to narrow from "climate change affects agriculture" to a specific region and crop type.\n\nDraft thesis v2: "Rising temperatures in the Midwest have decreased corn yields by 8% over the past decade, threatening the economic stability of family-owned farms."`,
    'Paragraph Structure': `# ${topicName} - Day ${day}\n\nPIE paragraph structure (from lecture):\n- P = Point (topic sentence)\n- I = Illustration (evidence/example)\n- E = Explanation (analysis connecting evidence to point)\n\nCommon transition words:\n- Addition: moreover, furthermore, additionally\n- Contrast: however, nevertheless, on the other hand\n- Cause/effect: therefore, consequently, as a result\n\nProfessor's feedback on my draft: "Your paragraphs have good evidence but need stronger analysis. Don't just quote - explain WHY the quote matters."`,
    'Citation and Sources': `# ${topicName} - Day ${day}\n\nMLA Format Quick Reference:\n- In-text: (Author LastName Page#) -> (Smith 42)\n- No author: (Shortened Title Page#) -> ("Global Warming" 15)\n- Works Cited entry: LastName, FirstName. "Title." Container, vol., no., date, pp.\n\nParaphrasing vs Quoting:\n- Paraphrase when the idea matters more than the exact words\n- Quote when the author's specific language is important\n- ALWAYS cite both paraphrases and quotes!\n\nReminder: Turnitin submission due before class on Thursday. Professor is very strict about plagiarism.`,
    'Revision Strategies': `# ${topicName} - Day ${day}\n\nSelf-Editing Checklist (from handout):\n- Does every paragraph have a clear topic sentence?\n- Is my thesis reflected in the conclusion?\n- Have I varied my sentence structure?\n- Are all sources properly cited?\n- Did I proofread for grammar/spelling?\n\nPeer review tips:\n- Read the whole paper once before making comments\n- Focus on big-picture issues first (argument, organization)\n- Be specific: "This paragraph needs a transition" > "Fix this"\n\nNote to self: Schedule writing center appointment before Essay 2 is due.`,
  };
  return writingNotes[topicName] || `# ${topicName} - Day ${day}\n\nClass discussion on ${topicName}. Professor assigned readings from Chapter ${day % 5 + 1} of the textbook.`;
}

function generateHistoryNote(topicName: string, day: number): string {
  const historyNotes: Record<string, string> = {
    'Ancient Greece': `# ${topicName} - Day ${day}\n\nKey dates and concepts:\n- 508 BC: Cleisthenes establishes Athenian democracy\n- Direct democracy vs representative democracy\n- Only male citizens could vote (excluded women, slaves, foreigners)\n\nSparta vs Athens:\n- Athens: Democracy, arts, philosophy\n- Sparta: Oligarchy, military, combat training\n- Athens: Women had limited rights\n- Sparta: Women had more freedom\n\nGreek philosophers: Socrates -> Plato -> Aristotle (teacher-student chain)\nSocratic method = asking questions to expose contradictions\n\nEssay prompt for next week: "Was Athenian democracy truly democratic?"`,
    'Roman Republic': `# ${topicName} - Day ${day}\n\nRoman Republic government structure:\n- Senate (300 members, aristocrats, advisory role)\n- Consuls (2, elected annually, executive power)\n- Tribunes (protected plebeian rights, could veto)\n\nPunic Wars (264-146 BC):\n1. First Punic War: Rome gains Sicily\n2. Second Punic War: Hannibal crosses Alps with elephants\n3. Third Punic War: Carthage destroyed, salted earth\n\nKey concept: "Cursus honorum" - the sequential order of public offices\nQuaestor -> Aedile -> Praetor -> Consul\n\nStudy group decided to make flashcards for all the Latin terms.`,
    'Roman Empire': `# ${topicName} - Day ${day}\n\nPax Romana (27 BC - 180 AD):\n- ~200 years of relative peace and stability\n- Trade flourished across the Mediterranean\n- Infrastructure: roads, aqueducts, public baths\n- Population of Rome reached ~1 million\n\nCauses of Rome's decline (multiple theories):\n- Overexpansion and military overspending\n- Political instability (50 emperors in 50 years during Crisis of 3rd Century)\n- Economic troubles and inflation\n- Migration period\n- Division into Eastern and Western empires (395 AD)\n\nProfessor emphasizes: No single cause - it was a complex process over centuries.\nDon't say "Rome fell" on the exam - say "the Western Roman Empire declined."`,
    'Medieval Europe': `# ${topicName} - Day ${day}\n\nFeudal hierarchy:\nKing -> Lords/Nobles -> Knights -> Peasants/Serfs\n\nManorial system:\n- Self-sufficient estates\n- Serfs worked the land in exchange for protection\n- Three-field crop rotation system\n\nThe Crusades (1096-1291):\n- Pope Urban II called the First Crusade in 1095\n- Religious motivation + political ambition + economic opportunity\n- Consequences: cultural exchange, trade routes, weakened feudalism\n\nBlack Death (1347-1351): killed ~30-60% of European population\n-> Labor shortage -> peasants gained bargaining power -> beginning of end of serfdom\n\nReminder: Primary source analysis due next Monday. Using excerpt from the Domesday Book.`,
  };
  return historyNotes[topicName] || `# ${topicName} - Day ${day}\n\nLecture on ${topicName}. Reading assignment: textbook pages ${day * 3}-${day * 3 + 15}.`;
}

// ─── Main New Semester Simulation ────────────────────────

export function runNewSemesterSim(): { data: NousAIData; log: string[] } {
  const log: string[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Start 30 days ago

  // Initialize gamification
  let gam: GamificationData = {
    xp: 0, level: 1, totalQuizzes: 0, totalCorrect: 0, totalAnswered: 0,
    totalMinutes: 0, streak: 0, bestStreak: 0, streakFreezes: 0,
    lastStudyDate: null, perfectScores: 0,
    badges: [], dailyGoal: { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 100 },
  };

  // Initialize proficiency
  const profData: ProficiencyData = {
    settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 },
    subjects: {},
  };

  // Initialize SR cards (one per flashcard across all courses — fewer cards, 20-25 per course)
  let srCards: SRCard[] = [];
  for (const c of NSEM_COURSES) {
    for (let i = 0; i < c.flashcards.length; i++) {
      srCards.push({
        key: `${c.id}-card-${i}`,
        subject: c.shortName,
        subtopic: c.topics[i % c.topics.length]?.name || 'General',
        S: 0, D: 5, reps: 0, lapses: 0, state: 'new',
        lastReview: isoStr(startDate),
        nextReview: isoStr(startDate),
        elapsedDays: 0, scheduledDays: 0, history: [],
      });
    }
  }

  const quizHistory: QuizAttempt[] = [];
  const studySessions: StudySession[] = [];
  const notes: Note[] = [];
  const assignments: Assignment[] = [];

  // Track which days had quizzes for cram detection
  const upcomingQuizDays: number[] = [20, 21, 22, 23, 24, 25]; // Quiz 1 window

  // Day-by-day simulation (30 days)
  for (let day = 0; day < 30; day++) {
    const simDate = new Date(startDate);
    simDate.setDate(simDate.getDate() + day);
    const ds = dateStr(simDate);
    const isWeekend = simDate.getDay() === 0 || simDate.getDay() === 6;

    // Reset daily goals
    gam = { ...gam, dailyGoal: { ...gam.dailyGoal, todayXp: 0, todayMinutes: 0, todayQuestions: 0 } };

    // ── Skip days (~20% miss rate, freshman struggling with routine) ──
    const missChance = isWeekend ? 0.35 : 0.15;
    if (Math.random() < missChance) {
      log.push(`Day ${day} (${ds}): SKIPPED (missed)`);
      continue;
    }

    // ── Streak logic (no streak freezes — doesn't know about the feature) ──
    const yesterday = new Date(simDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = dateStr(yesterday);
    if (gam.lastStudyDate) {
      if (gam.lastStudyDate === yStr) {
        gam.streak += 1;
      } else if (gam.lastStudyDate !== ds) {
        log.push(`Day ${day} (${ds}): Streak broken (was ${gam.streak})`);
        gam.streak = 1;
      }
    } else {
      gam.streak = 1;
    }
    gam.lastStudyDate = ds;
    gam.bestStreak = Math.max(gam.streak, gam.bestStreak);

    // No streak freeze purchasing — freshman doesn't know about the feature

    // ── Determine if cramming (day before a quiz/assignment) ──
    const isCramDay = upcomingQuizDays.includes(day + 1) || upcomingQuizDays.includes(day + 2);

    // ── Quizzes (1-2 per day, ONLY standard mode) ──
    const quizzesThisDay = isCramDay ? rand(2, 3) : rand(1, 2);
    for (let q = 0; q < quizzesThisDay; q++) {
      const topic = pick(NSEM_ALL_TOPICS);
      const questionCount = pick([5, 10]);
      // Score: starts 30-50%, improves to 60-70% by day 30
      const progressFactor = day / 30; // 0 to 1
      const baseScore = 30 + progressFactor * 30 + (Math.random() * 20 - 10);
      const clampedScore = clamp(Math.round(baseScore), 15, 85);
      const correct = Math.min(questionCount, Math.round(questionCount * clampedScore / 100));
      const score = Math.round((correct / questionCount) * 100);
      const isPerfect = correct === questionCount;

      // XP calculation (same formula as original)
      let xpGain = correct * 5;
      if (isPerfect) xpGain += 20;
      // No adaptive bonus — only uses standard mode

      gam.xp += xpGain;
      gam.level = Math.floor(gam.xp / 100) + 1;
      gam.totalQuizzes++;
      gam.totalCorrect += correct;
      gam.totalAnswered += questionCount;
      if (isPerfect) gam.perfectScores++;
      gam.dailyGoal.todayXp += xpGain;
      gam.dailyGoal.todayQuestions += questionCount;

      // Build quiz answers
      const answers: QuizAnswer[] = [];
      for (let i = 0; i < questionCount; i++) {
        const isCorrect = i < correct;
        answers.push({
          question: {
            type: pick(['multiple_choice', 'true_false', 'fill_blank']),
            question: `${topic.topicName}: Question ${i + 1} about ${topic.subtopicName}`,
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: `Explanation for ${topic.subtopicName} concept ${i + 1}`,
          },
          userAnswer: isCorrect ? 'A' : pick(['B', 'C', 'D']),
          correct: isCorrect,
          timeMs: rand(5000, 60000), // Slower — freshman taking longer
        });
      }

      quizHistory.push({
        id: uid(),
        name: `${topic.topicName} Quiz`,
        subject: topic.courseName,
        subtopic: topic.subtopicName,
        date: isoStr(simDate),
        questionCount,
        score,
        correct,
        mode: 'standard', // ONLY standard — hasn't discovered adaptive
        questions: [],
        answers,
      });

      // Update proficiency
      if (!profData.subjects[topic.courseName]) profData.subjects[topic.courseName] = {};
      if (!profData.subjects[topic.courseName][topic.subtopicName]) {
        profData.subjects[topic.courseName][topic.subtopicName] = {
          subject: topic.courseName, subtopic: topic.subtopicName,
          attempts: [], proficiencyScore: 0, isProficient: false, currentStreak: 0, bestStreak: 0,
        };
      }
      const entry = profData.subjects[topic.courseName][topic.subtopicName];
      entry.attempts.push({ date: ds, percentage: score });

      // Recalculate proficiency using weighted average (same as original)
      const atts = entry.attempts.map(a => a.percentage);
      const half = Math.ceil(atts.length / 2);
      const recent = atts.slice(-half);
      const older = atts.slice(0, atts.length - half);
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const olderAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;
      entry.proficiencyScore = Math.round(recentAvg * 0.7 + olderAvg * 0.3);
      entry.isProficient = atts.length >= 3 && entry.proficiencyScore >= 85;
      entry.currentStreak = score >= 85 ? entry.currentStreak + 1 : 0;
      entry.bestStreak = Math.max(entry.currentStreak, entry.bestStreak);
    }

    // ── Study Sessions (shorter, burst-style: 10-30 min) ──
    const sessionsThisDay = isCramDay ? rand(2, 3) : rand(1, 2);
    for (let s = 0; s < sessionsThisDay; s++) {
      const course = pick(NSEM_COURSES);
      const mins = rand(10, 30); // Shorter sessions — freshman attention span
      const xpGain = Math.round(mins * 2);
      gam.xp += xpGain;
      gam.level = Math.floor(gam.xp / 100) + 1;
      gam.totalMinutes += mins;
      gam.dailyGoal.todayXp += xpGain;
      gam.dailyGoal.todayMinutes += mins;

      studySessions.push({
        id: uid(),
        courseId: course.id,
        type: pick(['review', 'practice', 'learn', 'flashcard']),
        durationMs: mins * 60000,
        date: isoStr(simDate),
      });
    }

    // ── SR Card Reviews (fewer per day) ──
    const dueCards = srCards.filter(c => new Date(c.nextReview).getTime() <= simDate.getTime());
    const reviewCount = Math.min(dueCards.length, rand(5, 15));
    const toReview = dueCards.slice(0, reviewCount);
    for (const card of toReview) {
      // Lower base grade — freshman struggles more
      const baseGrade = card.reps >= 3 ? 3.0 : 2.0;
      const grade = clamp(Math.round(baseGrade + (Math.random() - 0.4)), 1, 4) as 1 | 2 | 3 | 4;
      const updated = simReviewCard(card, grade, simDate);
      const idx = srCards.findIndex(c => c.key === card.key);
      if (idx >= 0) srCards[idx] = updated;
    }

    // ── Notes (more frequent — freshman trying to take notes for everything ~30% chance) ──
    if (Math.random() < 0.30) {
      const course = pick(NSEM_COURSES);
      const topic = pick(course.topics);

      // Generate course-appropriate note content
      let content: string;
      switch (course.id) {
        case 'nsem-cs1010':
          content = generateCSNote(topic.name, day);
          break;
        case 'nsem-math1210':
          content = generateMathNote(topic.name, day);
          break;
        case 'nsem-engl1010':
          content = generateWritingNote(topic.name, day);
          break;
        case 'nsem-hist1510':
          content = generateHistoryNote(topic.name, day);
          break;
        default:
          content = `Notes on ${topic.name} from day ${day}.`;
      }

      notes.push({
        id: uid(),
        title: `${topic.name} - ${course.shortName} Day ${day}`,
        content,
        folder: course.shortName,
        tags: [course.shortName.toLowerCase(), topic.name.toLowerCase().replace(/\s+/g, '-')],
        courseId: course.id,
        createdAt: isoStr(simDate),
        updatedAt: isoStr(simDate),
        type: pick(['note', 'note', 'note', 'ai-output']), // Mostly handwritten notes, sometimes AI help
      });
    }

    // ── Assignments (first few weeks) ──
    if (day % 7 === 0 && day > 0) {
      const course = pick(NSEM_COURSES);
      const weekNum = Math.ceil(day / 7);
      const assignmentTypes: Record<string, string[]> = {
        'nsem-cs1010': ['coding lab', 'problem set', 'debugging exercise'],
        'nsem-math1210': ['problem set', 'WebAssign homework', 'practice worksheet'],
        'nsem-engl1010': ['essay draft', 'peer review', 'reading response'],
        'nsem-hist1510': ['primary source analysis', 'reading response', 'discussion post'],
      };
      assignments.push({
        id: uid(),
        name: `${course.shortName} Assignment Week ${weekNum}`,
        courseId: course.id,
        dueDate: isoStr(new Date(simDate.getTime() + 7 * 86400000)),
        type: pick(assignmentTypes[course.id] || ['homework']),
        weight: rand(3, 10),
        completed: day < 21, // Last week's assignments not done yet
      });
    }

    // Check badges
    gam.badges = checkBadges(gam, simDate);

    log.push(`Day ${day} (${ds}): streak=${gam.streak} XP=${gam.xp} Lv=${gam.level} quizzes=${quizzesThisDay} sessions=${sessionsThisDay} cards=${reviewCount}/${dueCards.length} badges=${gam.badges.length}${isCramDay ? ' [CRAM]' : ''}`);
  }

  // ── Build final NousAIData ──
  const canvasEvents = generateNsemCanvasEvents(startDate);

  // Generate a weekly plan for this week
  const thisMonday = new Date();
  thisMonday.setDate(thisMonday.getDate() - thisMonday.getDay() + 1);
  const weeklyPlan: WeeklyPlan = {
    weekOf: dateStr(thisMonday),
    notes: 'First semester study plan - focus on building good habits',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
      day: d,
      blocks: NSEM_COURSES.slice(0, 3).map(c => ({
        courseId: c.id,
        type: pick(['review', 'practice', 'learn']),
        minutes: rand(15, 30),
        description: `Study ${c.shortName}`,
        done: i < new Date().getDay() - 1,
      })),
    })),
  };

  // Generate study schedules (shorter — only 4 weeks planned)
  const studySchedules: StudySchedule[] = NSEM_COURSES.slice(0, 3).map(c => {
    const blocks: StudyBlock[] = [];
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 5; d++) {
        const blockDate = new Date(startDate);
        blockDate.setDate(blockDate.getDate() + w * 7 + d);
        blocks.push({
          id: uid(),
          date: isoStr(blockDate),
          courseId: c.id,
          courseName: c.shortName,
          topic: pick(c.topics).name,
          durationMin: rand(15, 30),
          type: pick(['review', 'learn', 'practice']),
          done: blockDate.getTime() < Date.now(),
        });
      }
    }
    return {
      id: uid(),
      courseName: c.shortName,
      examDate: isoStr(new Date(Date.now() + rand(30, 60) * 86400000)),
      hoursPerWeek: rand(3, 8),
      blocks,
      createdAt: isoStr(startDate),
    };
  });

  const data: NousAIData = {
    settings: {
      aiProvider: 'none',
      canvasUrl: 'https://canvas.university.edu',
      canvasToken: '',
      canvasIcalUrl: '',
      canvasEvents,
    },
    pluginData: {
      quizHistory,
      coachData: {
        courses: NSEM_COURSES,
        sessions: studySessions,
        streak: gam.streak,
        totalStudyMinutes: gam.totalMinutes,
        weeklyPlan,
      },
      proficiencyData: profData,
      srData: { cards: srCards },
      timerState: {
        swRunning: false, swAccumulatedMs: 0, swResumedAt: null, swCourseId: '', swType: 'review',
        pomoRunning: false, pomoEndTime: null, pomoWorkMin: 25, pomoBreakMin: 5,
        pomoLongBreakMin: 15, pomoPhase: 'idle', pomoSession: 0, pomoTotalSessions: 0,
        pomoRemainingMs: 0, savedAt: Date.now(),
      },
      gamificationData: gam,
      quizBank: {},
      notes,
      drawings: [],
      studySessions,
      weeklyPlan,
      assignments,
      matchSets: [
        {
          id: uid(), name: 'CS Key Terms', subject: 'Intro CS',
          pairs: Array.from({ length: 6 }, (_, i) => ({ term: `CS Term ${i + 1}`, definition: `CS Definition ${i + 1}` })),
          createdAt: isoStr(new Date()),
        },
      ],
      studySchedules,
    },
  };

  // ── Final Stats ──
  log.push(`\n══════ NEW SEMESTER SIMULATION COMPLETE ══════`);
  log.push(`Duration: 30 days`);
  log.push(`Total XP: ${gam.xp}`);
  log.push(`Level: ${gam.level}`);
  log.push(`Current Streak: ${gam.streak}`);
  log.push(`Best Streak: ${gam.bestStreak}`);
  log.push(`Streak Freezes: ${gam.streakFreezes}/3 (never purchased)`);
  log.push(`Total Quizzes: ${gam.totalQuizzes} (all standard mode)`);
  log.push(`Total Study Minutes: ${gam.totalMinutes}`);
  log.push(`Perfect Scores: ${gam.perfectScores}`);
  log.push(`Badges: ${gam.badges.map(b => b.name).join(', ') || 'none'}`);
  log.push(`SR Cards: ${srCards.length} total, ${srCards.filter(c => c.state === 'new').length} new, ${srCards.filter(c => c.state === 'learning').length} learning, ${srCards.filter(c => c.state === 'review').length} review`);
  log.push(`Quiz History: ${quizHistory.length} attempts`);
  log.push(`Study Sessions: ${studySessions.length}`);
  log.push(`Notes: ${notes.length}`);
  log.push(`Assignments: ${assignments.length}`);
  log.push(`Canvas Events: ${canvasEvents.length}`);
  log.push(`Proficiency Subjects: ${Object.keys(profData.subjects).length}`);
  const nsemProfEntries = Object.values(profData.subjects).flatMap(s => Object.values(s));
  log.push(`Proficiency Entries: ${nsemProfEntries.length} (${nsemProfEntries.filter(e => e.isProficient).length} proficient)`);

  return { data, log };
}
