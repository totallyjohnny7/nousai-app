/**
 * HandwritingQuizTool — Draw characters, AI grades your handwriting.
 *
 * Phases: setup → drawing → recognizing → result → summary
 * Quiz types: hiragana, katakana, kanji, vocab
 * Uses callAI() with canvas image for OCR grading.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowRight, RotateCcw, X, Check, Loader2 } from 'lucide-react';
import DrawingCanvas, { clearCanvas } from '../DrawingCanvas';
import { callAI, isAIConfigured, safeParseAIJSON } from '../../utils/ai';
import { useStore } from '../../store';

// ── Quiz Bank (Nakama 1 schedule-mapped quizzes) ────────────────────────────
import quizBankJson from '../../data/nakama1/quizBank.json';

interface QuizBankItem {
  prompt?: string; answer?: string; answer_japanese?: string; english?: string;
  japanese?: string; kanji?: string; meaning?: string; base_form?: string; type: string;
}
interface QuizBankEntry {
  quiz_number: number | string; title: string; date: string; chapter: number;
  type: string; items: QuizBankItem[];
}
const quizBankData: { quizzes: QuizBankEntry[] } | null = quizBankJson as { quizzes: QuizBankEntry[] } ?? null;

// ── Built-in character sets ──────────────────────────────────────────────────

interface CharEntry {
  char: string;
  reading: string;
}

const HIRAGANA_SET: CharEntry[] = [
  { char: 'あ', reading: 'a' }, { char: 'い', reading: 'i' }, { char: 'う', reading: 'u' }, { char: 'え', reading: 'e' }, { char: 'お', reading: 'o' },
  { char: 'か', reading: 'ka' }, { char: 'き', reading: 'ki' }, { char: 'く', reading: 'ku' }, { char: 'け', reading: 'ke' }, { char: 'こ', reading: 'ko' },
  { char: 'さ', reading: 'sa' }, { char: 'し', reading: 'shi' }, { char: 'す', reading: 'su' }, { char: 'せ', reading: 'se' }, { char: 'そ', reading: 'so' },
  { char: 'た', reading: 'ta' }, { char: 'ち', reading: 'chi' }, { char: 'つ', reading: 'tsu' }, { char: 'て', reading: 'te' }, { char: 'と', reading: 'to' },
  { char: 'な', reading: 'na' }, { char: 'に', reading: 'ni' }, { char: 'ぬ', reading: 'nu' }, { char: 'ね', reading: 'ne' }, { char: 'の', reading: 'no' },
  { char: 'は', reading: 'ha' }, { char: 'ひ', reading: 'hi' }, { char: 'ふ', reading: 'fu' }, { char: 'へ', reading: 'he' }, { char: 'ほ', reading: 'ho' },
  { char: 'ま', reading: 'ma' }, { char: 'み', reading: 'mi' }, { char: 'む', reading: 'mu' }, { char: 'め', reading: 'me' }, { char: 'も', reading: 'mo' },
  { char: 'や', reading: 'ya' }, { char: 'ゆ', reading: 'yu' }, { char: 'よ', reading: 'yo' },
  { char: 'ら', reading: 'ra' }, { char: 'り', reading: 'ri' }, { char: 'る', reading: 'ru' }, { char: 'れ', reading: 're' }, { char: 'ろ', reading: 'ro' },
  { char: 'わ', reading: 'wa' }, { char: 'を', reading: 'wo' }, { char: 'ん', reading: 'n' },
];

const KATAKANA_SET: CharEntry[] = [
  { char: 'ア', reading: 'a' }, { char: 'イ', reading: 'i' }, { char: 'ウ', reading: 'u' }, { char: 'エ', reading: 'e' }, { char: 'オ', reading: 'o' },
  { char: 'カ', reading: 'ka' }, { char: 'キ', reading: 'ki' }, { char: 'ク', reading: 'ku' }, { char: 'ケ', reading: 'ke' }, { char: 'コ', reading: 'ko' },
  { char: 'サ', reading: 'sa' }, { char: 'シ', reading: 'shi' }, { char: 'ス', reading: 'su' }, { char: 'セ', reading: 'se' }, { char: 'ソ', reading: 'so' },
  { char: 'タ', reading: 'ta' }, { char: 'チ', reading: 'chi' }, { char: 'ツ', reading: 'tsu' }, { char: 'テ', reading: 'te' }, { char: 'ト', reading: 'to' },
  { char: 'ナ', reading: 'na' }, { char: 'ニ', reading: 'ni' }, { char: 'ヌ', reading: 'nu' }, { char: 'ネ', reading: 'ne' }, { char: 'ノ', reading: 'no' },
  { char: 'ハ', reading: 'ha' }, { char: 'ヒ', reading: 'hi' }, { char: 'フ', reading: 'fu' }, { char: 'ヘ', reading: 'he' }, { char: 'ホ', reading: 'ho' },
  { char: 'マ', reading: 'ma' }, { char: 'ミ', reading: 'mi' }, { char: 'ム', reading: 'mu' }, { char: 'メ', reading: 'me' }, { char: 'モ', reading: 'mo' },
  { char: 'ヤ', reading: 'ya' }, { char: 'ユ', reading: 'yu' }, { char: 'ヨ', reading: 'yo' },
  { char: 'ラ', reading: 'ra' }, { char: 'リ', reading: 'ri' }, { char: 'ル', reading: 'ru' }, { char: 'レ', reading: 're' }, { char: 'ロ', reading: 'ro' },
  { char: 'ワ', reading: 'wa' }, { char: 'ヲ', reading: 'wo' }, { char: 'ン', reading: 'n' },
];

// ── Types ────────────────────────────────────────────────────────────────────

type QuizType = 'hiragana' | 'katakana' | 'kanji' | 'vocab';
type Phase = 'setup' | 'drawing' | 'recognizing' | 'result' | 'summary';

interface Question {
  prompt: string;        // What to show (romaji or English meaning)
  expectedAnswer: string; // The character/word the user should draw
}

interface QuizResult {
  question: Question;
  recognized: string;
  correct: boolean;
  feedback: string;
  drawingDataUrl: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const JP_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
const HIRAGANA_REGEX = /[\u3040-\u309F]/;
const KATAKANA_REGEX = /[\u30A0-\u30FF]/;
const KANJI_REGEX = /[\u4E00-\u9FFF]/;

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestionsFromFlashcards(
  flashcards: Array<{ front: string; back: string }>,
  quizType: QuizType,
  count: number,
): Question[] {
  const pool: Question[] = [];

  for (const card of flashcards) {
    const front = card.front || '';
    const back = card.back || '';

    // Find the Japanese side and the English/reading side
    const frontHasJP = JP_REGEX.test(front);
    const backHasJP = JP_REGEX.test(back);
    const jpText = frontHasJP ? front : backHasJP ? back : null;
    const engText = frontHasJP ? back : front;

    if (!jpText) continue;

    switch (quizType) {
      case 'hiragana':
        if (HIRAGANA_REGEX.test(jpText)) {
          pool.push({ prompt: engText, expectedAnswer: jpText });
        }
        break;
      case 'katakana':
        if (KATAKANA_REGEX.test(jpText)) {
          pool.push({ prompt: engText, expectedAnswer: jpText });
        }
        break;
      case 'kanji':
        if (KANJI_REGEX.test(jpText)) {
          pool.push({ prompt: engText, expectedAnswer: jpText });
        }
        break;
      case 'vocab':
        pool.push({ prompt: engText, expectedAnswer: jpText });
        break;
    }
  }

  return shuffle(pool).slice(0, count);
}

function buildQuestionsFromBuiltIn(
  quizType: QuizType,
  count: number,
): Question[] {
  const set = quizType === 'katakana' ? KATAKANA_SET : HIRAGANA_SET;
  return shuffle(set)
    .slice(0, count)
    .map((entry) => ({
      prompt: entry.reading,
      expectedAnswer: entry.char,
    }));
}

// ── Styles ───────────────────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent-color, #F5A623)',
  color: '#000',
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--bg-secondary, #1a1a2e)',
  color: 'var(--text-primary, #fff)',
  border: '1px solid var(--border, #333)',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border, #333)',
  background: 'var(--bg-secondary, #111)',
  color: 'var(--text-primary, #fff)',
  fontFamily: 'inherit',
  fontSize: 13,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function HandwritingQuizTool() {
  const { courses } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasStrokesRef = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false); // state mirror for re-render

  // Setup state
  const [courseId, setCourseId] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('hiragana');
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedQuizBank, setSelectedQuizBank] = useState<string>(''); // quiz_number or empty

  // Quiz state
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState('');

  // Result state (for current question)
  const [currentResult, setCurrentResult] = useState<QuizResult | null>(null);

  const currentQuestion = questions[currentIdx] ?? null;
  const correctCount = results.filter((r) => r.correct).length;

  // Courses with Japanese flashcards
  const jpCourses = useMemo(() => {
    return courses.filter((c) =>
      (c.flashcards || []).some(
        (f) => JP_REGEX.test(f.front || '') || JP_REGEX.test(f.back || ''),
      ),
    );
  }, [courses]);

  // ── Start quiz ───────────────────────────────────────────────────────────

  const startQuiz = useCallback(() => {
    if (!isAIConfigured()) {
      setError('AI not configured — go to Settings → AI Provider');
      return;
    }

    let qs: Question[] = [];

    // Source 1: Quiz Bank (Nakama 1 schedule-mapped quizzes)
    if (selectedQuizBank && quizBankData) {
      const quiz = quizBankData.quizzes.find(
        (q) => String(q.quiz_number) === selectedQuizBank,
      );
      if (quiz?.items?.length) {
        qs = shuffle(quiz.items.map((item) => ({
          prompt: item.prompt || item.english || item.meaning || item.base_form || '',
          expectedAnswer: item.answer || item.answer_japanese || item.japanese || item.kanji || '',
        }))).filter(q => q.prompt && q.expectedAnswer).slice(0, questionCount);
      }
    }

    // Source 2: Course flashcards
    if (qs.length === 0) {
      const course = courses.find((c) => c.id === courseId);
      if (course && course.flashcards?.length) {
        qs = buildQuestionsFromFlashcards(
          course.flashcards,
          quizType,
          questionCount,
        );
      }
    }

    // Source 3: Built-in character sets
    if (qs.length < questionCount && !selectedQuizBank) {
      if (quizType === 'hiragana' || quizType === 'katakana') {
        qs = buildQuestionsFromBuiltIn(quizType, questionCount);
      } else if (qs.length === 0) {
        setError(
          'No kanji/vocab flashcards found. Select a course with Japanese flashcards, or try Hiragana/Katakana mode.',
        );
        return;
      }
    }

    if (qs.length === 0) {
      setError('No questions available for this quiz.');
      return;
    }

    setQuestions(qs);
    setCurrentIdx(0);
    setResults([]);
    setStreak(0);
    setError('');
    setCurrentResult(null);
    hasStrokesRef.current = false; setHasStrokes(false);
    setPhase('drawing');
  }, [courseId, courses, questionCount, quizType, selectedQuizBank]);

  // ── Submit drawing for grading ───────────────────────────────────────────

  const submitDrawing = useCallback(async () => {
    if (!canvasRef.current || !currentQuestion || !hasStrokesRef.current) return;

    const drawingDataUrl = canvasRef.current.toDataURL('image/png');
    setPhase('recognizing');
    setError('');

    try {
      const gradePrompt = `You are a handwriting quiz grader. The image shows a handwritten character/word on a dark canvas.
Expected answer: ${currentQuestion.expectedAnswer}
Tasks:
1. Recognize what is drawn
2. Judge if it matches the expected answer
Output JSON only: {"recognized": "...", "correct": true/false, "feedback": "..."}`;

      const rawResult = await callAI(
        [
          {
            role: 'user',
            content: [
              { type: 'text', text: gradePrompt },
              { type: 'image_url', image_url: { url: drawingDataUrl } },
            ],
          },
        ],
        { maxTokens: 300 },
        'ocr',
      );

      const { data } = safeParseAIJSON<{
        recognized: string;
        correct: boolean;
        feedback: string;
      }>(rawResult, { recognized: '?', correct: false, feedback: 'Could not parse AI response' });

      const result: QuizResult = {
        question: currentQuestion,
        recognized: data.recognized,
        correct: data.correct,
        feedback: data.feedback,
        drawingDataUrl,
      };

      setCurrentResult(result);
      setResults((prev) => [...prev, result]);
      setStreak((prev) => (data.correct ? prev + 1 : 0));
      setPhase('result');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Recognition failed');
      setPhase('drawing');
    }
  }, [currentQuestion]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const nextQuestion = useCallback(() => {
    if (currentIdx + 1 >= questions.length) {
      setPhase('summary');
      return;
    }
    setCurrentIdx((prev) => prev + 1);
    setCurrentResult(null);
    hasStrokesRef.current = false; setHasStrokes(false);
    setPhase('drawing');
  }, [currentIdx, questions.length]);

  const practiceAgain = useCallback(() => {
    if (!currentQuestion) return;
    // Add this question to the end of the queue
    setQuestions((prev) => [...prev, currentQuestion]);
    nextQuestion();
  }, [currentQuestion, nextQuestion]);

  const endQuiz = useCallback(() => {
    setPhase('summary');
  }, []);

  const retryMissed = useCallback(() => {
    const missed = results
      .filter((r) => !r.correct)
      .map((r) => r.question);
    if (missed.length === 0) return;
    setQuestions(shuffle(missed));
    setCurrentIdx(0);
    setResults([]);
    setStreak(0);
    setCurrentResult(null);
    hasStrokesRef.current = false; setHasStrokes(false);
    setPhase('drawing');
  }, [results]);

  const playAgain = useCallback(() => {
    setPhase('setup');
    setQuestions([]);
    setResults([]);
    setCurrentIdx(0);
    setStreak(0);
    setCurrentResult(null);
    setError('');
  }, []);

  // ── Clear canvas when entering drawing phase ────────────────────────────

  useEffect(() => {
    if (phase === 'drawing') {
      clearCanvas(canvasRef);
      hasStrokesRef.current = false; setHasStrokes(false);
    }
  }, [phase, currentIdx]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (phase === 'drawing') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (hasStrokesRef.current) submitDrawing();
        }
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          clearCanvas(canvasRef);
          hasStrokesRef.current = false; setHasStrokes(false);
        }
      }
      if (phase === 'result') {
        if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          nextQuestion();
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, submitDrawing, nextQuestion]);

  // ── Render: Setup ──────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary, #fff)', fontSize: 18 }}>
          Handwriting Quiz Setup
        </h3>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#ef444420', color: '#ef4444', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Course select */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #888)', marginBottom: 4 }}>
            Course (optional)
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            style={{ ...selectStyle, width: '100%' }}
          >
            <option value="">-- Built-in character sets --</option>
            {jpCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({(c.flashcards || []).length} cards)
              </option>
            ))}
            {courses
              .filter((c) => !jpCourses.includes(c))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({(c.flashcards || []).length} cards)
                </option>
              ))}
          </select>
        </div>

        {/* Quiz Bank (Nakama 1 schedule) */}
        {quizBankData && quizBankData.quizzes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #888)', marginBottom: 4 }}>
              JAPN1110 Quiz Bank (optional — overrides course + type)
            </label>
            <select
              value={selectedQuizBank}
              onChange={(e) => setSelectedQuizBank(e.target.value)}
              style={{ ...selectStyle, width: '100%' }}
            >
              <option value="">-- Manual selection below --</option>
              {quizBankData.quizzes.map((q) => (
                <option key={String(q.quiz_number)} value={String(q.quiz_number)}>
                  {typeof q.quiz_number === 'number' ? `Quiz ${q.quiz_number}` : q.quiz_number.charAt(0).toUpperCase() + q.quiz_number.slice(1)}: {q.title} ({q.items.length} items, {q.date})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quiz type */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #888)', marginBottom: 4 }}>
            Quiz Type {selectedQuizBank ? '(overridden by quiz bank)' : ''}
          </label>
          <select
            value={quizType}
            onChange={(e) => setQuizType(e.target.value as QuizType)}
            style={{ ...selectStyle, width: '100%' }}
          >
            <option value="hiragana">Hiragana (romaji → draw hiragana)</option>
            <option value="katakana">Katakana (romaji → draw katakana)</option>
            <option value="kanji">Kanji (English → draw kanji)</option>
            <option value="vocab">Vocab (English → draw full word)</option>
          </select>
        </div>

        {/* Question count */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #888)', marginBottom: 4 }}>
            Questions: {questionCount}
          </label>
          <input
            type="range"
            min={3}
            max={46}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <button onClick={startQuiz} style={btnPrimary}>
          Start Quiz
        </button>
      </div>
    );
  }

  // ── Render: Drawing ────────────────────────────────────────────────────

  if (phase === 'drawing' || phase === 'recognizing') {
    const isRecognizing = phase === 'recognizing';
    return (
      <div style={{ padding: 16 }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
            Question {currentIdx + 1} / {questions.length}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
            {correctCount}/{results.length} correct
            {streak > 1 ? ` | Streak: ${streak}` : ''}
          </span>
        </div>
        <div style={{
          height: 3, borderRadius: 2, background: 'var(--border, #333)', marginBottom: 16,
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'var(--accent-color, #F5A623)',
            width: `${((currentIdx) / questions.length) * 100}%`,
            transition: 'width 0.3s',
          }} />
        </div>

        {/* Prompt */}
        <div style={{
          textAlign: 'center', marginBottom: 16, padding: '12px 16px',
          borderRadius: 10, background: 'var(--bg-secondary, #111)',
          border: '1px solid var(--border, #333)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 4 }}>
            Draw the character for:
          </div>
          <div style={{
            fontSize: 28, fontWeight: 700, color: 'var(--text-primary, #fff)',
            fontFamily: "'Noto Sans JP', 'Inter', sans-serif",
          }}>
            {currentQuestion?.prompt}
          </div>
        </div>

        {/* Canvas */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <DrawingCanvas
            canvasRef={canvasRef}
            width={300}
            height={300}
            disabled={isRecognizing}
            onStroke={() => { hasStrokesRef.current = true; setHasStrokes(true); }}
          />
        </div>

        {error && (
          <div style={{ padding: '6px 10px', borderRadius: 6, background: '#ef444420', color: '#ef4444', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Actions — sticky bottom so always accessible even on small screens */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'var(--bg-primary, #0a0a0a)', padding: '10px 0 4px', zIndex: 10, borderTop: '1px solid var(--border, #333)' }}>
          <button
            onClick={() => { clearCanvas(canvasRef); hasStrokesRef.current = false; setHasStrokes(false); }}
            disabled={isRecognizing}
            style={{ ...btnSecondary, opacity: isRecognizing ? 0.5 : 1 }}
          >
            <RotateCcw size={14} /> Clear
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); }}
            onClick={submitDrawing}
            disabled={isRecognizing || !hasStrokes}
            style={{ ...btnPrimary, opacity: (isRecognizing || !hasStrokes) ? 0.5 : 1 }}
          >
            {isRecognizing ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Grading...
              </>
            ) : (
              <>
                <Check size={14} /> Submit (Enter)
              </>
            )}
          </button>
          <button onClick={endQuiz} disabled={isRecognizing} style={{ ...btnSecondary, opacity: isRecognizing ? 0.5 : 1 }}>
            <X size={14} /> End Quiz
          </button>
          <div style={{ width: '100%', textAlign: 'center', fontSize: 10, color: 'var(--text-muted, #666)' }}>
            Esc/Backspace = clear &middot; Enter = submit
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--text-muted, #666)', display: 'none' }}>
          Esc/Backspace = clear canvas
        </div>

        {/* Spinner animation */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render: Result ─────────────────────────────────────────────────────

  if (phase === 'result' && currentResult) {
    const isCorrect = currentResult.correct;
    return (
      <div style={{ padding: 16 }}>
        {/* Score bar */}
        <div style={{
          textAlign: 'center', marginBottom: 16, padding: '8px 12px',
          borderRadius: 8, background: 'var(--bg-secondary, #111)',
          fontSize: 13, color: 'var(--text-primary, #fff)',
        }}>
          {correctCount}/{results.length} correct
          {streak > 1 ? ` | Streak: ${streak}` : ''}
        </div>

        {/* Side-by-side comparison */}
        <div style={{
          display: 'flex', gap: 16, justifyContent: 'center',
          alignItems: 'center', marginBottom: 16, flexWrap: 'wrap',
        }}>
          {/* User's drawing */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 4 }}>Your drawing</div>
            <img
              src={currentResult.drawingDataUrl}
              alt="Your drawing"
              style={{
                width: 140, height: 140, borderRadius: 10,
                border: `3px solid ${isCorrect ? '#22c55e' : '#ef4444'}`,
                objectFit: 'contain', background: '#1a1a2e',
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', marginTop: 4 }}>
              AI read: <strong style={{ color: 'var(--text-primary, #fff)' }}>{currentResult.recognized}</strong>
            </div>
          </div>

          {/* Expected answer */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 4 }}>Expected</div>
            <div style={{
              width: 140, height: 140, borderRadius: 10,
              border: '3px solid var(--border, #444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary, #111)',
              fontSize: 72, fontFamily: "'Noto Sans JP', 'Inter', sans-serif",
              color: 'var(--text-primary, #fff)', lineHeight: 1,
            }}>
              {currentResult.question.expectedAnswer}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', marginTop: 4 }}>
              ({currentResult.question.prompt})
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div style={{
          textAlign: 'center', marginBottom: 12, fontSize: 16, fontWeight: 700,
          color: isCorrect ? '#22c55e' : '#ef4444',
        }}>
          {isCorrect ? 'Correct!' : 'Incorrect'}
        </div>

        {/* Feedback */}
        {currentResult.feedback && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary, #111)',
            border: '1px solid var(--border, #333)', fontSize: 13,
            color: 'var(--text-primary, #ddd)', marginBottom: 16, textAlign: 'center',
          }}>
            {currentResult.feedback}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={nextQuestion} style={btnPrimary}>
            <ArrowRight size={14} />
            {currentIdx + 1 >= questions.length ? 'See Results' : 'Next'}
            <span style={{ fontSize: 10, opacity: 0.7 }}>(→)</span>
          </button>
          {!isCorrect && (
            <button onClick={practiceAgain} style={btnSecondary}>
              <RotateCcw size={14} /> Practice Again
            </button>
          )}
          <button onClick={endQuiz} style={btnSecondary}>
            <X size={14} /> End Quiz
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Summary ────────────────────────────────────────────────────

  if (phase === 'summary') {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const missed = results.filter((r) => !r.correct);

    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary, #fff)', fontSize: 18, textAlign: 'center' }}>
          Quiz Complete
        </h3>

        {/* Score circle */}
        <div style={{
          textAlign: 'center', marginBottom: 20, padding: '20px 16px',
          borderRadius: 12, background: 'var(--bg-secondary, #111)',
          border: '1px solid var(--border, #333)',
        }}>
          <div style={{
            fontSize: 48, fontWeight: 800, fontFamily: "'DM Mono', monospace",
            color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
          }}>
            {pct}%
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted, #888)', marginTop: 4 }}>
            {correct} / {total} correct
          </div>
        </div>

        {/* Missed questions */}
        {missed.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>
              Missed ({missed.length})
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 8,
            }}>
              {missed.map((r, i) => (
                <div key={i} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: '#ef444415', border: '1px solid #ef444430',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: 28, fontFamily: "'Noto Sans JP', 'Inter', sans-serif",
                    color: 'var(--text-primary, #fff)',
                  }}>
                    {r.question.expectedAnswer}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
                    {r.question.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {missed.length > 0 && (
            <button onClick={retryMissed} style={btnPrimary}>
              <RotateCcw size={14} /> Retry Missed ({missed.length})
            </button>
          )}
          <button onClick={playAgain} style={btnSecondary}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
