import React, { useState, useEffect } from 'react';
import {
  Volume2, Play, BookOpenCheck, Brain, BookOpen, Layers,
  Plus, ChevronLeft, CheckCircle, XCircle, ArrowRight,
  Eye, Trophy, RotateCcw,
} from 'lucide-react';
import { speak } from '../utils/speechTools';

// ── Shared helpers & styles (copied from LearnPage) ──

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 16,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', border: '2px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical' as const, lineHeight: 1.7,
};

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn btn-sm btn-secondary mb-3" style={{ gap: 4 }}>
      <ChevronLeft size={14} /> Back
    </button>
  );
}

// ── Data constants ──

const HIRAGANA: [string, string][] = [
  ['a', '\u3042'], ['i', '\u3044'], ['u', '\u3046'], ['e', '\u3048'], ['o', '\u304A'],
  ['ka', '\u304B'], ['ki', '\u304D'], ['ku', '\u304F'], ['ke', '\u3051'], ['ko', '\u3053'],
  ['sa', '\u3055'], ['shi', '\u3057'], ['su', '\u3059'], ['se', '\u305B'], ['so', '\u305D'],
  ['ta', '\u305F'], ['chi', '\u3061'], ['tsu', '\u3064'], ['te', '\u3066'], ['to', '\u3068'],
  ['na', '\u306A'], ['ni', '\u306B'], ['nu', '\u306C'], ['ne', '\u306D'], ['no', '\u306E'],
  ['ha', '\u306F'], ['hi', '\u3072'], ['fu', '\u3075'], ['he', '\u3078'], ['ho', '\u307B'],
  ['ma', '\u307E'], ['mi', '\u307F'], ['mu', '\u3080'], ['me', '\u3081'], ['mo', '\u3082'],
  ['ya', '\u3084'], ['yu', '\u3086'], ['yo', '\u3088'],
  ['ra', '\u3089'], ['ri', '\u308A'], ['ru', '\u308B'], ['re', '\u308C'], ['ro', '\u308D'],
  ['wa', '\u308F'], ['wo', '\u3092'], ['n', '\u3093'],
];

const KATAKANA: [string, string][] = [
  ['a', '\u30A2'], ['i', '\u30A4'], ['u', '\u30A6'], ['e', '\u30A8'], ['o', '\u30AA'],
  ['ka', '\u30AB'], ['ki', '\u30AD'], ['ku', '\u30AF'], ['ke', '\u30B1'], ['ko', '\u30B3'],
  ['sa', '\u30B5'], ['shi', '\u30B7'], ['su', '\u30B9'], ['se', '\u30BB'], ['so', '\u30BD'],
  ['ta', '\u30BF'], ['chi', '\u30C1'], ['tsu', '\u30C4'], ['te', '\u30C6'], ['to', '\u30C8'],
  ['na', '\u30CA'], ['ni', '\u30CB'], ['nu', '\u30CC'], ['ne', '\u30CD'], ['no', '\u30CE'],
  ['ha', '\u30CF'], ['hi', '\u30D2'], ['fu', '\u30D5'], ['he', '\u30D8'], ['ho', '\u30DB'],
  ['ma', '\u30DE'], ['mi', '\u30DF'], ['mu', '\u30E0'], ['me', '\u30E1'], ['mo', '\u30E2'],
  ['ya', '\u30E4'], ['yu', '\u30E6'], ['yo', '\u30E8'],
  ['ra', '\u30E9'], ['ri', '\u30EA'], ['ru', '\u30EB'], ['re', '\u30EC'], ['ro', '\u30ED'],
  ['wa', '\u30EF'], ['wo', '\u30F2'], ['n', '\u30F3'],
];

const COMMON_KANJI: [string, string, string][] = [
  ['\u4E00', 'ichi', 'one'], ['\u4E8C', 'ni', 'two'], ['\u4E09', 'san', 'three'],
  ['\u56DB', 'shi/yon', 'four'], ['\u4E94', 'go', 'five'], ['\u516D', 'roku', 'six'],
  ['\u4E03', 'shichi/nana', 'seven'], ['\u516B', 'hachi', 'eight'], ['\u4E5D', 'ku/kyuu', 'nine'],
  ['\u5341', 'juu', 'ten'], ['\u767E', 'hyaku', 'hundred'], ['\u5343', 'sen', 'thousand'],
  ['\u5927', 'dai/oo', 'big'], ['\u5C0F', 'shou/ko', 'small'],
  ['\u4E0A', 'jou/ue', 'up/above'], ['\u4E0B', 'ka/shita', 'down/below'],
  ['\u4E2D', 'chuu/naka', 'middle'], ['\u5DE6', 'sa/hidari', 'left'], ['\u53F3', 'u/migi', 'right'],
  ['\u4EBA', 'jin/hito', 'person'], ['\u5B50', 'shi/ko', 'child'],
  ['\u5973', 'jo/onna', 'woman'], ['\u7537', 'dan/otoko', 'man'],
  ['\u65E5', 'nichi/hi', 'day/sun'], ['\u6708', 'getsu/tsuki', 'month/moon'],
  ['\u706B', 'ka/hi', 'fire'], ['\u6C34', 'sui/mizu', 'water'],
  ['\u6728', 'moku/ki', 'tree/wood'], ['\u91D1', 'kin/kane', 'gold/money'],
  ['\u571F', 'do/tsuchi', 'earth/soil'], ['\u5C71', 'san/yama', 'mountain'],
  ['\u5DDD', 'sen/kawa', 'river'], ['\u7530', 'den/ta', 'rice field'],
  ['\u5929', 'ten/ama', 'heaven/sky'], ['\u6C17', 'ki', 'spirit/energy'],
  ['\u82B1', 'ka/hana', 'flower'], ['\u96E8', 'u/ame', 'rain'],
  ['\u7A7A', 'kuu/sora', 'sky/empty'], ['\u98A8', 'fuu/kaze', 'wind'],
  ['\u96EA', 'setsu/yuki', 'snow'], ['\u661F', 'sei/hoshi', 'star'],
  ['\u5B66', 'gaku/mana', 'study'], ['\u6821', 'kou', 'school'],
  ['\u5148', 'sen/saki', 'before/ahead'], ['\u751F', 'sei/u', 'life/birth'],
  ['\u7530', 'den/ta', 'rice field'], ['\u767D', 'haku/shiro', 'white'],
  ['\u9ED2', 'koku/kuro', 'black'], ['\u8D64', 'seki/aka', 'red'],
  ['\u9752', 'sei/ao', 'blue/green'], ['\u76EE', 'moku/me', 'eye'],
  ['\u8033', 'ji/mimi', 'ear'], ['\u53E3', 'kou/kuchi', 'mouth'],
  ['\u624B', 'shu/te', 'hand'], ['\u8DB3', 'soku/ashi', 'foot/leg'],
  ['\u529B', 'ryoku/chikara', 'power'], ['\u738B', 'ou', 'king'],
  ['\u7389', 'gyoku/tama', 'jewel'], ['\u77F3', 'seki/ishi', 'stone'],
  ['\u7ACB', 'ritsu/ta', 'stand'], ['\u4F11', 'kyuu/yasu', 'rest'],
];

// Romaji-to-kana conversion map
const ROMAJI_TO_HIRAGANA: Record<string, string> = {};
const ROMAJI_TO_KATAKANA: Record<string, string> = {};
HIRAGANA.forEach(([r, c]) => { ROMAJI_TO_HIRAGANA[r] = c; });
KATAKANA.forEach(([r, c]) => { ROMAJI_TO_KATAKANA[r] = c; });

// Sentence matching pairs
const SENTENCE_PAIRS: { jp: string; en: string }[] = [
  { jp: '\u79C1\u306F\u5B66\u751F\u3067\u3059', en: 'I am a student' },
  { jp: '\u3053\u308C\u306F\u672C\u3067\u3059', en: 'This is a book' },
  { jp: '\u304A\u5143\u6C17\u3067\u3059\u304B', en: 'How are you?' },
  { jp: '\u4ECA\u65E5\u306F\u3044\u3044\u5929\u6C17\u3067\u3059', en: 'Today is nice weather' },
  { jp: '\u65E5\u672C\u8A9E\u3092\u52C9\u5F37\u3057\u3066\u3044\u307E\u3059', en: 'I am studying Japanese' },
  { jp: '\u304A\u8336\u3092\u98F2\u307F\u307E\u3059', en: 'I drink tea' },
  { jp: '\u3054\u98EF\u3092\u98DF\u3079\u307E\u3059', en: 'I eat rice/a meal' },
  { jp: '\u5B66\u6821\u306B\u884C\u304D\u307E\u3059', en: 'I go to school' },
  { jp: '\u5F7C\u306F\u5148\u751F\u3067\u3059', en: 'He is a teacher' },
  { jp: '\u732B\u304C\u597D\u304D\u3067\u3059', en: 'I like cats' },
  { jp: '\u5927\u304D\u3044\u5C71\u304C\u3042\u308A\u307E\u3059', en: 'There is a big mountain' },
  { jp: '\u6C34\u3092\u304F\u3060\u3055\u3044', en: 'Please give me water' },
  { jp: '\u4F55\u6642\u3067\u3059\u304B', en: 'What time is it?' },
  { jp: '\u3069\u3053\u306B\u4F4F\u3093\u3067\u3044\u307E\u3059\u304B', en: 'Where do you live?' },
  { jp: '\u3053\u308C\u306F\u3044\u304F\u3089\u3067\u3059\u304B', en: 'How much is this?' },
];

// Grammar lessons
const GRAMMAR_LESSONS: { title: string; pattern: string; explanation: string; examples: { jp: string; en: string }[] }[] = [
  {
    title: 'Desu (\u3067\u3059)',
    pattern: '[Noun] \u3067\u3059',
    explanation: 'The copula "desu" is like "is/am/are". It goes at the end of a sentence to make it polite.',
    examples: [
      { jp: '\u5B66\u751F\u3067\u3059', en: '(I) am a student' },
      { jp: '\u672C\u3067\u3059', en: '(It) is a book' },
    ],
  },
  {
    title: 'Wa (\u306F) Particle',
    pattern: '[Topic] \u306F [comment]',
    explanation: 'The particle "wa" marks the topic of the sentence \u2014 what you are talking about.',
    examples: [
      { jp: '\u79C1\u306F\u5B66\u751F\u3067\u3059', en: 'I am a student' },
      { jp: '\u3053\u308C\u306F\u732B\u3067\u3059', en: 'This is a cat' },
    ],
  },
  {
    title: 'Wo (\u3092) Particle',
    pattern: '[Object] \u3092 [Verb]',
    explanation: 'The particle "wo/o" marks the direct object of a verb \u2014 what the action is done to.',
    examples: [
      { jp: '\u672C\u3092\u8AAD\u307F\u307E\u3059', en: 'I read a book' },
      { jp: '\u6C34\u3092\u98F2\u307F\u307E\u3059', en: 'I drink water' },
    ],
  },
  {
    title: 'Ni (\u306B) Particle',
    pattern: '[Place/Time] \u306B [Verb]',
    explanation: 'The particle "ni" marks a destination, location, or specific time.',
    examples: [
      { jp: '\u5B66\u6821\u306B\u884C\u304D\u307E\u3059', en: 'I go to school' },
      { jp: '\u4E03\u6642\u306B\u8D77\u304D\u307E\u3059', en: 'I wake up at 7' },
    ],
  },
  {
    title: 'Masu (\u307E\u3059) Form',
    pattern: '[Verb stem] \u307E\u3059',
    explanation: 'The polite verb ending. Replace the dictionary ending with -masu for polite present/future tense.',
    examples: [
      { jp: '\u98DF\u3079\u307E\u3059', en: 'I eat (polite)' },
      { jp: '\u884C\u304D\u307E\u3059', en: 'I go (polite)' },
    ],
  },
  {
    title: 'Ka (\u304B) Question',
    pattern: '[Sentence] \u304B',
    explanation: 'Add "ka" at the end of a sentence to turn it into a question.',
    examples: [
      { jp: '\u5B66\u751F\u3067\u3059\u304B', en: 'Are you a student?' },
      { jp: '\u98DF\u3079\u307E\u3059\u304B', en: 'Will you eat?' },
    ],
  },
];

// TTS helper for Japanese — uses speechTools for Bluetooth compatibility
function speakJapanese(text: string) {
  speak(text, { voiceLang: 'ja-JP', rate: 0.85 });
}

// Common vocabulary
const COMMON_VOCAB: { jp: string; reading: string; en: string }[] = [
  { jp: '\u3053\u3093\u306B\u3061\u306F', reading: 'konnichiwa', en: 'hello' },
  { jp: '\u3042\u308A\u304C\u3068\u3046', reading: 'arigatou', en: 'thank you' },
  { jp: '\u3059\u307F\u307E\u305B\u3093', reading: 'sumimasen', en: 'excuse me / sorry' },
  { jp: '\u306F\u3044', reading: 'hai', en: 'yes' },
  { jp: '\u3044\u3044\u3048', reading: 'iie', en: 'no' },
  { jp: '\u304A\u306F\u3088\u3046', reading: 'ohayou', en: 'good morning' },
  { jp: '\u3053\u3093\u3070\u3093\u306F', reading: 'konbanwa', en: 'good evening' },
  { jp: '\u3055\u3088\u3046\u306A\u3089', reading: 'sayounara', en: 'goodbye' },
  { jp: '\u304A\u306D\u304C\u3044\u3057\u307E\u3059', reading: 'onegaishimasu', en: 'please' },
  { jp: '\u98DF\u3079\u308B', reading: 'taberu', en: 'to eat' },
  { jp: '\u98F2\u3080', reading: 'nomu', en: 'to drink' },
  { jp: '\u884C\u304F', reading: 'iku', en: 'to go' },
  { jp: '\u898B\u308B', reading: 'miru', en: 'to see / look' },
  { jp: '\u8A71\u3059', reading: 'hanasu', en: 'to speak' },
  { jp: '\u66F8\u304F', reading: 'kaku', en: 'to write' },
  { jp: '\u8AAD\u3080', reading: 'yomu', en: 'to read' },
  { jp: '\u5B66\u751F', reading: 'gakusei', en: 'student' },
  { jp: '\u5148\u751F', reading: 'sensei', en: 'teacher' },
  { jp: '\u53CB\u9054', reading: 'tomodachi', en: 'friend' },
  { jp: '\u672C', reading: 'hon', en: 'book' },
];

// ── JapaneseMode Component ──

function JapaneseMode() {
  const [studyType, setStudyType] = useState<'hiragana' | 'katakana' | 'kanji'>('hiragana');
  const [mode, setMode] = useState<'chart' | 'quiz' | 'converter' | 'practice' | 'vocab' | 'grammar' | 'sentences'>('chart');
  const [quizItems, setQuizItems] = useState<{ char: string; romaji: string; meaning?: string }[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Converter state
  const [converterInput, setConverterInput] = useState('');
  const [converterTarget, setConverterTarget] = useState<'hiragana' | 'katakana'>('hiragana');
  const [converterOutput, setConverterOutput] = useState('');

  // Practice state
  const [practiceItems, setPracticeItems] = useState<{ char: string; romaji: string }[]>([]);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceResult, setPracticeResult] = useState<'none' | 'correct' | 'wrong'>('none');
  const [practiceScore, setPracticeScore] = useState({ correct: 0, total: 0 });
  const [practiceKanaType, setPracticeKanaType] = useState<'hiragana' | 'katakana'>('hiragana');

  // Vocab state
  const [vocabItems, setVocabItems] = useState<{ jp: string; reading: string; en: string }[]>([]);
  const [vocabIdx, setVocabIdx] = useState(0);
  const [vocabShowAnswer, setVocabShowAnswer] = useState(false);
  const [vocabScore, setVocabScore] = useState({ correct: 0, total: 0 });
  const [customVocab, setCustomVocab] = useState<{ jp: string; reading: string; en: string }[]>([]);
  const [newJp, setNewJp] = useState('');
  const [newReading, setNewReading] = useState('');
  const [newEn, setNewEn] = useState('');

  // Grammar lesson state
  const [grammarIdx, setGrammarIdx] = useState(0);

  // Sentence matching state
  const [sentPairs, setSentPairs] = useState<{ jp: string; en: string }[]>([]);
  const [sentIdx, setSentIdx] = useState(0);
  const [sentOptions, setSentOptions] = useState<string[]>([]);
  const [sentSelected, setSentSelected] = useState<string | null>(null);
  const [sentScore, setSentScore] = useState({ correct: 0, total: 0 });

  // Load custom vocab from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nousai-jp-vocab');
    if (saved) {
      try { setCustomVocab(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Romaji-to-kana converter
  function convertRomaji(text: string) {
    const map = converterTarget === 'hiragana' ? ROMAJI_TO_HIRAGANA : ROMAJI_TO_KATAKANA;
    let result = '';
    let i = 0;
    const lower = text.toLowerCase();

    while (i < lower.length) {
      let matched = false;
      // Try 3-char, 2-char, 1-char matches
      for (let len = 3; len >= 1; len--) {
        const chunk = lower.slice(i, i + len);
        if (map[chunk]) {
          result += map[chunk];
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Handle double consonants (e.g., kk -> small tsu + k)
        if (i + 1 < lower.length && lower[i] === lower[i + 1] && /[bcdfghjklmnpqrstvwxyz]/.test(lower[i])) {
          result += converterTarget === 'hiragana' ? '\u3063' : '\u30C3';
          i += 1;
        } else {
          result += text[i];
          i++;
        }
      }
    }
    return result;
  }

  function handleConverterInput(text: string) {
    setConverterInput(text);
    setConverterOutput(convertRomaji(text));
  }

  // Chart click handler - append to converter
  function handleChartClick(romaji: string, kana: string) {
    setConverterInput(prev => prev + romaji);
    setConverterOutput(prev => prev + kana);
  }

  function startQuiz() {
    let items: { char: string; romaji: string; meaning?: string }[];
    if (studyType === 'kanji') {
      items = COMMON_KANJI.map(([k, r, m]) => ({ char: k, romaji: r, meaning: m }));
    } else {
      const data = studyType === 'hiragana' ? HIRAGANA : KATAKANA;
      items = data.map(([r, c]) => ({ char: c, romaji: r }));
    }
    setQuizItems(shuffleArray(items).slice(0, 15));
    setCurrentIdx(0);
    setUserAnswer('');
    setShowFeedback(false);
    setScore({ correct: 0, total: 0 });
    setMode('quiz');
  }

  function checkAnswer() {
    const item = quizItems[currentIdx];
    const correct = item.romaji.split('/').some(r =>
      userAnswer.toLowerCase().trim() === r.toLowerCase().trim()
    );
    setIsCorrect(correct);
    setShowFeedback(true);
    setScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
  }

  function nextItem() {
    if (currentIdx + 1 >= quizItems.length) {
      setMode('chart');
      return;
    }
    setCurrentIdx(prev => prev + 1);
    setUserAnswer('');
    setShowFeedback(false);
  }

  // Practice mode: show kana, user types romaji
  function startPractice() {
    const data = practiceKanaType === 'hiragana' ? HIRAGANA : KATAKANA;
    const items = shuffleArray(data.map(([r, c]) => ({ char: c, romaji: r }))).slice(0, 20);
    setPracticeItems(items);
    setPracticeIdx(0);
    setPracticeAnswer('');
    setPracticeResult('none');
    setPracticeScore({ correct: 0, total: 0 });
    setMode('practice');
  }

  function checkPractice() {
    const item = practiceItems[practiceIdx];
    const correct = practiceAnswer.toLowerCase().trim() === item.romaji.toLowerCase();
    setPracticeResult(correct ? 'correct' : 'wrong');
    setPracticeScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
  }

  function nextPractice() {
    if (practiceIdx + 1 >= practiceItems.length) {
      setMode('chart');
      return;
    }
    setPracticeIdx(prev => prev + 1);
    setPracticeAnswer('');
    setPracticeResult('none');
  }

  // Vocab builder
  function startVocab() {
    const all = [...COMMON_VOCAB, ...customVocab];
    setVocabItems(shuffleArray(all));
    setVocabIdx(0);
    setVocabShowAnswer(false);
    setVocabScore({ correct: 0, total: 0 });
    setMode('vocab');
  }

  function addCustomVocab() {
    if (!newJp.trim() || !newEn.trim()) return;
    const updated = [...customVocab, { jp: newJp.trim(), reading: newReading.trim(), en: newEn.trim() }];
    setCustomVocab(updated);
    localStorage.setItem('nousai-jp-vocab', JSON.stringify(updated));
    setNewJp('');
    setNewReading('');
    setNewEn('');
  }

  // ── Chart / Home view ──
  if (mode === 'chart') {
    return (
      <div>
        {/* Kana type selector */}
        <div className="flex gap-2 mb-3">
          {(['hiragana', 'katakana', 'kanji'] as const).map(t => (
            <button key={t} className={`btn btn-sm ${studyType === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStudyType(t)} style={{ flex: 1, fontSize: 11, textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {score.total > 0 && (
          <div className="text-sm mb-2" style={{ fontWeight: 600 }}>
            Last quiz: {score.correct}/{score.total} ({Math.round((score.correct / score.total) * 100)}%)
          </div>
        )}

        {/* Clickable Character Chart */}
        {studyType !== 'kanji' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 4, marginBottom: 12,
          }}>
            {(studyType === 'hiragana' ? HIRAGANA : KATAKANA).map(([r, c]) => (
              <div key={r}
                onClick={() => handleChartClick(r, c)}
                style={{
                  textAlign: 'center', padding: '8px 4px',
                  background: 'var(--bg-primary)', borderRadius: 4,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{c}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{r}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 4, marginBottom: 12,
          }}>
            {COMMON_KANJI.map(([k, r, m]) => (
              <div key={k} style={{
                textAlign: 'center', padding: '8px 4px',
                background: 'var(--bg-primary)', borderRadius: 4,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{k}</div>
                <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{r}</div>
                <div style={{ fontSize: 8, color: 'var(--accent-light)' }}>{m}</div>
              </div>
            ))}
          </div>
        )}

        {/* Converter output preview */}
        {converterOutput && (
          <div style={{
            ...cardStyle, background: 'var(--bg-primary)', padding: 10,
            marginBottom: 8, textAlign: 'center',
          }}>
            <div className="text-xs text-muted mb-1">Clicked characters:</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{converterOutput}</div>
            <button
              className="btn btn-secondary btn-sm mt-1"
              onClick={() => { setConverterInput(''); setConverterOutput(''); }}
              style={{ fontSize: 9, padding: '2px 8px' }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary w-full" onClick={startQuiz}>
            <Play size={14} /> Quiz Me (15 questions)
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button className="btn btn-secondary w-full" onClick={() => setMode('converter')} style={{ fontSize: 11 }}>
              <BookOpenCheck size={12} /> Romaji IME
            </button>
            <button className="btn btn-secondary w-full" onClick={startPractice} style={{ fontSize: 11 }}>
              <Brain size={12} /> Practice
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button className="btn btn-secondary w-full" onClick={() => setMode('grammar')} style={{ fontSize: 11 }}>
              <BookOpen size={12} /> Grammar
            </button>
            <button className="btn btn-secondary w-full" onClick={() => {
              const shuffled = shuffleArray([...SENTENCE_PAIRS]).slice(0, 10);
              setSentPairs(shuffled);
              setSentIdx(0);
              setSentSelected(null);
              setSentScore({ correct: 0, total: 0 });
              setMode('sentences');
            }} style={{ fontSize: 11 }}>
              <Layers size={12} /> Sentences
            </button>
          </div>
          <button className="btn btn-secondary w-full" onClick={() => setMode('vocab')} style={{ fontSize: 11 }}>
            <BookOpen size={12} /> Vocabulary ({COMMON_VOCAB.length + customVocab.length} words)
          </button>
        </div>
      </div>
    );
  }

  // ── Romaji-to-Kana Converter ──
  if (mode === 'converter') {
    return (
      <div>
        <BackBtn onClick={() => setMode('chart')} />
        <div style={{
          fontWeight: 800, fontSize: 13, letterSpacing: 1,
          color: '#888', marginBottom: 8, textTransform: 'uppercase',
        }}>
          ROMAJI TO KANA CONVERTER
        </div>
        <p className="text-xs text-muted mb-3">
          Type romaji and it will be automatically converted to hiragana or katakana.
        </p>

        <div className="flex gap-2 mb-3">
          {(['hiragana', 'katakana'] as const).map(t => (
            <button key={t} className={`btn btn-sm ${converterTarget === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setConverterTarget(t); handleConverterInput(converterInput); }}
              style={{ flex: 1, fontSize: 11, textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        <textarea
          value={converterInput}
          onChange={e => handleConverterInput(e.target.value)}
          placeholder="Type romaji here (e.g., konnichiwa, arigatou)..."
          rows={3}
          style={textareaStyle}
        />

        {converterOutput && (
          <div style={{
            ...cardStyle, background: 'var(--bg-primary)', marginTop: 8, padding: 16,
            textAlign: 'center',
          }}>
            <div className="text-xs text-muted mb-2">{converterTarget === 'hiragana' ? 'Hiragana' : 'Katakana'} Output:</div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.6, wordBreak: 'break-all' }}>
              {converterOutput}
            </div>
            <div className="flex gap-2 mt-2" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(converterOutput)}>
                Copy
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setConverterInput(''); setConverterOutput(''); }}>
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Quick reference mini-chart */}
        <div style={{ marginTop: 12 }}>
          <div className="text-xs" style={{ fontWeight: 700, color: '#888', marginBottom: 6 }}>QUICK REFERENCE</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 2, maxHeight: 160, overflowY: 'auto',
          }}>
            {(converterTarget === 'hiragana' ? HIRAGANA : KATAKANA).map(([r, c]) => (
              <div key={r}
                onClick={() => handleConverterInput(converterInput + r)}
                style={{
                  textAlign: 'center', padding: '4px 2px',
                  background: 'var(--bg-primary)', borderRadius: 3,
                  border: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 700,
                }}
                title={r}
              >
                {c}
                <div style={{ fontSize: 7, color: 'var(--text-muted)' }}>{r}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Practice Mode: Show kana, user types romaji ──
  if (mode === 'practice') {
    if (practiceItems.length === 0) {
      return (
        <div>
          <BackBtn onClick={() => setMode('chart')} />
          <p className="text-sm text-muted mb-3">
            Kana will be shown and you type the romaji reading. Choose your kana type:
          </p>
          <div className="flex gap-2 mb-3">
            {(['hiragana', 'katakana'] as const).map(t => (
              <button key={t} className={`btn btn-sm ${practiceKanaType === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPracticeKanaType(t)}
                style={{ flex: 1, fontSize: 11, textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
          <button className="btn btn-primary w-full" onClick={startPractice}>
            <Play size={14} /> Start Practice (20 characters)
          </button>
        </div>
      );
    }

    const pItem = practiceItems[practiceIdx];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <button className="btn btn-secondary btn-sm" onClick={() => { setMode('chart'); setPracticeItems([]); }}
            style={{ fontSize: 10, padding: '2px 8px' }}>
            <ChevronLeft size={12} /> Back
          </button>
          <span className="text-xs" style={{ fontWeight: 600 }}>{practiceIdx + 1}/{practiceItems.length}</span>
          <span className="text-xs">
            <CheckCircle size={10} style={{ color: 'var(--green)' }} /> {practiceScore.correct}/{practiceScore.total}
          </span>
        </div>
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{
            width: `${((practiceIdx + 1) / practiceItems.length) * 100}%`,
            background: 'var(--accent)',
          }} />
        </div>

        <div style={{ ...cardStyle, background: 'var(--bg-primary)', textAlign: 'center', padding: 28, marginBottom: 12 }}>
          <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 4 }}>{pItem.char}</div>
          <div className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>{practiceKanaType}</div>
        </div>

        {practiceResult === 'none' ? (
          <form onSubmit={e => { e.preventDefault(); checkPractice(); }}>
            <div className="flex gap-2">
              <input type="text" value={practiceAnswer} onChange={e => setPracticeAnswer(e.target.value)}
                placeholder="Type romaji..."
                style={{ ...inputStyle, flex: 1 }} autoFocus
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={!practiceAnswer.trim()}>
                <CheckCircle size={14} />
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{
              ...cardStyle, padding: 12, marginBottom: 8,
              borderColor: practiceResult === 'correct' ? 'var(--green)' : 'var(--red)',
              borderWidth: 2,
              background: practiceResult === 'correct' ? 'var(--green-dim)' : 'var(--red-dim)',
            }}>
              <div className="flex items-center gap-2">
                {practiceResult === 'correct'
                  ? <CheckCircle size={16} style={{ color: 'var(--green)' }} />
                  : <XCircle size={16} style={{ color: 'var(--red)' }} />
                }
                <span style={{ fontWeight: 700, color: practiceResult === 'correct' ? 'var(--green)' : 'var(--red)' }}>
                  {practiceResult === 'correct' ? 'Correct!' : 'Incorrect'}
                </span>
              </div>
              {practiceResult === 'wrong' && (
                <div className="text-sm" style={{ marginTop: 4 }}>
                  Answer: <strong style={{ color: 'var(--green)' }}>{pItem.romaji}</strong>
                </div>
              )}
            </div>
            <button className="btn btn-primary w-full" onClick={nextPractice}>
              <ArrowRight size={14} /> {practiceIdx + 1 >= practiceItems.length ? 'Finish' : 'Next'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Vocabulary Builder ──
  if (mode === 'vocab') {
    if (vocabItems.length === 0 || vocabIdx >= vocabItems.length) {
      return (
        <div>
          <BackBtn onClick={() => { setMode('chart'); setVocabItems([]); }} />
          <div style={{
            fontWeight: 800, fontSize: 13, letterSpacing: 1,
            color: '#888', marginBottom: 8, textTransform: 'uppercase',
          }}>
            VOCABULARY BUILDER
          </div>
          <p className="text-xs text-muted mb-3">
            Learn common Japanese words and phrases. Add your own words too.
          </p>

          {vocabScore.total > 0 && (
            <div className="text-sm mb-3" style={{ fontWeight: 600 }}>
              Last session: {vocabScore.correct}/{vocabScore.total} ({Math.round((vocabScore.correct / vocabScore.total) * 100)}%)
            </div>
          )}

          {/* Add custom vocab */}
          <div style={{ ...cardStyle, background: 'var(--bg-primary)', padding: 12, marginBottom: 10 }}>
            <div className="text-xs" style={{ fontWeight: 700, marginBottom: 8, color: '#888' }}>ADD WORD</div>
            <input type="text" value={newJp} onChange={e => setNewJp(e.target.value)}
              placeholder="Japanese (e.g., \u732B)" style={{ ...inputStyle, marginBottom: 4, fontSize: 12, padding: '6px 10px' }} />
            <input type="text" value={newReading} onChange={e => setNewReading(e.target.value)}
              placeholder="Reading (e.g., neko)" style={{ ...inputStyle, marginBottom: 4, fontSize: 12, padding: '6px 10px' }} />
            <input type="text" value={newEn} onChange={e => setNewEn(e.target.value)}
              placeholder="English (e.g., cat)" style={{ ...inputStyle, marginBottom: 6, fontSize: 12, padding: '6px 10px' }} />
            <button className="btn btn-primary btn-sm w-full" onClick={addCustomVocab} disabled={!newJp.trim() || !newEn.trim()}>
              <Plus size={12} /> Add Word
            </button>
          </div>

          {/* Word list */}
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
            {[...COMMON_VOCAB, ...customVocab].map((v, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12,
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{v.jp}</span>
                  {v.reading && <span className="text-muted" style={{ marginLeft: 6, fontSize: 10 }}>({v.reading})</span>}
                </div>
                <span className="text-muted">{v.en}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary w-full" onClick={startVocab}>
            <Play size={14} /> Practice Vocabulary ({COMMON_VOCAB.length + customVocab.length} words)
          </button>
        </div>
      );
    }

    // Vocab flashcard review
    const vItem = vocabItems[vocabIdx];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <button className="btn btn-secondary btn-sm" onClick={() => { setMode('chart'); setVocabItems([]); }}
            style={{ fontSize: 10, padding: '2px 8px' }}>
            <ChevronLeft size={12} /> Back
          </button>
          <span className="text-xs" style={{ fontWeight: 600 }}>{vocabIdx + 1}/{vocabItems.length}</span>
          <span className="text-xs">
            <CheckCircle size={10} style={{ color: 'var(--green)' }} /> {vocabScore.correct}/{vocabScore.total}
          </span>
        </div>
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{
            width: `${((vocabIdx + 1) / vocabItems.length) * 100}%`,
            background: 'var(--accent)',
          }} />
        </div>

        <div style={{ ...cardStyle, background: 'var(--bg-primary)', textAlign: 'center', padding: 24, marginBottom: 12 }}>
          <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 4 }}>{vItem.jp}</div>
          {vItem.reading && <div className="text-xs text-muted">{vItem.reading}</div>}
          <button onClick={() => speakJapanese(vItem.jp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', padding: 4, marginTop: 4 }} title="Listen">
            <Volume2 size={18} />
          </button>
        </div>

        {!vocabShowAnswer ? (
          <button className="btn btn-secondary w-full" onClick={() => setVocabShowAnswer(true)}>
            <Eye size={14} /> Show Meaning
          </button>
        ) : (
          <div>
            <div style={{ ...cardStyle, background: 'var(--accent-glow)', marginBottom: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{vItem.en}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => {
                setVocabScore(prev => ({ ...prev, total: prev.total + 1 }));
                setVocabShowAnswer(false);
                setVocabIdx(prev => prev + 1);
              }} style={{ flex: 1, color: 'var(--red)' }}>
                <XCircle size={14} /> Didn't Know
              </button>
              <button className="btn btn-primary" onClick={() => {
                setVocabScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
                setVocabShowAnswer(false);
                setVocabIdx(prev => prev + 1);
              }} style={{ flex: 1 }}>
                <CheckCircle size={14} /> Knew It
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Grammar Lessons ──
  if (mode === 'grammar') {
    const lesson = GRAMMAR_LESSONS[grammarIdx];
    return (
      <div>
        <BackBtn onClick={() => setMode('chart')} />
        <div style={{
          fontWeight: 800, fontSize: 13, letterSpacing: 1,
          color: '#888', marginBottom: 8, textTransform: 'uppercase',
        }}>
          GRAMMAR LESSONS ({grammarIdx + 1}/{GRAMMAR_LESSONS.length})
        </div>

        <div style={{ ...cardStyle, marginBottom: 12, padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: 'var(--accent-light)' }}>
            {lesson.title}
          </div>
          <div style={{
            background: 'var(--bg-primary)', borderRadius: 6, padding: '8px 12px',
            marginBottom: 10, fontFamily: 'monospace', fontSize: 16, fontWeight: 600,
            textAlign: 'center', border: '1px solid var(--border)',
          }}>
            {lesson.pattern}
          </div>
          <p className="text-sm" style={{ lineHeight: 1.7, marginBottom: 12 }}>
            {lesson.explanation}
          </p>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>
            Examples
          </div>
          {lesson.examples.map((ex, i) => (
            <div key={i} style={{
              ...cardStyle, background: 'var(--bg-primary)', padding: 10, marginBottom: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{ex.jp}</div>
                <div className="text-xs text-muted">{ex.en}</div>
              </div>
              <button
                onClick={() => speakJapanese(ex.jp)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', padding: 4 }}
                title="Listen"
              >
                <Volume2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button className="btn btn-secondary" style={{ flex: 1 }}
            onClick={() => setGrammarIdx(Math.max(0, grammarIdx - 1))}
            disabled={grammarIdx === 0}>
            <ChevronLeft size={14} /> Previous
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={() => {
              if (grammarIdx + 1 >= GRAMMAR_LESSONS.length) { setMode('chart'); }
              else setGrammarIdx(grammarIdx + 1);
            }}>
            {grammarIdx + 1 >= GRAMMAR_LESSONS.length ? 'Finish' : 'Next'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── Sentence Matching Mode ──
  if (mode === 'sentences') {
    if (sentPairs.length === 0 || sentIdx >= sentPairs.length) {
      return (
        <div>
          <BackBtn onClick={() => setMode('chart')} />
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Trophy size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Complete!</div>
            <div className="text-sm text-muted mb-3">
              Score: {sentScore.correct}/{sentScore.total} ({sentScore.total > 0 ? Math.round((sentScore.correct / sentScore.total) * 100) : 0}%)
            </div>
            <button className="btn btn-primary" onClick={() => {
              const shuffled = shuffleArray([...SENTENCE_PAIRS]).slice(0, 10);
              setSentPairs(shuffled);
              setSentIdx(0);
              setSentSelected(null);
              setSentScore({ correct: 0, total: 0 });
            }}>
              <RotateCcw size={14} /> Play Again
            </button>
          </div>
        </div>
      );
    }

    const pair = sentPairs[sentIdx];
    // Generate options (correct + 3 random wrong)
    if (sentOptions.length === 0 || sentSelected === null) {
      const wrong = SENTENCE_PAIRS
        .filter(p => p.en !== pair.en)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(p => p.en);
      const opts = shuffleArray([pair.en, ...wrong]);
      if (sentOptions.join('|') !== opts.join('|')) {
        // Only set if actually different to avoid re-render loop
        setTimeout(() => setSentOptions(opts), 0);
      }
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <button className="btn btn-secondary btn-sm" onClick={() => { setMode('chart'); setSentPairs([]); }}
            style={{ fontSize: 10, padding: '2px 8px' }}>
            <ChevronLeft size={12} /> Back
          </button>
          <span className="text-xs" style={{ fontWeight: 600 }}>{sentIdx + 1}/{sentPairs.length}</span>
          <span className="text-xs">
            <CheckCircle size={10} style={{ color: 'var(--green)' }} /> {sentScore.correct}/{sentScore.total}
          </span>
        </div>
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{
            width: `${((sentIdx + 1) / sentPairs.length) * 100}%`,
            background: 'var(--accent)',
          }} />
        </div>

        <div style={{
          fontWeight: 800, fontSize: 11, letterSpacing: 1,
          color: '#888', marginBottom: 8, textTransform: 'uppercase',
        }}>
          MATCH THE SENTENCE
        </div>

        <div style={{
          ...cardStyle, background: 'var(--bg-primary)', textAlign: 'center',
          padding: 20, marginBottom: 12,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{pair.jp}</div>
          <button
            onClick={() => speakJapanese(pair.jp)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', padding: 4 }}
            title="Listen"
          >
            <Volume2 size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sentOptions.map(opt => {
            const isCorrect = opt === pair.en;
            const chosen = sentSelected !== null;
            const isChosen = sentSelected === opt;
            let bg = 'var(--bg-card)';
            let borderColor = 'var(--border)';
            if (chosen && isCorrect) { bg = 'var(--green-dim)'; borderColor = 'var(--green)'; }
            else if (chosen && isChosen && !isCorrect) { bg = 'var(--red-dim)'; borderColor = 'var(--red)'; }

            return (
              <button
                key={opt}
                disabled={chosen}
                onClick={() => {
                  setSentSelected(opt);
                  setSentScore(prev => ({
                    correct: prev.correct + (isCorrect ? 1 : 0),
                    total: prev.total + 1,
                  }));
                }}
                style={{
                  ...cardStyle, background: bg, borderColor, borderWidth: chosen && (isCorrect || isChosen) ? 2 : 1,
                  padding: '10px 14px', cursor: chosen ? 'default' : 'pointer',
                  textAlign: 'left', fontSize: 13, fontWeight: 500,
                  fontFamily: 'inherit', color: 'var(--text-primary)',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {sentSelected !== null && (
          <button className="btn btn-primary w-full mt-3" onClick={() => {
            setSentIdx(prev => prev + 1);
            setSentSelected(null);
            setSentOptions([]);
          }}>
            <ArrowRight size={14} /> {sentIdx + 1 >= sentPairs.length ? 'See Results' : 'Next'}
          </button>
        )}
      </div>
    );
  }

  // ── Quiz mode (original) ──
  const item = quizItems[currentIdx];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ fontWeight: 600 }}>{currentIdx + 1}/{quizItems.length}</span>
        <span className="text-xs">
          <CheckCircle size={10} style={{ color: 'var(--green)' }} /> {score.correct}/{score.total}
        </span>
      </div>
      <div className="progress-bar mb-3">
        <div className="progress-fill" style={{ width: `${((currentIdx + 1) / quizItems.length) * 100}%`, background: 'var(--accent)' }} />
      </div>

      <div style={{ ...cardStyle, background: 'var(--bg-primary)', textAlign: 'center', padding: 24, marginBottom: 12 }}>
        <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 4 }}>{item.char}</div>
        {item.meaning && <div className="text-xs text-muted">{item.meaning}</div>}
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>{studyType}</span>
          <button onClick={() => speakJapanese(item.char)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', padding: 2 }} title="Listen">
            <Volume2 size={14} />
          </button>
        </div>
      </div>

      {!showFeedback ? (
        <form onSubmit={e => { e.preventDefault(); checkAnswer(); }}>
          <div className="flex gap-2">
            <input type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
              placeholder="Type romaji reading..."
              style={{ ...inputStyle, flex: 1 }} autoFocus
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={!userAnswer.trim()}>
              <CheckCircle size={14} />
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div style={{
            ...cardStyle, padding: 12, marginBottom: 8,
            borderColor: isCorrect ? 'var(--green)' : 'var(--red)',
            borderWidth: 2,
            background: isCorrect ? 'var(--green-dim)' : 'var(--red-dim)',
          }}>
            <div className="flex items-center gap-2">
              {isCorrect ? <CheckCircle size={16} style={{ color: 'var(--green)' }} /> : <XCircle size={16} style={{ color: 'var(--red)' }} />}
              <span style={{ fontWeight: 700, color: isCorrect ? 'var(--green)' : 'var(--red)' }}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
            </div>
            {!isCorrect && (
              <div className="text-sm" style={{ marginTop: 4 }}>
                Answer: <strong style={{ color: 'var(--green)' }}>{item.romaji}</strong>
              </div>
            )}
          </div>
          <button className="btn btn-primary w-full" onClick={nextItem}>
            <ArrowRight size={14} /> {currentIdx + 1 >= quizItems.length ? 'Finish' : 'Next'}
          </button>
        </div>
      )}

      <button className="btn btn-secondary btn-sm mt-2 w-full" onClick={() => setMode('chart')}
        style={{ fontSize: 10 }}>
        Back to Chart
      </button>
    </div>
  );
}

export default JapaneseMode;
