/**
 * Tools Page — TTS, Dictation, Speed Read, Oral Quiz & more
 * Browser/PWA-powered study tools
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Volume2, VolumeX, Mic, MicOff, Zap, BookOpen,
  Play, Square, Settings2, Globe, PenTool, FileText,
  Sparkles, Brain, MessageSquare, ChevronDown, Upload,
  Calculator, FlaskConical, Layers, Code2,
} from 'lucide-react';
import { callAI, isAIConfigured } from '../utils/ai';
import {
  speak, stopSpeaking, isSpeaking, isTTSAvailable,
  readFlashcard, speedRead, getVoices,
  startDictation, stopDictation, isSTTAvailable, isDictating,
  oralQuiz,
  getTTSPrefs, saveTTSPrefs,
} from '../utils/speechTools';
import { useStore } from '../store';
import {
  getTranscribeState, subscribeToTranscribe,
  startTranscribeRecording, stopTranscribeRecording, clearTranscribeSession, getAnalyser,
  transcribeFile,
  type TranscribeState,
} from '../utils/transcribeStore';

type ToolView = 'menu' | 'tts' | 'dictation' | 'speedread' | 'oralquiz' | 'summarizer' | 'notepad' | 'transcribe' | 'converter' | 'matrix' | 'graph' | 'chem' | 'solver' | 'codesandbox';

export default function ToolsPage() {
  const { loaded } = useStore();
  // Auto-open transcribe view if a recording is already in progress
  const [view, setView] = useState<ToolView>(() =>
    getTranscribeState().isRecording ? 'transcribe' : 'menu'
  );

  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading tools...</div>
      </div>
    );
  }

  if (view === 'menu') return <ToolsMenu onSelect={setView} />;
  if (view === 'tts') return <TTSTool onBack={() => setView('menu')} />;
  if (view === 'dictation') return <DictationTool onBack={() => setView('menu')} />;
  if (view === 'speedread') return <SpeedReadTool onBack={() => setView('menu')} />;
  if (view === 'oralquiz') return <OralQuizTool onBack={() => setView('menu')} />;
  if (view === 'notepad') return <NotepadTool onBack={() => setView('menu')} />;
  if (view === 'summarizer') return <SummarizerTool onBack={() => setView('menu')} />;
  if (view === 'transcribe') return <TranscribeTool onBack={() => setView('menu')} />;
  if (view === 'converter') return <UnitConverter onBack={() => setView('menu')} />;
  if (view === 'matrix') return <MatrixCalc onBack={() => setView('menu')} />;
  if (view === 'graph') return <GraphCalc onBack={() => setView('menu')} />;
  if (view === 'chem') return <ChemTool onBack={() => setView('menu')} />;
  if (view === 'solver') return <SolverTool onBack={() => setView('menu')} />;
  if (view === 'codesandbox') return <CodeSandbox onBack={() => setView('menu')} />;
  return <ToolsMenu onSelect={setView} />;
}

function ToolsMenu({ onSelect }: { onSelect: (v: ToolView) => void }) {
  const tools = [
    { id: 'tts' as ToolView, icon: Volume2, name: 'Text-to-Speech', desc: 'Read notes, flashcards & questions aloud', color: '#6366f1' },
    { id: 'dictation' as ToolView, icon: Mic, name: 'Dictation', desc: 'Voice-to-text for notes and answers', color: '#10b981' },
    { id: 'speedread' as ToolView, icon: Zap, name: 'Speed Reader', desc: 'Rapid serial visual presentation (RSVP)', color: '#f59e0b' },
    { id: 'oralquiz' as ToolView, icon: MessageSquare, name: 'Oral Quiz', desc: 'Speak answers — hands-free study mode', color: '#ec4899' },
    { id: 'notepad' as ToolView, icon: PenTool, name: 'Quick Notes', desc: 'Scratch pad with voice input support', color: '#8b5cf6' },
    { id: 'summarizer' as ToolView, icon: Sparkles, name: 'AI Summarizer', desc: 'Paste text → get key points instantly', color: '#06b6d4' },
    { id: 'transcribe' as ToolView, icon: Mic, name: 'Transcribe', desc: 'Record audio → live transcription. Supports English & Japanese', color: '#0891b2' },
    { id: 'converter' as ToolView, icon: Globe, name: 'Unit Converter', desc: 'Length, mass, temperature, time & volume', color: '#14b8a6' },
    { id: 'matrix' as ToolView, icon: BookOpen, name: 'Matrix Calculator', desc: 'Determinant, inverse, transpose & multiply', color: '#f97316' },
    { id: 'graph' as ToolView, icon: Calculator, name: 'Graph Calculator', desc: 'Plot functions on a canvas — y = x² + 2x', color: '#7c3aed' },
    { id: 'chem' as ToolView, icon: FlaskConical, name: 'Chemistry', desc: 'Render chemical formulas with KaTeX mhchem', color: '#059669' },
    { id: 'solver' as ToolView, icon: Layers, name: 'Step Solver', desc: 'AI step-by-step problem solving', color: '#dc2626' },
    { id: 'codesandbox' as ToolView, icon: Code2, name: 'Code Sandbox', desc: 'Run JavaScript in the browser', color: '#0ea5e9' },
  ];

  return (
    <div className="animate-in">
      <h1 className="page-title">Study Tools</h1>
      <p className="page-subtitle">Power tools for fast, deep learning</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {tools.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="card"
            style={{
              cursor: 'pointer', textAlign: 'left', border: 'none',
              background: 'var(--bg-secondary)', padding: 16,
              transition: 'transform 0.15s',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: t.color + '22', color: t.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 8,
            }}>
              <t.icon size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t.name}</div>
            <div className="text-xs text-muted">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Study Tips */}
      <div className="card mt-4" style={{ background: 'var(--bg-secondary)' }}>
        <div className="card-title mb-2"><Brain size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Study Accelerator Tips</div>
        <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 2 }}>
          <li><strong>Active recall</strong> — Test yourself instead of re-reading. Use Study → Adaptive mode.</li>
          <li><strong>Spaced repetition</strong> — Review flashcards when they're due, not all at once.</li>
          <li><strong>Interleaving</strong> — Mix subjects in a study session for deeper connections.</li>
          <li><strong>Speed read</strong> → then <strong>Oral quiz</strong> for rapid comprehension + retention.</li>
          <li><strong>Pomodoro</strong> — 25min focus + 5min break. Your brain consolidates during rest.</li>
          <li><strong>Teach it</strong> — Explain concepts aloud using TTS + Dictation as your study buddy.</li>
          <li><strong>Transcribe</strong> — Record lectures or speak your notes aloud for instant text capture in English or Japanese. Keeps recording even if you switch pages.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Back Button ────────────────────────────────────
function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="btn btn-sm btn-secondary mb-3" style={{ gap: 4 }}>
      <ChevronDown size={14} style={{ transform: 'rotate(90deg)' }} /> Back
    </button>
  );
}

// ─── TTS Tool ───────────────────────────────────────
function TTSTool({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [text, setText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(() => getTTSPrefs().rate || 1.0);
  const [lang, setLang] = useState(() => getTTSPrefs().voiceLang || 'en-US');
  const available = isTTSAvailable();

  function handleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (text.trim()) {
      setSpeaking(true);
      saveTTSPrefs({ rate, voiceLang: lang });
      speak(text, { rate, voiceLang: lang }, () => setSpeaking(false));
    }
  }

  function handleReadCards() {
    const allCards = courses.flatMap(c => c.flashcards || []);
    if (allCards.length === 0) return;
    const shuffled = [...allCards].sort(() => Math.random() - 0.5).slice(0, 10);
    setSpeaking(true);
    let i = 0;
    function readNext() {
      if (i >= shuffled.length) { setSpeaking(false); return; }
      const card = shuffled[i];
      readFlashcard(card.front, card.back, lang).then(() => { i++; readNext(); });
    }
    readNext();
  }

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><Volume2 size={20} style={{ verticalAlign: 'middle' }} /> Text-to-Speech</h1>

      {!available && (
        <div className="card mb-3" style={{ borderColor: 'var(--red)', borderWidth: 1 }}>
          <p className="text-sm" style={{ color: 'var(--red)' }}>TTS is not supported in this browser.</p>
        </div>
      )}

      <div className="card mb-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste or type text to read aloud..."
          rows={6}
          style={{
            width: '100%', padding: 12, border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="text-xs text-muted">Speed:</label>
          <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={e => setRate(parseFloat(e.target.value))}
            style={{ flex: 1, minWidth: 80 }}
          />
          <span className="text-xs" style={{ fontWeight: 700, minWidth: 30 }}>{rate}x</span>
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}>
            <option value="en-US">English</option>
            <option value="ja-JP">Japanese</option>
            <option value="es-ES">Spanish</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
            <option value="zh-CN">Chinese</option>
            <option value="ko-KR">Korean</option>
          </select>
        </div>
        <div className="flex gap-2 mt-3">
          <button className={`btn ${speaking ? 'btn-secondary' : 'btn-primary'}`} onClick={handleSpeak} style={{ flex: 1 }}>
            {speaking ? <><Square size={14} /> Stop</> : <><Play size={14} /> Read Aloud</>}
          </button>
        </div>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={handleReadCards} disabled={speaking || courses.flatMap(c => c.flashcards || []).length === 0} style={{ width: '100%' }}>
        <BookOpen size={14} /> Read 10 Random Flashcards Aloud
      </button>
      {courses.flatMap(c => c.flashcards || []).length === 0 && (
        <p className="text-xs text-muted" style={{ marginTop: 6, textAlign: 'center' }}>No flashcards available. Import data to use this feature.</p>
      )}
    </div>
  );
}

// ─── Dictation Tool ─────────────────────────────────
function DictationTool({ onBack }: { onBack: () => void }) {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const available = isSTTAvailable();

  function toggleListen() {
    if (listening) {
      stopDictation();
      setListening(false);
      setInterim('');
    } else {
      setListening(true);
      startDictation({
        onResult: (text, isFinal) => {
          if (isFinal) {
            setTranscript(prev => prev + (prev ? ' ' : '') + text);
            setInterim('');
          } else {
            setInterim(text);
          }
        },
        onEnd: () => setListening(false),
        onError: () => setListening(false),
      }, { continuous: true, interimResults: true });
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(transcript);
  }

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><Mic size={20} style={{ verticalAlign: 'middle' }} /> Dictation</h1>

      {!available && (
        <div className="card mb-3" style={{ borderColor: 'var(--red)', borderWidth: 1 }}>
          <p className="text-sm" style={{ color: 'var(--red)' }}>Speech recognition not supported. Try Chrome or Edge.</p>
        </div>
      )}

      <div className="card mb-3">
        <div style={{
          minHeight: 120, padding: 12, border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
          fontSize: 14, lineHeight: 1.6,
        }}>
          {transcript || <span className="text-muted">Start speaking...</span>}
          {interim && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> {interim}</span>}
        </div>
        <div className="flex gap-2 mt-3">
          <button className={`btn ${listening ? 'btn-primary' : 'btn-secondary'}`} onClick={toggleListen} style={{ flex: 1 }}>
            {listening ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Start Listening</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleCopy} disabled={!transcript}>Copy</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setTranscript('')}>Clear</button>
        </div>
      </div>

      {listening && (
        <div className="text-center text-sm" style={{ color: 'var(--green)' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', marginRight: 6, animation: 'pulse 1s infinite' }} />
          Listening...
        </div>
      )}
    </div>
  );
}

// ─── Speed Reader (RSVP) ────────────────────────────
function SpeedReadTool({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('');
  const [wpm, setWpm] = useState(300);
  const [running, setRunning] = useState(false);
  const [currentWord, setCurrentWord] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const timerRef = useRef<number>(0);

  function startReading() {
    const words = text.trim().split(/\s+/);
    if (words.length === 0) return;
    setRunning(true);
    setWordIdx(0);
    const interval = 60000 / wpm;
    let idx = 0;

    function showNext() {
      if (idx >= words.length) {
        setRunning(false);
        setCurrentWord('Done!');
        return;
      }
      setCurrentWord(words[idx]);
      setWordIdx(idx);
      idx++;
      timerRef.current = window.setTimeout(showNext, interval);
    }
    showNext();
  }

  function stopReading() {
    clearTimeout(timerRef.current);
    setRunning(false);
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  const progress = words.length > 0 ? ((wordIdx + 1) / words.length) * 100 : 0;

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><Zap size={20} style={{ verticalAlign: 'middle' }} /> Speed Reader</h1>
      <p className="page-subtitle">RSVP — Rapid Serial Visual Presentation</p>

      {!running ? (
        <div className="card mb-3">
          <textarea
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Paste study material here..."
            rows={6}
            style={{
              width: '100%', padding: 12, border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-muted">WPM:</label>
            <input type="range" min={100} max={800} step={25} value={wpm} onChange={e => setWpm(parseInt(e.target.value))} style={{ flex: 1 }} />
            <span className="text-xs" style={{ fontWeight: 700, minWidth: 45 }}>{wpm} wpm</span>
          </div>
          <div className="text-xs text-muted mt-1">{words.length} words • ~{Math.ceil(words.length / wpm)} min read</div>
          <button className="btn btn-primary mt-3" onClick={startReading} disabled={!text.trim()} style={{ width: '100%' }}>
            <Play size={14} /> Start Speed Reading
          </button>
        </div>
      ) : (
        <div className="card mb-3 text-center" style={{ padding: 40 }}>
          <div className="progress-bar mb-3"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div style={{ fontSize: 40, fontWeight: 900, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentWord}
          </div>
          <div className="text-xs text-muted mt-2">{wordIdx + 1} / {words.length} • {wpm} WPM</div>
          <button className="btn btn-secondary mt-3" onClick={stopReading} style={{ width: '100%' }}>
            <Square size={14} /> Stop
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Oral Quiz Tool ─────────────────────────────────
function OralQuizTool({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [status, setStatus] = useState<'idle' | 'asking' | 'listening' | 'feedback'>('idle');
  const [currentQ, setCurrentQ] = useState('');
  const [currentA, setCurrentA] = useState('');
  const [spokenAnswer, setSpokenAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const allCards = courses.flatMap(c => (c.flashcards || []).map(f => ({ q: f.front, a: f.back })));

  function startOralQuiz() {
    if (allCards.length === 0) return;
    setScore({ correct: 0, total: 0 });
    askNext();
  }

  function askNext() {
    const card = allCards[Math.floor(Math.random() * allCards.length)];
    setCurrentQ(card.q);
    setCurrentA(card.a);
    setStatus('asking');
    setSpokenAnswer('');

    oralQuiz(card.q, (answer) => {
      setSpokenAnswer(answer);
      const correct = answer.toLowerCase().trim().includes(card.a.toLowerCase().trim().slice(0, 10));
      setIsCorrect(correct);
      setStatus('feedback');
      setScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));

      // Read feedback
      speak(correct ? 'Correct!' : `The answer is: ${card.a}`, { rate: 1.1 });
    }, 'en-US');
  }

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><MessageSquare size={20} style={{ verticalAlign: 'middle' }} /> Oral Quiz</h1>
      <p className="page-subtitle">Hands-free — listen & speak your answers</p>

      {status === 'idle' && (
        allCards.length === 0 ? (
          <div className="empty-state">
            <MessageSquare />
            <h3>No flashcards available</h3>
            <p>Import data or add flashcards to your courses to use Oral Quiz.</p>
          </div>
        ) : (
          <div className="card">
            <p className="text-sm text-muted mb-3">
              The app will read each flashcard question aloud, then listen for your spoken answer. Great for studying while walking, cooking, or exercising!
            </p>
            <p className="text-sm text-muted mb-3">{allCards.length} flashcards available</p>
            <button className="btn btn-primary" onClick={startOralQuiz} style={{ width: '100%' }}>
              <Play size={14} /> Start Oral Quiz
            </button>
          </div>
        )
      )}

      {(status === 'asking' || status === 'listening') && (
        <div className="card text-center" style={{ padding: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{currentQ}</div>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: status === 'listening' ? 'var(--green-dim)' : 'var(--accent-dim)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulse 1.5s infinite',
          }}>
            {status === 'asking' ? <Volume2 size={24} style={{ color: 'var(--accent)' }} /> : <Mic size={24} style={{ color: 'var(--green)' }} />}
          </div>
          <p className="text-sm text-muted mt-2">
            {status === 'asking' ? 'Reading question...' : 'Listening for your answer...'}
          </p>
        </div>
      )}

      {status === 'feedback' && (
        <div className="card" style={{ borderColor: isCorrect ? 'var(--green)' : 'var(--red)', borderWidth: 2 }}>
          <div className="text-center mb-3">
            <div style={{ fontSize: 36 }}>{isCorrect ? '✓' : '✗'}</div>
            <div style={{ fontWeight: 700, color: isCorrect ? 'var(--green)' : 'var(--red)' }}>
              {isCorrect ? 'Correct!' : 'Not quite'}
            </div>
          </div>
          <div className="text-sm mb-2"><strong>Q:</strong> {currentQ}</div>
          <div className="text-sm mb-2"><strong>Your answer:</strong> {spokenAnswer || '(no response)'}</div>
          {!isCorrect && <div className="text-sm mb-2"><strong>Correct:</strong> <span style={{ color: 'var(--green)' }}>{currentA}</span></div>}
          <div className="text-sm text-muted mb-3">Score: {score.correct}/{score.total}</div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={askNext} style={{ flex: 1 }}>Next Question</button>
            <button className="btn btn-secondary" onClick={() => { stopSpeaking(); stopDictation(); setStatus('idle'); }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Notepad ──────────────────────────────────
function NotepadTool({ onBack }: { onBack: () => void }) {
  const [notes, setNotes] = useState(() => localStorage.getItem('nousai-quicknotes') || '');
  const [listening, setListening] = useState(false);

  function save(text: string) {
    setNotes(text);
    localStorage.setItem('nousai-quicknotes', text);
  }

  function toggleDictation() {
    if (listening) {
      stopDictation();
      setListening(false);
    } else {
      setListening(true);
      startDictation({
        onResult: (text, isFinal) => {
          if (isFinal) {
            save(notes + (notes ? '\n' : '') + text);
          }
        },
        onEnd: () => setListening(false),
        onError: () => setListening(false),
      }, { continuous: true });
    }
  }

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><PenTool size={20} style={{ verticalAlign: 'middle' }} /> Quick Notes</h1>

      <div className="card mb-3">
        <textarea
          value={notes} onChange={e => save(e.target.value)}
          placeholder="Type or dictate notes..."
          rows={12}
          style={{
            width: '100%', padding: 12, border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
            fontFamily: 'inherit', outline: 'none', lineHeight: 1.7,
          }}
        />
        <div className="flex gap-2 mt-2">
          <button className={`btn btn-sm ${listening ? 'btn-primary' : 'btn-secondary'}`} onClick={toggleDictation} style={{ flex: 1 }}>
            {listening ? <><MicOff size={14} /> Stop Dictation</> : <><Mic size={14} /> Dictate</>}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => { speak(notes, { rate: 1.0 }); }}>
            <Volume2 size={14} /> Read Aloud
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => navigator.clipboard.writeText(notes)}>Copy</button>
        </div>
      </div>
      <p className="text-xs text-muted">Notes auto-save to local storage.</p>
    </div>
  );
}

// ─── Transcribe Tool ────────────────────────────────
function TranscribeTool({ onBack }: { onBack: () => void }) {
  const [tsState, setTsState] = useState<TranscribeState>(() => ({ ...getTranscribeState() }));
  const [language, setLanguage] = useState(() => getTranscribeState().language);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to transcribe store
  useEffect(() => {
    return subscribeToTranscribe(() => setTsState({ ...getTranscribeState() }));
  }, []);

  // Waveform animation
  useEffect(() => {
    if (!tsState.isRecording) {
      cancelAnimationFrame(animRef.current);
      const cv = canvasRef.current;
      if (cv) cv.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
      return;
    }
    const node = getAnalyser();
    const cv = canvasRef.current;
    if (!node || !cv) return;
    const ctx = cv.getContext('2d')!;
    const data = new Uint8Array(node.frequencyBinCount);

    function draw() {
      node!.getByteFrequencyData(data);
      ctx.clearRect(0, 0, cv!.width, cv!.height);
      const bars = 7;
      const bw = Math.floor((cv!.width - (bars - 1) * 3) / bars);
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor(i * data.length / bars)];
        const h = Math.max(4, (v / 255) * cv!.height);
        ctx.fillStyle = '#0891b2';
        ctx.fillRect(i * (bw + 3), (cv!.height - h) / 2, bw, h);
      }
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [tsState.isRecording]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tsState.transcript, tsState.chunks]);

  const { isRecording, transcript, chunks, autosaveStatus, error, noteTitle } = tsState;

  async function handleToggle() {
    if (isRecording) {
      stopTranscribeRecording();
    } else {
      await startTranscribeRecording(language);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-uploaded
    await transcribeFile(file);
  }

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><Mic size={20} style={{ verticalAlign: 'middle' }} /> Transcribe</h1>
      <p className="page-subtitle">Record audio → live transcription</p>

      {error && (
        <div className="card mb-3" style={{ borderColor: 'var(--red)', borderWidth: 1, borderStyle: 'solid' }}>
          <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      {/* Controls card */}
      <div className="card mb-3">
        {/* Language selector */}
        <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
          <Globe size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            disabled={isRecording}
            style={{
              flex: 1, padding: '5px 8px', border: '1px solid var(--border)',
              borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13,
            }}
          >
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="other">Other language</option>
          </select>
        </div>

        {/* Waveform */}
        <div style={{
          height: 48, marginBottom: 12, borderRadius: 8, overflow: 'hidden',
          background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isRecording
            ? <canvas ref={canvasRef} width={280} height={44} style={{ width: '100%', height: '100%' }} />
            : <span className="text-xs text-muted">Waveform appears here while recording</span>
          }
        </div>

        {/* Start / Stop button */}
        <button
          className={`btn ${isRecording ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleToggle}
          style={{ width: '100%', gap: 6, justifyContent: 'center' }}
        >
          {isRecording
            ? <><Square size={14} /> Stop Recording</>
            : <><Mic size={14} /> Start Recording 🎙</>
          }
        </button>

        {isRecording && (
          <p className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 8 }}>
            <span style={{ color: '#ef4444' }}>●</span> Recording · Navigating away will <strong>not</strong> stop it
          </p>
        )}

        {/* ── File upload ── */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.mp4,.m4a,.wav,.ogg,.webm,.flac,.mpeg"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="btn btn-secondary"
            style={{ width: '100%', gap: 6, justifyContent: 'center' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording || autosaveStatus === 'saving'}
          >
            <Upload size={14} />
            {autosaveStatus === 'saving' && !isRecording ? 'Processing file…' : 'Upload Audio / Video File'}
          </button>
          <p className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 5 }}>
            mp3 · mp4 · m4a · wav · ogg · webm · flac
          </p>
        </div>
      </div>

      {/* Transcript output */}
      <div className="card">
        <div className="flex gap-2 mb-2" style={{ alignItems: 'center' }}>
          <span className="text-xs text-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {noteTitle ? `📄 ${noteTitle}` : 'Transcript'}
          </span>
          <label style={{ display: 'flex', gap: 5, fontSize: 11, cursor: 'pointer', alignItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
            <input type="checkbox" checked={showTimestamps} onChange={e => setShowTimestamps(e.target.checked)} />
            Timestamps
          </label>
        </div>

        <div
          ref={transcriptRef}
          style={{
            minHeight: 120, maxHeight: 240, overflowY: 'auto', padding: 12,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-input)', fontSize: 14, lineHeight: 1.7,
          }}
        >
          {chunks.length === 0 ? (
            <span className="text-muted" style={{ fontStyle: 'italic', fontSize: 13 }}>
              {isRecording
                ? 'Listening… first words appear in a few seconds.'
                : 'Start recording to see transcription here.'}
            </span>
          ) : showTimestamps ? (
            chunks.map((c, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 8 }}>
                  [{new Date(c.timestamp).toLocaleTimeString()}]
                </span>
                <span>{c.text}</span>
              </div>
            ))
          ) : (
            <span>{transcript}</span>
          )}

          {autosaveStatus === 'saving' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>⏳ Processing audio…</div>
          )}
        </div>

        <div className="flex gap-2 mt-2" style={{ alignItems: 'center' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => navigator.clipboard.writeText(transcript)} disabled={!transcript}>
            Copy
          </button>
          <button className="btn btn-sm btn-secondary" onClick={clearTranscribeSession} disabled={isRecording}>
            Clear
          </button>
          {autosaveStatus === 'saved' && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
              ✓ Autosaved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Summarizer ──────────────────────────────────
function SummarizerTool({ onBack }: { onBack: () => void }) {
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  function summarize() {
    if (!input.trim()) return;
    setLoading(true);

    // Simple extractive summarization (no API needed)
    const sentences = input.match(/[^.!?]+[.!?]+/g) || [input];

    // Score sentences by importance (word frequency)
    const wordFreq: Record<string, number> = {};
    const words = input.toLowerCase().split(/\s+/);
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });

    const scored = sentences.map((s, i) => {
      const sWords = s.toLowerCase().split(/\s+/);
      const score = sWords.reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / sWords.length;
      // Boost first and last sentences
      const posBoost = i === 0 ? 1.5 : i === sentences.length - 1 ? 1.2 : 1;
      return { text: s.trim(), score: score * posBoost, idx: i };
    });

    // Take top 30% of sentences, keep original order
    const topCount = Math.max(2, Math.ceil(sentences.length * 0.3));
    const topSentences = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topCount)
      .sort((a, b) => a.idx - b.idx)
      .map(s => s.text);

    // Extract key terms
    const keyTerms = Object.entries(wordFreq)
      .filter(([w]) => w.length > 4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);

    const result = `📝 Summary (${topSentences.length} of ${sentences.length} sentences):\n\n${topSentences.join(' ')}\n\n🔑 Key Terms: ${keyTerms.join(', ')}`;

    setSummary(result);
    setLoading(false);
  }

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><Sparkles size={20} style={{ verticalAlign: 'middle' }} /> Summarizer</h1>
      <p className="page-subtitle">Extract key points from study material</p>

      <div className="card mb-3">
        <textarea
          value={input} onChange={e => setInput(e.target.value)}
          placeholder="Paste lecture notes, textbook passages, or any study material..."
          rows={6}
          style={{
            width: '100%', padding: 12, border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button className="btn btn-primary mt-2" onClick={summarize} disabled={loading || !input.trim()} style={{ width: '100%' }}>
          <Sparkles size={14} /> {loading ? 'Summarizing...' : 'Summarize'}
        </button>
      </div>

      {summary && (
        <div className="card">
          <pre style={{
            whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7,
            color: 'var(--text-primary)', fontFamily: 'inherit', margin: 0,
          }}>
            {summary}
          </pre>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-sm btn-secondary" onClick={() => navigator.clipboard.writeText(summary)}>Copy</button>
            <button className="btn btn-sm btn-secondary" onClick={() => speak(summary)}>
              <Volume2 size={14} /> Read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── #26 Unit Converter ─────────────────────────────
type UnitCategory = 'length' | 'mass' | 'temperature' | 'time' | 'volume';

const UNIT_DEFS: Record<UnitCategory, { label: string; units: { id: string; name: string; toBase: (v: number) => number; fromBase: (v: number) => number }[] }> = {
  length: {
    label: 'Length',
    units: [
      { id: 'mm', name: 'Millimeter (mm)', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { id: 'cm', name: 'Centimeter (cm)', toBase: v => v / 100, fromBase: v => v * 100 },
      { id: 'm', name: 'Meter (m)', toBase: v => v, fromBase: v => v },
      { id: 'km', name: 'Kilometer (km)', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { id: 'in', name: 'Inch (in)', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
      { id: 'ft', name: 'Foot (ft)', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
      { id: 'yd', name: 'Yard (yd)', toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
      { id: 'mi', name: 'Mile (mi)', toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
    ],
  },
  mass: {
    label: 'Mass',
    units: [
      { id: 'mg', name: 'Milligram (mg)', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
      { id: 'g', name: 'Gram (g)', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { id: 'kg', name: 'Kilogram (kg)', toBase: v => v, fromBase: v => v },
      { id: 't', name: 'Tonne (t)', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { id: 'oz', name: 'Ounce (oz)', toBase: v => v * 0.028349523, fromBase: v => v / 0.028349523 },
      { id: 'lb', name: 'Pound (lb)', toBase: v => v * 0.45359237, fromBase: v => v / 0.45359237 },
      { id: 'st', name: 'Stone (st)', toBase: v => v * 6.35029318, fromBase: v => v / 6.35029318 },
    ],
  },
  temperature: {
    label: 'Temperature',
    units: [
      { id: 'c', name: 'Celsius (°C)', toBase: v => v, fromBase: v => v },
      { id: 'f', name: 'Fahrenheit (°F)', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
      { id: 'k', name: 'Kelvin (K)', toBase: v => v - 273.15, fromBase: v => v + 273.15 },
    ],
  },
  time: {
    label: 'Time',
    units: [
      { id: 'ms', name: 'Millisecond (ms)', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { id: 's', name: 'Second (s)', toBase: v => v, fromBase: v => v },
      { id: 'min', name: 'Minute (min)', toBase: v => v * 60, fromBase: v => v / 60 },
      { id: 'h', name: 'Hour (h)', toBase: v => v * 3600, fromBase: v => v / 3600 },
      { id: 'd', name: 'Day (d)', toBase: v => v * 86400, fromBase: v => v / 86400 },
      { id: 'wk', name: 'Week (wk)', toBase: v => v * 604800, fromBase: v => v / 604800 },
      { id: 'yr', name: 'Year (yr)', toBase: v => v * 31557600, fromBase: v => v / 31557600 },
    ],
  },
  volume: {
    label: 'Volume',
    units: [
      { id: 'ml', name: 'Milliliter (ml)', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { id: 'l', name: 'Liter (L)', toBase: v => v, fromBase: v => v },
      { id: 'm3', name: 'Cubic meter (m³)', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { id: 'tsp', name: 'Teaspoon (tsp)', toBase: v => v * 0.00492892, fromBase: v => v / 0.00492892 },
      { id: 'tbsp', name: 'Tablespoon (tbsp)', toBase: v => v * 0.0147868, fromBase: v => v / 0.0147868 },
      { id: 'floz', name: 'Fl. ounce (fl oz)', toBase: v => v * 0.0295735, fromBase: v => v / 0.0295735 },
      { id: 'cup', name: 'Cup (cup)', toBase: v => v * 0.236588, fromBase: v => v / 0.236588 },
      { id: 'pt', name: 'Pint (pt)', toBase: v => v * 0.473176, fromBase: v => v / 0.473176 },
      { id: 'qt', name: 'Quart (qt)', toBase: v => v * 0.946353, fromBase: v => v / 0.946353 },
      { id: 'gal', name: 'Gallon (gal)', toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
    ],
  },
};

const CATEGORIES = Object.keys(UNIT_DEFS) as UnitCategory[];

function UnitConverter({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState<UnitCategory>('length');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const [inputVal, setInputVal] = useState('1');

  const cat = UNIT_DEFS[category];

  function handleCategoryChange(c: UnitCategory) {
    setCategory(c);
    const units = UNIT_DEFS[c].units;
    setFromUnit(units[2]?.id || units[0].id);
    setToUnit(units[3]?.id || units[1]?.id || units[0].id);
    setInputVal('1');
  }

  const result = (() => {
    const v = parseFloat(inputVal);
    if (isNaN(v)) return '';
    const fromDef = cat.units.find(u => u.id === fromUnit);
    const toDef = cat.units.find(u => u.id === toUnit);
    if (!fromDef || !toDef) return '';
    const base = fromDef.toBase(v);
    const out = toDef.fromBase(base);
    // Smart formatting
    if (Math.abs(out) >= 1e10 || (Math.abs(out) < 1e-4 && out !== 0)) {
      return out.toExponential(6);
    }
    return parseFloat(out.toPrecision(8)).toString();
  })();

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
    borderRadius: 8, background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none',
  };

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><Globe size={20} style={{ verticalAlign: 'middle' }} /> Unit Converter</h1>

      {/* Category tabs */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => handleCategoryChange(c)}
            className={`btn btn-sm ${category === c ? 'btn-primary' : 'btn-secondary'}`}
          >
            {UNIT_DEFS[c].label}
          </button>
        ))}
      </div>

      <div className="card">
        {/* From */}
        <div className="mb-3">
          <label className="text-xs text-muted mb-1" style={{ display: 'block' }}>From</label>
          <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} style={selStyle}>
            {cat.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input
            type="number"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            style={{ ...selStyle, marginTop: 8, fontSize: 20, fontWeight: 700, textAlign: 'right' }}
          />
        </div>

        {/* Swap button */}
        <div className="text-center mb-3">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => { setFromUnit(toUnit); setToUnit(fromUnit); }}
            title="Swap units"
          >
            ⇅ Swap
          </button>
        </div>

        {/* To */}
        <div className="mb-3">
          <label className="text-xs text-muted mb-1" style={{ display: 'block' }}>To</label>
          <select value={toUnit} onChange={e => setToUnit(e.target.value)} style={selStyle}>
            {cat.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div style={{
            marginTop: 8, padding: '12px 10px', border: '1px solid var(--border)',
            borderRadius: 8, background: 'var(--bg-secondary)', fontSize: 20, fontWeight: 700,
            textAlign: 'right', minHeight: 48, color: result ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {result || '—'}
          </div>
        </div>

        {result && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            {inputVal} {cat.units.find(u => u.id === fromUnit)?.name.split(' ')[0]} = {result} {cat.units.find(u => u.id === toUnit)?.name.split(' ')[0]}
          </div>
        )}
      </div>

      {/* Quick reference */}
      {category === 'temperature' && (
        <div className="card mt-3" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-xs text-muted" style={{ fontWeight: 700, marginBottom: 6 }}>Quick Reference</div>
          <div className="text-xs" style={{ lineHeight: 2 }}>
            0°C = 32°F (freezing) · 100°C = 212°F (boiling) · 37°C = 98.6°F (body) · -40°C = -40°F
          </div>
        </div>
      )}
    </div>
  );
}

// ─── #27 Matrix Calculator ──────────────────────────
type MatrixOp = 'determinant' | 'inverse' | 'transpose' | 'multiply';

type Matrix = number[][];

function makeMatrix(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function matDet(m: Matrix): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  let det = 0;
  for (let c = 0; c < n; c++) {
    const sub = m.slice(1).map(row => row.filter((_, j) => j !== c));
    det += (c % 2 === 0 ? 1 : -1) * m[0][c] * matDet(sub);
  }
  return det;
}

function matTranspose(m: Matrix): Matrix {
  return m[0].map((_, c) => m.map(row => row[c]));
}

function matInverse(m: Matrix): Matrix | null {
  const n = m.length;
  const det = matDet(m);
  if (Math.abs(det) < 1e-10) return null;
  if (n === 1) return [[1 / m[0][0]]];
  if (n === 2) {
    return [
      [m[1][1] / det, -m[0][1] / det],
      [-m[1][0] / det, m[0][0] / det],
    ];
  }
  // 3x3 via cofactor matrix
  const cof: Matrix = makeMatrix(3, 3);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sub = m.filter((_, i) => i !== r).map(row => row.filter((_, j) => j !== c));
      cof[r][c] = ((r + c) % 2 === 0 ? 1 : -1) * matDet(sub);
    }
  }
  const adj = matTranspose(cof);
  return adj.map(row => row.map(v => v / det));
}

function matMultiplyCorrect(a: Matrix, b: Matrix): Matrix | null {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  if (a[0].length !== inner) return null;
  const result: Matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++)
        result[i][j] += a[i][k] * b[k][j];
  return result;
}

function fmtNum(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 0.001 && v !== 0)) return v.toExponential(3);
  return parseFloat(v.toPrecision(6)).toString();
}

function MatrixInput({ matrix, onChange, label }: { matrix: Matrix; onChange: (m: Matrix) => void; label: string }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1" style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ display: 'inline-block', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
        {matrix.map((row, r) => (
          <div key={r} className="flex gap-1 mb-1">
            {row.map((val, c) => (
              <input
                key={c}
                type="number"
                value={val}
                onChange={e => {
                  const next = matrix.map(row => [...row]);
                  next[r][c] = parseFloat(e.target.value) || 0;
                  onChange(next);
                }}
                style={{
                  width: 54, padding: '5px 4px', border: '1px solid var(--border)',
                  borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)',
                  fontSize: 13, textAlign: 'center', outline: 'none',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatrixDisplay({ matrix, label }: { matrix: Matrix; label: string }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1" style={{ fontWeight: 700 }}>{label}</div>
      <div style={{
        display: 'inline-block', border: '2px solid var(--accent)',
        borderRadius: 8, padding: '8px 12px', background: 'var(--bg-secondary)',
      }}>
        {matrix.map((row, r) => (
          <div key={r} className="flex gap-3">
            {row.map((v, c) => (
              <span key={c} style={{ minWidth: 60, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{fmtNum(v)}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatrixCalc({ onBack }: { onBack: () => void }) {
  const [size, setSize] = useState<2 | 3>(2);
  const [op, setOp] = useState<MatrixOp>('determinant');
  const [matA, setMatA] = useState<Matrix>(() => makeMatrix(2, 2));
  const [matB, setMatB] = useState<Matrix>(() => makeMatrix(2, 2));
  const [result, setResult] = useState<{ scalar?: number; matrix?: Matrix; error?: string } | null>(null);

  function handleSizeChange(s: 2 | 3) {
    setSize(s);
    setMatA(makeMatrix(s, s));
    setMatB(makeMatrix(s, s));
    setResult(null);
  }

  function compute() {
    setResult(null);
    if (op === 'determinant') {
      const d = matDet(matA);
      setResult({ scalar: d });
    } else if (op === 'transpose') {
      setResult({ matrix: matTranspose(matA) });
    } else if (op === 'inverse') {
      const inv = matInverse(matA);
      if (!inv) setResult({ error: 'Matrix is singular (determinant = 0), inverse does not exist.' });
      else setResult({ matrix: inv });
    } else if (op === 'multiply') {
      const prod = matMultiplyCorrect(matA, matB);
      if (!prod) setResult({ error: 'Dimension mismatch.' });
      else setResult({ matrix: prod });
    }
  }

  const OPS: { id: MatrixOp; label: string }[] = [
    { id: 'determinant', label: 'Determinant' },
    { id: 'inverse', label: 'Inverse' },
    { id: 'transpose', label: 'Transpose' },
    { id: 'multiply', label: 'Multiply (A × B)' },
  ];

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title"><BookOpen size={20} style={{ verticalAlign: 'middle' }} /> Matrix Calculator</h1>

      <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
        <span className="text-xs text-muted">Size:</span>
        {([2, 3] as const).map(s => (
          <button key={s} className={`btn btn-sm ${size === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleSizeChange(s)}>
            {s}×{s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {OPS.map(o => (
          <button key={o.id} className={`btn btn-sm ${op === o.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setOp(o.id); setResult(null); }}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="card mb-3">
        <div className="flex gap-4" style={{ flexWrap: 'wrap', gap: 16 }}>
          <MatrixInput matrix={matA} onChange={m => { setMatA(m); setResult(null); }} label="Matrix A" />
          {op === 'multiply' && (
            <MatrixInput matrix={matB} onChange={m => { setMatB(m); setResult(null); }} label="Matrix B" />
          )}
        </div>
        <button className="btn btn-primary mt-3" onClick={compute} style={{ width: '100%' }}>
          <Play size={14} /> Calculate
        </button>
      </div>

      {result && (
        <div className="card" style={{ borderColor: result.error ? 'var(--red)' : 'var(--accent)', borderWidth: 1 }}>
          {result.error ? (
            <p className="text-sm" style={{ color: 'var(--red)' }}>{result.error}</p>
          ) : result.scalar !== undefined ? (
            <div>
              <div className="text-xs text-muted mb-1" style={{ fontWeight: 700 }}>det(A)</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{fmtNum(result.scalar)}</div>
              {result.scalar === 0 && <p className="text-xs text-muted mt-1">Singular matrix — no inverse exists.</p>}
            </div>
          ) : result.matrix ? (
            <MatrixDisplay matrix={result.matrix} label={op === 'transpose' ? 'Aᵀ' : op === 'inverse' ? 'A⁻¹' : 'A × B'} />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── #22 Graph Calculator ─────────────────────────────────
function GraphCalc({ onBack }: { onBack: () => void }) {
  const [expr, setExpr] = useState('x * x - 2');
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    const yRange = 20;
    const yMin = -yRange / 2;
    const yMax = yRange / 2;

    function toScreenX(x: number) { return ((x - xMin) / (xMax - xMin)) * W; }
    function toScreenY(y: number) { return H - ((y - yMin) / (yMax - yMin)) * H; }

    // Grid lines
    ctx.strokeStyle = 'rgba(128,128,128,0.2)';
    ctx.lineWidth = 1;
    for (let x = Math.ceil(xMin); x <= xMax; x++) {
      ctx.beginPath(); ctx.moveTo(toScreenX(x), 0); ctx.lineTo(toScreenX(x), H); ctx.stroke();
    }
    for (let y = Math.ceil(yMin); y <= yMax; y++) {
      ctx.beginPath(); ctx.moveTo(0, toScreenY(y)); ctx.lineTo(W, toScreenY(y)); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(128,128,128,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toScreenX(0), 0); ctx.lineTo(toScreenX(0), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toScreenY(0)); ctx.lineTo(W, toScreenY(0)); ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let x = Math.ceil(xMin); x <= xMax; x += 2) {
      if (x !== 0) ctx.fillText(String(x), toScreenX(x), toScreenY(0) + 12);
    }

    // Plot the function
    setError('');
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `'use strict'; return (${expr});`) as (x: number) => number;
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      const steps = W * 2;
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        const y = fn(x);
        if (!isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
        const sx = toScreenX(x), sy = toScreenY(y);
        if (!started) { ctx.moveTo(sx, sy); started = true; } else { ctx.lineTo(sx, sy); }
      }
      ctx.stroke();
    } catch {
      setError('Invalid expression');
    }
  }, [expr, xMin, xMax]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title">Graph Calculator</h1>
      <div className="card mb-3">
        <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>y =</span>
          <input
            value={expr}
            onChange={e => setExpr(e.target.value)}
            placeholder="x * x - 2"
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace' }}
          />
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--red, #ef4444)', marginBottom: 8 }}>{error}</div>}
        <canvas ref={canvasRef} width={320} height={240} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
        <div className="flex gap-3 mt-3" style={{ alignItems: 'center', fontSize: 12 }}>
          <span className="text-muted">x:</span>
          <input type="number" value={xMin} onChange={e => setXMin(Number(e.target.value))} style={{ width: 60, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }} />
          <span className="text-muted">to</span>
          <input type="number" value={xMax} onChange={e => setXMax(Number(e.target.value))} style={{ width: 60, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Use JS syntax: <code>Math.sin(x)</code>, <code>Math.sqrt(x)</code>, <code>Math.abs(x)</code>
        </div>
      </div>
    </div>
  );
}

// ─── #23 Chemistry Formula Renderer ──────────────────────
function ChemTool({ onBack }: { onBack: () => void }) {
  const [formula, setFormula] = useState('H_2O');
  const [rendered, setRendered] = useState('');
  const [error, setError] = useState('');

  function render() {
    try {
      let latex = formula.trim();
      if (!latex.startsWith('\\')) latex = `\\ce{${latex}}`;
      import('katex').then(katexMod => {
        try {
          const html = katexMod.default.renderToString(latex, { throwOnError: false, displayMode: true });
          setRendered(html);
          setError('');
        } catch {
          setError('Render error — check formula syntax');
        }
      }).catch(() => {
        setError('KaTeX not available');
      });
    } catch {
      setError('Invalid formula');
    }
  }

  const EXAMPLES = [
    { label: 'Water', f: 'H_2O' },
    { label: 'Glucose', f: 'C_6H_{12}O_6' },
    { label: 'Sulfuric acid', f: 'H_2SO_4' },
    { label: 'Combustion', f: 'CH_4 + 2O_2 -> CO_2 + 2H_2O' },
    { label: 'Equilibrium', f: 'N_2 + 3H_2 <=> 2NH_3' },
  ];

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title">Chemistry</h1>
      <div className="card mb-3">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Examples:</div>
        <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
          {EXAMPLES.map(ex => (
            <button key={ex.f} className="btn btn-sm btn-secondary" onClick={() => setFormula(ex.f)}>{ex.label}</button>
          ))}
        </div>
        <input
          value={formula}
          onChange={e => setFormula(e.target.value)}
          placeholder="H_2O or CH_4 + 2O_2 -> CO_2 + 2H_2O"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace', marginBottom: 8 }}
          onKeyDown={e => e.key === 'Enter' && render()}
        />
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={render}>Render Formula</button>
      </div>
      {error && <div className="card" style={{ color: 'var(--red, #ef4444)', fontSize: 13 }}>{error}</div>}
      {rendered && (
        <div className="card">
          <div dangerouslySetInnerHTML={{ __html: rendered }} style={{ fontSize: 20, textAlign: 'center', padding: 16 }} />
          <button className="btn btn-sm btn-secondary mt-2" onClick={() => navigator.clipboard.writeText(formula)}>Copy LaTeX</button>
        </div>
      )}
    </div>
  );
}

// ─── #25 Step-by-Step Solver ─────────────────────────────
function SolverTool({ onBack }: { onBack: () => void }) {
  const [problem, setProblem] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function solve() {
    if (!problem.trim()) return;
    if (!isAIConfigured()) { setError('Configure AI in Settings first'); return; }
    setLoading(true);
    setError('');
    setSteps([]);
    setRevealed(0);
    try {
      const resp = await callAI([{
        role: 'user',
        content: `Solve this step by step. Format your response as numbered steps, one per line, like "1. [step]\\n2. [step]\\n...". Do not use markdown headers. Problem: ${problem}`,
      }], {}, 'chat');
      const lines = (resp || '').split('\n').filter(l => /^\d+\./.test(l.trim()));
      setSteps(lines.length > 0 ? lines : (resp || '').split('\n').filter(l => l.trim()));
    } catch {
      setError('AI error — try again');
    }
    setLoading(false);
  }

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title">Step-by-Step Solver</h1>
      <div className="card mb-3">
        <textarea
          value={problem}
          onChange={e => setProblem(e.target.value)}
          placeholder="e.g. Solve 2x + 5 = 13  or  What is the derivative of x³?"
          rows={3}
          style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <button className="btn btn-primary mt-2" style={{ width: '100%' }} onClick={solve} disabled={loading || !problem.trim()}>
          {loading ? 'Solving…' : 'Solve Step by Step'}
        </button>
        {error && <div style={{ fontSize: 12, color: 'var(--red, #ef4444)', marginTop: 6 }}>{error}</div>}
      </div>
      {steps.length > 0 && (
        <div className="card">
          {steps.slice(0, revealed).map((s, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6 }}>{s}</div>
          ))}
          {revealed < steps.length && (
            <button className="btn btn-secondary mt-2" style={{ width: '100%' }} onClick={() => setRevealed(r => r + 1)}>
              Next Step ({revealed}/{steps.length})
            </button>
          )}
          {revealed >= steps.length && steps.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--green, #22c55e)', marginTop: 8, textAlign: 'center' }}>All steps revealed!</div>
          )}
          {revealed === 0 && (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setRevealed(1)}>Show First Step</button>
          )}
          <button className="btn btn-sm btn-secondary mt-2" onClick={() => setRevealed(steps.length)}>Show All Steps</button>
        </div>
      )}
    </div>
  );
}

// ─── #28 Code Sandbox ────────────────────────────────────
function CodeSandbox({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('// Try some JavaScript!\nconsole.log("Hello, NousAI!");\nconst sum = [1,2,3,4,5].reduce((a,b) => a+b, 0);\nconsole.log("Sum:", sum);');
  const [output, setOutput] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function run() {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setOutput('');
    const html = `<!DOCTYPE html><html><body><script>
      window.console = { log: function() { window.parent.postMessage({ type:'log', args: Array.from(arguments).map(String) }, '*'); }, error: function() { window.parent.postMessage({ type:'err', args: Array.from(arguments).map(String) }, '*'); }, warn: function() { window.parent.postMessage({ type:'warn', args: Array.from(arguments).map(String) }, '*'); } };
      try { ${code} } catch(e) { window.parent.postMessage({ type:'err', args:[e.message] }, '*'); }
    <\/script></body></html>`;
    iframe.srcdoc = html;
  }

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.data?.type) return;
      const prefix = e.data.type === 'err' ? '❌ ' : e.data.type === 'warn' ? '⚠️ ' : '→ ';
      setOutput(prev => prev + prefix + (e.data.args || []).join(' ') + '\n');
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div className="animate-in">
      <BackBtn onBack={onBack} />
      <h1 className="page-title">Code Sandbox</h1>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>JavaScript only — runs in your browser, no data sent anywhere.</div>
      <div className="card mb-3">
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          rows={10}
          spellCheck={false}
          style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace', resize: 'vertical' }}
        />
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={run}>▶ Run</button>
          <button className="btn btn-sm btn-secondary" onClick={() => setOutput('')}>Clear</button>
        </div>
      </div>
      <div className="card" style={{ background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>Output</div>
        <pre style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', minHeight: 60, color: 'var(--text-primary)', margin: 0 }}>
          {output || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Run code to see output here</span>}
        </pre>
      </div>
      <iframe ref={iframeRef} sandbox="allow-scripts" style={{ display: 'none' }} title="sandbox" />
    </div>
  );
}
